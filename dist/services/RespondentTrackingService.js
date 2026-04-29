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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RespondentTrackingService = void 0;
const fingerprint_1 = require("../utilities/fingerprint");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const helper_1 = require("../utilities/helper");
class RespondentTrackingService {
    static checkRespondentExists(respondentData) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const existingResponse = yield Response_model_1.default.findOne({ formId, respondentFingerprint }, { _id: 1 }).lean();
                if (existingResponse) {
                    return Object.assign({ hasResponded: true, trackingMethod: "fingerprint", responseId: existingResponse._id.toString() }, baseResult);
                }
            }
            // Fallback to IP + email lookup (requires both for reliability)
            if (respondentIP && respondentEmail) {
                const existingResponse = yield Response_model_1.default.findOne({ formId, respondentIP, respondentEmail }, { _id: 1 }).lean();
                if (existingResponse) {
                    return Object.assign({ hasResponded: true, trackingMethod: "ip", responseId: existingResponse._id.toString() }, baseResult);
                }
            }
            // No existing response found
            return Object.assign({ hasResponded: false, trackingMethod: "none" }, baseResult);
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
        const hashedIP = (0, helper_1.hashedPassword)(trackingData.ip);
        return Object.assign(Object.assign({}, baseData), { respondentFingerprint: trackingData.fingerprint, respondentIP: hashedIP, deviceInfo: trackingData.deviceInfo, respondentSessionId: trackingData.sessionId, fingerprintStrength: trackingData.fingerprintStrength });
    }
}
exports.RespondentTrackingService = RespondentTrackingService;
