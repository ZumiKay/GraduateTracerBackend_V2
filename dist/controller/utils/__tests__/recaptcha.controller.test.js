"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const recaptcha_controller_1 = __importDefault(require("../recaptcha.controller"));
describe("VerifyRecaptcha Edge Case & Resilience Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    const originalFetch = global.fetch;
    beforeEach(() => {
        jest.clearAllMocks();
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
        };
        process.env.RECAPCHA_SECRETKEY = "test_recaptcha_secret_key";
        process.env.RECAPCHA_URL = "https://www.google.com/recaptcha/api/siteverify";
    });
    afterAll(() => {
        global.fetch = originalFetch;
    });
    test("accepts verification when score is exactly at threshold 0.50", async () => {
        mockReq = { body: { token: "valid-token-exact-threshold" } };
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                success: true,
                score: 0.5,
            }),
        });
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ code: 200 }));
    });
    test("accepts verification when score is well above threshold (0.9)", async () => {
        mockReq = { body: { token: "high-score-token" } };
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                success: true,
                score: 0.9,
            }),
        });
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(200);
    });
    test("rejects verification with 400 when score is just below threshold (0.49)", async () => {
        mockReq = { body: { token: "low-score-token" } };
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                success: true,
                score: 0.49,
                "error-codes": ["low-score"],
            }),
        });
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            code: 400,
            errors: ["low-score"],
        }));
    });
    test("rejects verification with 400 when Google returns success false with error codes", async () => {
        mockReq = { body: { token: "invalid-token" } };
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                success: false,
                "error-codes": ["invalid-input-response", "timeout-or-duplicate"],
            }),
        });
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
            code: 400,
            errors: ["invalid-input-response", "timeout-or-duplicate"],
        }));
    });
    test("handles  network outage / timeout with 500", async () => {
        mockReq = { body: { token: "any-token" } };
        global.fetch = jest
            .fn()
            .mockRejectedValue(new Error("ETIMEDOUT: Google endpoint unreachable"));
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ code: 500 }));
    });
    test("handles missing token", async () => {
        mockReq = { body: {} };
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                success: false,
                "error-codes": ["missing-input-response"],
            }),
        });
        await (0, recaptcha_controller_1.default)(mockReq, mockRes);
        expect(mockStatus).toHaveBeenCalledWith(400);
    });
});
