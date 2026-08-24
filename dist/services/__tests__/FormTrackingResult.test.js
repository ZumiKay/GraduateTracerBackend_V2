"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockMinimalReq = exports.mockProxyReq = exports.mockMobileReq = exports.mockReq = exports.createMockRequest = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const RespondentTrackingService_1 = require("../RespondentTrackingService");
// Mock FormResponse model for database checks
jest.mock("../../model/Response.model");
const createMockRequest = (options = {}) => {
    const defaultHeaders = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "x-forwarded-for": "172.0.0.1",
        "x-real-ip": "172.0.0.1",
        "x-screen-resolution": "1920x1080",
        "x-timezone": "Asia/Bangkok",
        "x-platform": "MacIntel",
        ...(options.headers ?? {}),
    };
    return {
        headers: defaultHeaders,
        ip: options.ip ?? "172.0.0.1",
        socket: {
            remoteAddress: options.remoteAddress ?? "172.0.0.1",
        },
        connection: {
            remoteAddress: options.remoteAddress ?? "172.0.0.1",
        },
        session: options.sessionId ? { id: options.sessionId } : undefined,
        sessionID: options.sessionId,
        body: options.body ?? {},
        cookies: options.cookies ?? {},
    };
};
exports.createMockRequest = createMockRequest;
// Default mock request
exports.mockReq = (0, exports.createMockRequest)();
// Preset: Request from mobile device
exports.mockMobileReq = (0, exports.createMockRequest)({
    headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "accept-language": "th-TH,th;q=0.9,en;q=0.8",
        "x-screen-resolution": "390x844",
        "x-platform": "iPhone",
        "x-timezone": "Asia/Bangkok",
    },
    ip: "192.168.1.50",
    remoteAddress: "192.168.1.50",
});
// Preset: Request behind reverse proxy with multiple forwarded IPs
exports.mockProxyReq = (0, exports.createMockRequest)({
    headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
    },
});
// Preset: Request with minimal headers
exports.mockMinimalReq = (0, exports.createMockRequest)({
    headers: {
        "user-agent": "SimpleAgent/1.0",
        "accept-language": undefined,
        "accept-encoding": undefined,
        "x-forwarded-for": undefined,
        "x-real-ip": undefined,
        "x-screen-resolution": undefined,
        "x-timezone": undefined,
        "x-platform": undefined,
    },
    ip: undefined,
    remoteAddress: "10.0.0.1",
});
describe("RespondentTrackingService - Request Object & Tracking", () => {
    const formId = new mongoose_1.Types.ObjectId();
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe("generateTrackingData", () => {
        test("extracts IP and fingerprint data from mock request correctly", () => {
            const trackingData = RespondentTrackingService_1.RespondentTrackingService.generateTrackingData(exports.mockReq);
            expect(trackingData.ip).toBe("172.0.0.1");
            expect(trackingData.deviceInfo.userAgent).toContain("Mozilla/5.0");
            expect(trackingData.deviceInfo.acceptLanguage).toBe("en-US,en;q=0.9");
            expect(trackingData.deviceInfo.screen).toBe("1920x1080");
            expect(trackingData.deviceInfo.timezone).toBe("Asia/Bangkok");
            expect(trackingData.deviceInfo.platform).toBe("MacIntel");
            expect(trackingData.fingerprint).toBeDefined();
            expect(typeof trackingData.fingerprint).toBe("string");
            expect(trackingData.fingerprintStrength).toBeGreaterThan(0);
        });
        test("handles proxy forwarded IP correctly", () => {
            const trackingData = RespondentTrackingService_1.RespondentTrackingService.generateTrackingData(exports.mockProxyReq);
            // Should extract the first client IP in x-forwarded-for list
            expect(trackingData.ip).toBe("203.0.113.195");
        });
        test("handles mobile headers correctly", () => {
            const trackingData = RespondentTrackingService_1.RespondentTrackingService.generateTrackingData(exports.mockMobileReq);
            expect(trackingData.deviceInfo.platform).toBe("iPhone");
            expect(trackingData.deviceInfo.screen).toBe("390x844");
        });
    });
    describe("checkRespondentExists", () => {
        test("returns hasResponded with existing response details if matched", async () => {
            const mockResponseId = new mongoose_1.Types.ObjectId();
            Response_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: mockResponseId,
                    maxScore: 100,
                    totalScore: 85,
                }),
            });
            const trackingData = RespondentTrackingService_1.RespondentTrackingService.generateTrackingData(exports.mockReq);
            const result = await RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists({
                formId,
                respondentIP: trackingData.ip,
                respondentFingerprint: trackingData.fingerprint,
                respondentEmail: "test@example.com",
            });
            expect(result.hasResponded).toBeDefined();
            expect(result.hasResponded?.responseId).toBe(mockResponseId.toString());
            expect(result.hasResponded?.totalScore).toBe(85);
            expect(result.hasResponded?.message).toBe("You already submitted response");
        });
        test("returns undefined hasResponded if no match found", async () => {
            Response_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            const result = await RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists({
                formId,
                respondentEmail: "newuser@example.com",
            });
            expect(result.hasResponded).toBeUndefined();
        });
        test("returns undefined hasResponded if no tracking identifiers are provided", async () => {
            const result = await RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists({
                formId,
            });
            expect(result.hasResponded).toBeUndefined();
            expect(Response_model_1.default.findOne).not.toHaveBeenCalled();
        });
    });
});
