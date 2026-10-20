import { NextFunction, Request, Response } from "express";
import { VerifyTurnstile } from "../Turnstile.middleware";

const makeRes = () => {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as never;
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as never;
  return res;
};

const makeReq = (body: Record<string, unknown>) =>
  ({ body, ip: "203.0.113.1" }) as unknown as Request;

const mockSiteverify = (result: Record<string, unknown>) =>
  jest.spyOn(global, "fetch").mockResolvedValue({ json: async () => result } as never);

describe("VerifyTurnstile", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.TURNSTILE_SECRET = "test-secret";
    process.env.TURNSTILE_HOSTNAMES = "app.example.com";
  });

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it("lets a valid token for the right action and hostname through", async () => {
    const fetchSpy = mockSiteverify({ success: true, action: "login", hostname: "app.example.com" });
    const req = makeReq({ email: "a@b.c", "cf-turnstile-response": "tok" });
    const next = jest.fn() as NextFunction;

    await VerifyTurnstile("login")(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body["cf-turnstile-response"]).toBeUndefined();
    const sent = fetchSpy.mock.calls[0][1]!.body as URLSearchParams;
    expect(sent.get("secret")).toBe("test-secret");
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("203.0.113.1");
  });

  it.each([
    ["a failed or replayed token", { success: false, "error-codes": ["timeout-or-duplicate"] }],
    ["a token made for another action", { success: true, action: "signup", hostname: "app.example.com" }],
    ["a token from another hostname", { success: true, action: "login", hostname: "evil.example" }],
  ])("rejects %s", async (_label, result) => {
    mockSiteverify(result);
    const res = makeRes();
    const next = jest.fn();

    await VerifyTurnstile("login")(makeReq({ "cf-turnstile-response": "tok" }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("accepts FRONTEND_URL hosts with or without a scheme", async () => {
    delete process.env.TURNSTILE_HOSTNAMES;
    process.env.FRONTEND_URL = "localhost:5173, https://app.example.com";

    for (const hostname of ["localhost", "app.example.com"]) {
      mockSiteverify({ success: true, action: "login", hostname });
      const next = jest.fn();
      await VerifyTurnstile("login")(makeReq({ "cf-turnstile-response": "tok" }), makeRes(), next);
      expect(next).toHaveBeenCalled();
      jest.restoreAllMocks();
    }
  });

  it("rejects a request without a token, without calling Cloudflare", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const res = makeRes();
    await VerifyTurnstile("login")(makeReq({}), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when Cloudflare can't be reached", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();
    await VerifyTurnstile("login")(makeReq({ "cf-turnstile-response": "tok" }), res, jest.fn());
    expect(res.statusCode).toBe(503);
  });

  it("skips requests the condition excludes", async () => {
    const next = jest.fn();
    await VerifyTurnstile("forgot-password", (r) => r.body.ty === "vfy")(
      makeReq({ ty: "confirm" }),
      makeRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it("is skipped without a secret outside production, and fails closed in production", async () => {
    delete process.env.TURNSTILE_SECRET;
    const next = jest.fn();
    await VerifyTurnstile("login")(makeReq({}), makeRes(), next);
    expect(next).toHaveBeenCalled();

    process.env.NODE_ENV = "PROD";
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();
    const nextProd = jest.fn();
    await VerifyTurnstile("login")(makeReq({}), res, nextProd);
    expect(nextProd).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });
});
