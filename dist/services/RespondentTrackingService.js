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
    static async checkRespondentExists(respondentData) {
        const { formId, respondentFingerprint, respondentIP, respondentEmail, fingerprintStrength, } = respondentData;
        // Build common base result to avoid repetition
        const baseResult = {
            fingerprint: respondentFingerprint,
            ipAddress: respondentIP,
            fingerprintStrength,
            respondentEmail,
        };
        // Attempt fingerprint lookup first (most reliable)
        if (respondentFingerprint) {
            const existingResponse = await Response_model_1.default.findOne({ formId, respondentFingerprint }, { _id: 1 }).lean();
            if (existingResponse) {
                return {
                    hasResponded: true,
                    trackingMethod: "fingerprint",
                    responseId: existingResponse._id.toString(),
                    ...baseResult,
                };
            }
        }
        // Fallback to IP + email lookup (requires both for reliability)
        if (respondentIP && respondentEmail) {
            const existingResponse = await Response_model_1.default.findOne({ formId, respondentIP, respondentEmail }, { _id: 1 }).lean();
            if (existingResponse) {
                return {
                    hasResponded: true,
                    trackingMethod: "ip",
                    responseId: existingResponse._id.toString(),
                    ...baseResult,
                };
            }
        }
        // No existing response found
        return {
            hasResponded: false,
            trackingMethod: "none",
            ...baseResult,
        };
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
