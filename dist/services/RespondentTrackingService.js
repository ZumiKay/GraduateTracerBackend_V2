"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RespondentTrackingService = void 0;
const fingerprint_1 = require("../utilities/fingerprint");
class RespondentTrackingService {
    static checkRespondentExists(formId, req, ResponseModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const trackingData = this.generateTrackingData(req);
            // Check by fingerprint first (most reliable for unique identification)
            try {
                const existingResponseByFingerprint = yield ResponseModel.findOne({
                    formId,
                    respondentFingerprint: trackingData.fingerprint,
                }).lean();
                if (existingResponseByFingerprint) {
                    return {
                        hasResponded: true,
                        trackingMethod: "fingerprint",
                        responseId: existingResponseByFingerprint._id.toString(),
                        fingerprint: trackingData.fingerprint,
                        ipAddress: trackingData.ip,
                        fingerprintStrength: trackingData.fingerprintStrength,
                    };
                }
            }
            catch (error) {
                console.warn("Error checking fingerprint:", error);
            }
            // Fallback to IP address (less reliable but better than nothing)
            try {
                const existingResponseByIP = yield ResponseModel.findOne({
                    formId,
                    respondentIP: trackingData.ip,
                }).lean();
                if (existingResponseByIP) {
                    return {
                        hasResponded: true,
                        trackingMethod: "ip",
                        responseId: existingResponseByIP._id.toString(),
                        fingerprint: trackingData.fingerprint,
                        ipAddress: trackingData.ip,
                        fingerprintStrength: trackingData.fingerprintStrength,
                    };
                }
            }
            catch (error) {
                console.warn("Error checking IP address:", error);
            }
            return {
                hasResponded: false,
                trackingMethod: "none",
                fingerprint: trackingData.fingerprint,
                ipAddress: trackingData.ip,
                fingerprintStrength: trackingData.fingerprintStrength,
            };
        });
    }
    static generateTrackingData(req) {
        var _a;
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
            sessionId: ((_a = req.session) === null || _a === void 0 ? void 0 : _a.id) || req.sessionID,
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
        return Object.assign(Object.assign({}, baseData), { respondentFingerprint: trackingData.fingerprint, respondentIP: trackingData.ip, deviceInfo: trackingData.deviceInfo, respondentSessionId: trackingData.sessionId, fingerprintStrength: trackingData.fingerprintStrength });
    }
}
exports.RespondentTrackingService = RespondentTrackingService;
