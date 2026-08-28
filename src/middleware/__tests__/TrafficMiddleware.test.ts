import request from "supertest";
import express, { Request, Response } from "express";
import TrafficControl from "../Traffic.middleware";
import app from "../../app";
import authenicationController from "../../controller/auth/authenication.controller";

// Mock DB connection to prevent real MongoDB connection attempts
jest.mock("../../database", () => jest.fn());

// Mock authentication controller
jest.mock("../../controller/auth/authenication.controller", () => ({
  __esModule: true,
  default: {
    Login: jest.fn((req: Request, res: Response) =>
      res.status(404).json({ code: 404, message: "Incorrect Credential" }),
    ),
    ForgotPassword: jest.fn((req: Request, res: Response) =>
      res.status(200).json({ code: 200, message: "Success" }),
    ),
    CheckSession: jest.fn((req: Request, res: Response) =>
      res.status(200).json({ code: 200 }),
    ),
    Logout: jest.fn((req: Request, res: Response) =>
      res.status(200).json({ code: 200 }),
    ),
    RefreshToken: jest.fn((req: Request, res: Response) =>
      res.status(200).json({ code: 200 }),
    ),
  },
}));

// Mock validation middleware to pass through to controller
jest.mock("../../middleware/Validatetor", () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));

describe("Traffic Rate Limit Integration Tests (Supertest)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limiter keys for test clients
    if (typeof TrafficControl.LoginRateLimit.resetKey === "function") {
      TrafficControl.LoginRateLimit.resetKey("::ffff:127.0.0.1");
      TrafficControl.LoginRateLimit.resetKey("127.0.0.1");
      TrafficControl.LoginRateLimit.resetKey("::1");
    }
    if (typeof TrafficControl.PasswordResetRateLimit.resetKey === "function") {
      TrafficControl.PasswordResetRateLimit.resetKey("::ffff:127.0.0.1");
      TrafficControl.PasswordResetRateLimit.resetKey("127.0.0.1");
      TrafficControl.PasswordResetRateLimit.resetKey("::1");
    }
  });

  describe("POST /v0/api/login (LoginRateLimit)", () => {
    test("allows up to 5 failed login attempts and blocks the 6th with 429", async () => {
      // Perform 5 failed login attempts (max limit)
      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post("/v0/api/login").send({
          email: "test@example.com",
          password: "WrongPassword123!",
        });

        expect(res.status).toBe(404);
        expect(res.headers["ratelimit-limit"]).toBe("5");
        expect(res.headers["ratelimit-remaining"]).toBe(String(5 - i));
      }

      // 6th attempt should be blocked by rate limiter
      const blockedRes = await request(app).post("/v0/api/login").send({
        email: "test@example.com",
        password: "WrongPassword123!",
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        code: 429,
        message: "Too many login attempts, please try again later",
      });
      expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
    });

    test("skips rate limiting count on successful login (skipSuccessfulRequests: true)", async () => {
      // Mock successful login response
      (authenicationController.Login as jest.Mock).mockImplementationOnce(
        (req: Request, res: Response) =>
          res.status(200).json({ code: 200, message: "Success" }),
      );

      // Perform a successful login
      const successfulRes = await request(app).post("/v0/api/login").send({
        email: "valid@example.com",
        password: "CorrectPassword123!",
      });

      expect(successfulRes.status).toBe(200);

      // Subsequent 5 failed attempts should still all be allowed
      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post("/v0/api/login").send({
          email: "valid@example.com",
          password: "WrongPassword123!",
        });

        expect(res.status).toBe(404);
      }

      // Only the 6th failed attempt is blocked
      const blockedRes = await request(app).post("/v0/api/login").send({
        email: "valid@example.com",
        password: "WrongPassword123!",
      });

      expect(blockedRes.status).toBe(429);
    });
  });

  describe("PUT /v0/api/forgotpassword (PasswordResetRateLimit)", () => {
    test("allows up to 3 password reset attempts and blocks the 4th with 429", async () => {
      // Perform 3 password reset attempts (max limit)
      for (let i = 1; i <= 3; i++) {
        const res = await request(app).put("/v0/api/forgotpassword").send({
          ty: "vfy",
          email: "reset@example.com",
          html: "<p>code: $code$</p>",
        });

        expect(res.status).toBe(200);
        expect(res.headers["ratelimit-limit"]).toBe("3");
        expect(res.headers["ratelimit-remaining"]).toBe(String(3 - i));
      }

      // 4th attempt should be blocked by rate limiter
      const blockedRes = await request(app).put("/v0/api/forgotpassword").send({
        ty: "vfy",
        email: "reset@example.com",
        html: "<p>code: $code$</p>",
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        code: 429,
        message: "Too many password reset attempts, please try again later",
      });
      expect(blockedRes.headers["ratelimit-remaining"]).toBe("0");
    });
  });

  describe("Standalone Middleware Verification (Custom App Instance)", () => {
    test("LoginRateLimit middleware directly blocks excessive requests", async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post("/test-login", TrafficControl.LoginRateLimit, (req, res) => {
        res.status(401).json({ message: "Unauthorized" });
      });

      for (let i = 1; i <= 5; i++) {
        const res = await request(testApp).post("/test-login").send({});
        expect(res.status).toBe(401);
      }

      const blockedRes = await request(testApp).post("/test-login").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.message).toContain("Too many login attempts");
    });

    test("PasswordResetRateLimit middleware directly blocks excessive requests", async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.put(
        "/test-forgot",
        TrafficControl.PasswordResetRateLimit,
        (req, res) => {
          res.status(200).json({ message: "OK" });
        },
      );

      for (let i = 1; i <= 3; i++) {
        const res = await request(testApp).put("/test-forgot").send({});
        expect(res.status).toBe(200);
      }

      const blockedRes = await request(testApp).put("/test-forgot").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.message).toContain(
        "Too many password reset attempts",
      );
    });
  });
});
