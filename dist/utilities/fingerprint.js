"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class FingerprintService {
    static generateFingerprint(data) {
        const fingerprint = [
            data.userAgent || "",
            data.acceptLanguage || "",
            data.acceptEncoding || "",
            data.screen || "",
            data.timezone || "",
            data.platform || "",
        ].join("|");
        return crypto_1.default.createHash("sha256").update(fingerprint).digest("hex");
    }
    static extractFingerprintFromRequest(req) {
        const getHeaderValue = (header) => {
            if (Array.isArray(header)) {
                return header.join(", ");
            }
            return header || "";
        };
        return {
            userAgent: getHeaderValue(req.headers["user-agent"]),
            acceptLanguage: getHeaderValue(req.headers["accept-language"]),
            acceptEncoding: getHeaderValue(req.headers["accept-encoding"]),
            screen: getHeaderValue(req.headers["x-screen-resolution"]),
            timezone: getHeaderValue(req.headers["x-timezone"]),
            platform: getHeaderValue(req.headers["x-platform"]),
        };
    }
    static getClientIP(req) {
        var _a, _b;
        const forwarded = req.headers["x-forwarded-for"];
        const realIP = req.headers["x-real-ip"];
        if (forwarded) {
            return forwarded.split(",")[0].trim();
        }
        if (realIP) {
            return realIP;
        }
        return (((_a = req.connection) === null || _a === void 0 ? void 0 : _a.remoteAddress) ||
            ((_b = req.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) ||
            req.ip ||
            "unknown");
    }
    static generateTrackingData(req) {
        var _a;
        const clientIP = this.getClientIP(req);
        const browserFingerprint = this.extractFingerprintFromRequest(req);
        const fingerprintHash = this.generateFingerprint(browserFingerprint);
        return {
            fingerprint: fingerprintHash,
            ip: clientIP,
            deviceInfo: browserFingerprint,
            sessionId: ((_a = req.session) === null || _a === void 0 ? void 0 : _a.id) || req.sessionID,
        };
    }
    static validateFingerprint(fingerprint) {
        // Basic validation - ensure we have some identifying information
        const hasUserAgent = fingerprint.userAgent && fingerprint.userAgent.length > 10;
        const hasLanguage = fingerprint.acceptLanguage && fingerprint.acceptLanguage.length > 0;
        const hasEncoding = fingerprint.acceptEncoding && fingerprint.acceptEncoding.length > 0;
        return Boolean(hasUserAgent && (hasLanguage || hasEncoding));
    }
    static getFingerprintStrength(fingerprint) {
        let score = 0;
        // User agent contributes 30 points
        if (fingerprint.userAgent && fingerprint.userAgent.length > 10) {
            score += 30;
        }
        // Language contributes 15 points
        if (fingerprint.acceptLanguage && fingerprint.acceptLanguage.length > 0) {
            score += 15;
        }
        // Encoding contributes 10 points
        if (fingerprint.acceptEncoding && fingerprint.acceptEncoding.length > 0) {
            score += 10;
        }
        // Screen resolution contributes 20 points
        if (fingerprint.screen && fingerprint.screen.includes("x")) {
            score += 20;
        }
        // Timezone contributes 15 points
        if (fingerprint.timezone && fingerprint.timezone.length > 0) {
            score += 15;
        }
        // Platform contributes 10 points
        if (fingerprint.platform && fingerprint.platform.length > 0) {
            score += 10;
        }
        return Math.min(score, 100);
    }
}
exports.FingerprintService = FingerprintService;
