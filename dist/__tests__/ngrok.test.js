"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
jest.mock("../database", () => jest.fn());
const app_1 = __importStar(require("../app"));
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
            expect((0, app_1.isOriginAllowed)("http://localhost:5173")).toBe(true);
            expect((0, app_1.isOriginAllowed)("http://localhost:3000")).toBe(true);
            expect((0, app_1.isOriginAllowed)("http://127.0.0.1:5173")).toBe(true);
        });
        test("allows ngrok-free.app and ngrok.app domains when in dev or USE_NGROK=true", () => {
            process.env.USE_NGROK = "true";
            expect((0, app_1.isOriginAllowed)("https://abc123.ngrok-free.app")).toBe(true);
            expect((0, app_1.isOriginAllowed)("https://sub.sub2.ngrok-free.app")).toBe(true);
            expect((0, app_1.isOriginAllowed)("https://my-tunnel.ngrok.app")).toBe(true);
            expect((0, app_1.isOriginAllowed)("https://my-tunnel.ngrok.io")).toBe(true);
        });
        test("allows comma-separated FRONTEND_URL origins", () => {
            process.env.FRONTEND_URL =
                "https://my-custom-domain.com, https://another-domain.com";
            expect((0, app_1.isOriginAllowed)("https://my-custom-domain.com")).toBe(true);
            expect((0, app_1.isOriginAllowed)("https://another-domain.com")).toBe(true);
        });
        test("rejects untrusted random domains in production", () => {
            process.env.NODE_ENV = "PROD";
            delete process.env.USE_NGROK;
            delete process.env.ALLOW_NGROK;
            process.env.FRONTEND_URL = "https://trusted-production.com";
            expect((0, app_1.isOriginAllowed)("https://malicious-site.com")).toBe(false);
            expect((0, app_1.isOriginAllowed)("https://random.ngrok-free.app")).toBe(false);
        });
    });
    describe("HTTP request headers & health endpoint", () => {
        test("attaches ngrok-skip-browser-warning response header", async () => {
            const res = await (0, supertest_1.default)(app_1.default).get("/health");
            expect(res.status).toBe(200);
            expect(res.headers["ngrok-skip-browser-warning"]).toBe("true");
        });
        test("health endpoint returns status ok and ngrok mode", async () => {
            process.env.USE_NGROK = "true";
            const res = await (0, supertest_1.default)(app_1.default).get("/health");
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
            expect(res.body.ngrok).toBe(true);
        });
        test("handles CORS preflight for ngrok headers", async () => {
            process.env.USE_NGROK = "true";
            const res = await (0, supertest_1.default)(app_1.default)
                .options("/v0/api/checksession")
                .set("Origin", "https://test-subdomain.ngrok-free.app")
                .set("Access-Control-Request-Method", "GET")
                .set("Access-Control-Request-Headers", "ngrok-skip-browser-warning, Content-Type");
            expect(res.status).toBe(204);
            expect(res.headers["access-control-allow-origin"]).toBe("https://test-subdomain.ngrok-free.app");
            expect(res.headers["access-control-allow-credentials"]).toBe("true");
        });
    });
});
