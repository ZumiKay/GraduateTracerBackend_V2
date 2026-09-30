"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fingerprint_1 = require("../fingerprint");
describe("FingerprintService Edge & Proxy Tests", () => {
    describe("getClientIP", () => {
        test("extracts the first (client) IP from multi-hop X-Forwarded-For header", () => {
            const mockReq = {
                headers: {
                    "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
                },
            };
            const ip = fingerprint_1.FingerprintService.getClientIP(mockReq);
            expect(ip).toBe("203.0.113.195");
        });
        test("falls back to X-Real-IP when X-Forwarded-For is not present", () => {
            const mockReq = {
                headers: {
                    "x-real-ip": "198.51.100.42",
                },
            };
            const ip = fingerprint_1.FingerprintService.getClientIP(mockReq);
            expect(ip).toBe("198.51.100.42");
        });
        test("falls back to req.connection.remoteAddress when proxy headers are absent", () => {
            const mockReq = {
                headers: {},
                connection: { remoteAddress: "192.168.1.50" },
            };
            const ip = fingerprint_1.FingerprintService.getClientIP(mockReq);
            expect(ip).toBe("192.168.1.50");
        });
        test("falls back to req.socket.remoteAddress when connection is missing", () => {
            const mockReq = {
                headers: {},
                socket: { remoteAddress: "::ffff:127.0.0.1" },
            };
            const ip = fingerprint_1.FingerprintService.getClientIP(mockReq);
            expect(ip).toBe("::ffff:127.0.0.1");
        });
        test("returns 'unknown' if no IP sources are available", () => {
            const mockReq = {
                headers: {},
            };
            const ip = fingerprint_1.FingerprintService.getClientIP(mockReq);
            expect(ip).toBe("unknown");
        });
    });
    describe("extractFingerprintFromRequest", () => {
        test("handles array headers gracefully by joining them", () => {
            const mockReq = {
                headers: {
                    "user-agent": ["Mozilla/5.0", "ExtraAgent"],
                    "accept-language": ["en-US", "en;q=0.9"],
                    "accept-encoding": "gzip, deflate",
                },
            };
            const fp = fingerprint_1.FingerprintService.extractFingerprintFromRequest(mockReq);
            expect(fp.userAgent).toBe("Mozilla/5.0, ExtraAgent");
            expect(fp.acceptLanguage).toBe("en-US, en;q=0.9");
            expect(fp.acceptEncoding).toBe("gzip, deflate");
        });
        test("defaults missing headers to 'unknown' or undefined without throwing", () => {
            const mockReq = {
                headers: {},
            };
            const fp = fingerprint_1.FingerprintService.extractFingerprintFromRequest(mockReq);
            expect(fp.userAgent).toBe("unknown");
            expect(fp.acceptLanguage).toBe("unknown");
            expect(fp.acceptEncoding).toBe("unknown");
            expect(fp.screen).toBe("");
        });
    });
    describe("validateFingerprint & getFingerprintStrength", () => {
        test("validates complete fingerprint as valid with high strength score", () => {
            const strongFingerprint = {
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                acceptLanguage: "en-US,en;q=0.9",
                acceptEncoding: "gzip, deflate, br",
                screen: "1920x1080",
                timezone: "America/New_York",
                platform: "MacIntel",
            };
            const isValid = fingerprint_1.FingerprintService.validateFingerprint(strongFingerprint);
            const strength = fingerprint_1.FingerprintService.getFingerprintStrength(strongFingerprint);
            expect(isValid).toBe(true);
            expect(strength).toBe(100); // 30 + 15 + 10 + 20 + 15 + 10 = 100
        });
        test("marks weak/empty fingerprint as invalid with low strength score", () => {
            const weakFingerprint = {
                userAgent: "curl/7.68", // length <= 10
                acceptLanguage: "",
                acceptEncoding: "",
            };
            const isValid = fingerprint_1.FingerprintService.validateFingerprint(weakFingerprint);
            const strength = fingerprint_1.FingerprintService.getFingerprintStrength(weakFingerprint);
            expect(isValid).toBe(false);
            expect(strength).toBe(0);
        });
        test("produces consistent deterministic SHA-256 hash", () => {
            const fpData = {
                userAgent: "TestAgent",
                acceptLanguage: "en",
                acceptEncoding: "gzip",
            };
            const hash1 = fingerprint_1.FingerprintService.generateFingerprint(fpData);
            const hash2 = fingerprint_1.FingerprintService.generateFingerprint(fpData);
            expect(hash1).toHaveLength(64);
            expect(hash1).toBe(hash2);
        });
    });
});
