import request from "supertest";
jest.mock("../database", () => jest.fn());
import app, { isOriginAllowed } from "../app";

describe("Ngrok and CORS configuration tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isOriginAllowed logic", () => {
    test("allows standard localhost origins in dev", () => {
      process.env.NODE_ENV = "DEV";
      expect(isOriginAllowed("http://localhost:5173")).toBe(true);
      expect(isOriginAllowed("http://localhost:3000")).toBe(true);
      expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
    });

    test("allows ngrok-free.app and ngrok.app domains when in dev or USE_NGROK=true", () => {
      process.env.USE_NGROK = "true";
      expect(isOriginAllowed("https://abc123.ngrok-free.app")).toBe(true);
      expect(isOriginAllowed("https://sub.sub2.ngrok-free.app")).toBe(true);
      expect(isOriginAllowed("https://my-tunnel.ngrok.app")).toBe(true);
      expect(isOriginAllowed("https://my-tunnel.ngrok.io")).toBe(true);
    });

    test("allows comma-separated FRONTEND_URL origins", () => {
      process.env.FRONTEND_URL =
        "https://my-custom-domain.com, https://another-domain.com";
      expect(isOriginAllowed("https://my-custom-domain.com")).toBe(true);
      expect(isOriginAllowed("https://another-domain.com")).toBe(true);
    });

    test("rejects untrusted random domains in production", () => {
      process.env.NODE_ENV = "PROD";
      delete process.env.USE_NGROK;
      delete process.env.ALLOW_NGROK;
      process.env.FRONTEND_URL = "https://trusted-production.com";

      expect(isOriginAllowed("https://malicious-site.com")).toBe(false);
      expect(isOriginAllowed("https://random.ngrok-free.app")).toBe(false);
    });
  });

  describe("HTTP request headers & health endpoint", () => {
    test("attaches ngrok-skip-browser-warning response header", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.headers["ngrok-skip-browser-warning"]).toBe("true");
    });

    test("health endpoint returns status ok and ngrok mode", async () => {
      process.env.USE_NGROK = "true";
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.ngrok).toBe(true);
    });

    test("handles CORS preflight for ngrok headers", async () => {
      process.env.USE_NGROK = "true";
      const res = await request(app)
        .options("/v0/api/checksession")
        .set("Origin", "https://test-subdomain.ngrok-free.app")
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "ngrok-skip-browser-warning, Content-Type");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://test-subdomain.ngrok-free.app",
      );
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });
  });
});
