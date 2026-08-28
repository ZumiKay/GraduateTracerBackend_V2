"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const Traffic_middleware_1 = __importDefault(require("../Traffic.middleware"));
const app_1 = __importDefault(require("../../app"));
const authenication_controller_1 = __importDefault(require("../../controller/auth/authenication.controller"));
// Mock DB connection to prevent real MongoDB connection attempts
jest.mock("../../database", () => jest.fn());
// Mock authentication controller
jest.mock("../../controller/auth/authenication.controller", () => ({
    __esModule: true,
    default: {
        Login: jest.fn((req, res) => res.status(404).json({ code: 404, message: "Incorrect Credential" })),
        ForgotPassword: jest.fn((req, res) => res.status(200).json({ code: 200, message: "Success" })),
        CheckSession: jest.fn((req, res) => res.status(200).json({ code: 200 })),
        Logout: jest.fn((req, res) => res.status(200).json({ code: 200 })),
        RefreshToken: jest.fn((req, res) => res.status(200).json({ code: 200 })),
    },
}));
// Mock validation middleware to pass through to controller
jest.mock("../../middleware/Validatetor", () => ({
    validate: () => (req, res, next) => next(),
}));
describe("Traffic Rate Limit Integration Tests (Supertest)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset rate limiter keys for test clients
        if (typeof Traffic_middleware_1.default.LoginRateLimit.resetKey === "function") {
            Traffic_middleware_1.default.LoginRateLimit.resetKey("::ffff:127.0.0.1");
            Traffic_middleware_1.default.LoginRateLimit.resetKey("127.0.0.1");
            Traffic_middleware_1.default.LoginRateLimit.resetKey("::1");
        }
        if (typeof Traffic_middleware_1.default.PasswordResetRateLimit.resetKey === "function") {
            Traffic_middleware_1.default.PasswordResetRateLimit.resetKey("::ffff:127.0.0.1");
            Traffic_middleware_1.default.PasswordResetRateLimit.resetKey("127.0.0.1");
            Traffic_middleware_1.default.PasswordResetRateLimit.resetKey("::1");
        }
    });
    describe("POST /v0/api/login (LoginRateLimit)", () => {
        test("allows up to 5 failed login attempts and blocks the 6th with 429", async () => {
            // Perform 5 failed login attempts (max limit)
            for (let i = 1; i <= 5; i++) {
                const res = await (0, supertest_1.default)(app_1.default).post("/v0/api/login").send({
                    email: "test@example.com",
                    password: "WrongPassword123!",
                });
                expect(res.status).toBe(404);
                expect(res.headers["ratelimit-limit"]).toBe("5");
                expect(res.headers["ratelimit-remaining"]).toBe(String(5 - i));
            }
            // 6th attempt should be blocked by rate limiter
            const blockedRes = await (0, supertest_1.default)(app_1.default).post("/v0/api/login").send({
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
            authenication_controller_1.default.Login.mockImplementationOnce((req, res) => res.status(200).json({ code: 200, message: "Success" }));
            // Perform a successful login
            const successfulRes = await (0, supertest_1.default)(app_1.default).post("/v0/api/login").send({
                email: "valid@example.com",
                password: "CorrectPassword123!",
            });
            expect(successfulRes.status).toBe(200);
            // Subsequent 5 failed attempts should still all be allowed
            for (let i = 1; i <= 5; i++) {
                const res = await (0, supertest_1.default)(app_1.default).post("/v0/api/login").send({
                    email: "valid@example.com",
                    password: "WrongPassword123!",
                });
                expect(res.status).toBe(404);
            }
            // Only the 6th failed attempt is blocked
            const blockedRes = await (0, supertest_1.default)(app_1.default).post("/v0/api/login").send({
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
                const res = await (0, supertest_1.default)(app_1.default).put("/v0/api/forgotpassword").send({
                    ty: "vfy",
                    email: "reset@example.com",
                    html: "<p>code: $code$</p>",
                });
                expect(res.status).toBe(200);
                expect(res.headers["ratelimit-limit"]).toBe("3");
                expect(res.headers["ratelimit-remaining"]).toBe(String(3 - i));
            }
            // 4th attempt should be blocked by rate limiter
            const blockedRes = await (0, supertest_1.default)(app_1.default).put("/v0/api/forgotpassword").send({
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
            const testApp = (0, express_1.default)();
            testApp.use(express_1.default.json());
            testApp.post("/test-login", Traffic_middleware_1.default.LoginRateLimit, (req, res) => {
                res.status(401).json({ message: "Unauthorized" });
            });
            for (let i = 1; i <= 5; i++) {
                const res = await (0, supertest_1.default)(testApp).post("/test-login").send({});
                expect(res.status).toBe(401);
            }
            const blockedRes = await (0, supertest_1.default)(testApp).post("/test-login").send({});
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.body.message).toContain("Too many login attempts");
        });
        test("PasswordResetRateLimit middleware directly blocks excessive requests", async () => {
            const testApp = (0, express_1.default)();
            testApp.use(express_1.default.json());
            testApp.put("/test-forgot", Traffic_middleware_1.default.PasswordResetRateLimit, (req, res) => {
                res.status(200).json({ message: "OK" });
            });
            for (let i = 1; i <= 3; i++) {
                const res = await (0, supertest_1.default)(testApp).put("/test-forgot").send({});
                expect(res.status).toBe(200);
            }
            const blockedRes = await (0, supertest_1.default)(testApp).put("/test-forgot").send({});
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.body.message).toContain("Too many password reset attempts");
        });
    });
});
