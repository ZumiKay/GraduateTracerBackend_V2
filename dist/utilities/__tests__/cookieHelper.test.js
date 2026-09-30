"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cookieHelper_1 = require("../cookieHelper");
describe("cookieHelper tests", () => {
    const originalEnv = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });
    afterAll(() => {
        process.env = originalEnv;
    });
    test("returns standard lax/non-secure options in local dev without ngrok", () => {
        process.env.NODE_ENV = "DEV";
        delete process.env.USE_NGROK;
        delete process.env.COOKIE_SAMESITE;
        delete process.env.COOKIE_SECURE;
        const options = (0, cookieHelper_1.getCookieOptions)();
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe("lax");
        expect(options.secure).toBe(false);
    });
    test("returns secure/lax options in production without ngrok", () => {
        process.env.NODE_ENV = "PROD";
        delete process.env.USE_NGROK;
        delete process.env.COOKIE_SAMESITE;
        delete process.env.COOKIE_SECURE;
        const options = (0, cookieHelper_1.getCookieOptions)();
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe("lax");
        expect(options.secure).toBe(true);
    });
    test("returns sameSite: none and secure: true when USE_NGROK=true", () => {
        process.env.NODE_ENV = "DEV";
        process.env.USE_NGROK = "true";
        const options = (0, cookieHelper_1.getCookieOptions)();
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe("none");
        expect(options.secure).toBe(true);
    });
    test("returns sameSite: none and secure: true when COOKIE_SAMESITE=none", () => {
        process.env.NODE_ENV = "DEV";
        delete process.env.USE_NGROK;
        process.env.COOKIE_SAMESITE = "none";
        const options = (0, cookieHelper_1.getCookieOptions)();
        expect(options.sameSite).toBe("none");
        expect(options.secure).toBe(true);
    });
    test("preserves custom options such as maxAge and expires", () => {
        process.env.USE_NGROK = "true";
        const expiry = new Date(Date.now() + 60000);
        const options = (0, cookieHelper_1.getCookieOptions)({ expires: expiry, maxAge: 60000 });
        expect(options.expires).toEqual(expiry);
        expect(options.maxAge).toBe(60000);
        expect(options.sameSite).toBe("none");
        expect(options.secure).toBe(true);
    });
    test("preserves custom sameSite in non-ngrok dev if passed", () => {
        process.env.NODE_ENV = "DEV";
        delete process.env.USE_NGROK;
        delete process.env.COOKIE_SAMESITE;
        const options = (0, cookieHelper_1.getCookieOptions)({ sameSite: "strict" });
        expect(options.sameSite).toBe("strict");
        expect(options.secure).toBe(false);
    });
    test("getClearCookieOptions provides matching clear options and path", () => {
        process.env.USE_NGROK = "true";
        const clearOpts = (0, cookieHelper_1.getClearCookieOptions)();
        expect(clearOpts.path).toBe("/");
        expect(clearOpts.sameSite).toBe("none");
        expect(clearOpts.secure).toBe(true);
        expect(clearOpts.httpOnly).toBe(true);
    });
});
