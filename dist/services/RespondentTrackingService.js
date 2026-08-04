"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RespondentTrackingService = void 0;
const fingerprint_1 = require("../utilities/fingerprint");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const helper_1 = require("../utilities/helper");
class RespondentTrackingService {
    /**
     * Converts seconds to a human-readable duration string (e.g., "1d 2h 30mn")
     */
    static formatCompletionTime(seconds) {
        if (seconds < 0)
            return "0mn";
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (days > 0)
            parts.push(`${days}d`);
        if (hours > 0)
            parts.push(`${hours}h`);
        if (minutes > 0)
            parts.push(`${minutes}mn`);
        return parts.length > 0 ? parts.join(" ") : "0mn";
    }
    static async checkRespondentExists(respondentData) {
        const { formId, respondentFingerprint, respondentIP, respondentEmail } = respondentData;
        const orConditions = [];
        if (respondentEmail)
            orConditions.push({
                respondentEmail,
            });
        if (respondentIP)
            orConditions.push({ respondentIP });
        if (respondentFingerprint)
            orConditions.push({ respondentFingerprint });
        if (orConditions.length === 0)
            return { hasResponded: undefined };
        console.dir({ orConditions }, { depth: null });
        const existingResponse = await Response_model_1.default.findOne({ formId, $or: orConditions }, { _id: 1, maxScore: 1, totalScore: 1 }).lean();
        if (existingResponse) {
            return {
                hasResponded: {
                    message: "You already submitted response",
                    responseId: existingResponse._id.toString(),
                    maxScore: existingResponse.maxScore,
                    totalScore: existingResponse.totalScore,
                },
            };
        }
        return { hasResponded: undefined };
    }
    static generateTrackingData(req) {
        const clientIP = fingerprint_1.FingerprintService.getClientIP(req);
        const browserFingerprint = fingerprint_1.FingerprintService.extractFingerprintFromRequest(req);
        const fingerprintHash = fingerprint_1.FingerprintService.generateFingerprint(browserFingerprint);
        const fingerprintStrength = fingerprint_1.FingerprintService.getFingerprintStrength(browserFingerprint);
        return {
            fingerprint: fingerprintHash,
            ip: clientIP,
            deviceInfo: {
                userAgent: browserFingerprint.userAgent,
                platform: browserFingerprint.platform || "",
                screen: browserFingerprint.screen || "",
                timezone: browserFingerprint.timezone || "",
                acceptLanguage: browserFingerprint.acceptLanguage,
                acceptEncoding: browserFingerprint.acceptEncoding,
            },
            sessionId: req.session?.id || req.sessionID,
            fingerprintStrength,
        };
    }
    static isTrackingReliable(trackingData) {
        // Consider tracking reliable if fingerprint strength is above 60
        // and we have at least an IP address
        return (trackingData.fingerprintStrength >= 60 &&
            trackingData.ip !== "unknown" &&
            trackingData.ip.length > 0);
    }
    static getTrackingDescription(result) {
        switch (result.trackingMethod) {
            case "fingerprint":
                return `Response detected using browser fingerprint (strength: ${result.fingerprintStrength}%)`;
            case "ip":
                return `Response detected using IP address: ${result.ipAddress}`;
            case "none":
                return "No previous response detected";
            default:
                return "Unknown tracking method";
        }
    }
    static createSubmissionWithTracking(baseData, req) {
        const trackingData = this.generateTrackingData(req);
        const hashedIP = (0, helper_1.hashedPassword)(trackingData.ip);
        return {
            ...baseData,
            respondentFingerprint: trackingData.fingerprint,
            respondentIP: hashedIP,
            deviceInfo: trackingData.deviceInfo,
            respondentSessionId: trackingData.sessionId,
            fingerprintStrength: trackingData.fingerprintStrength,
        };
    }
}
exports.RespondentTrackingService = RespondentTrackingService;
