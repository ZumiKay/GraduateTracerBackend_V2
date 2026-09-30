"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const formsession_controller_1 = __importDefault(require("../formsession.controller"));
const Formsession_model_1 = __importDefault(require("../../../model/Formsession.model"));
const mongoose_1 = require("mongoose");
jest.mock("../../../model/Formsession.model");
jest.mock("../../../model/Form.model");
describe("Formsession Edge Case & Replay Protection Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockClearCookie;
    let mockCookie;
    const validCode = "removal_code_123456";
    const validSessionId = new mongoose_1.Types.ObjectId().toString();
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.RESPONDENT_TOKEN_JWT_SECRET = "test_respondent_jwt_secret_key";
        process.env.ACCESS_RESPONDENT_COOKIE = "access_resp_cookie";
        process.env.RESPONDENT_COOKIE = "refresh_resp_cookie";
        mockJson = jest.fn();
        mockClearCookie = jest.fn();
        mockCookie = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
            clearCookie: mockClearCookie,
            cookie: mockCookie,
        };
    });
    describe("ReplaceSession", () => {
        test("returns 500 if critical environment variables are missing", async () => {
            delete process.env.RESPONDENT_TOKEN_JWT_SECRET;
            mockReq = { params: { code: validCode } };
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: "MISSING_ENV_VARIABLES" }));
        });
        test("returns 404 if code param is missing", async () => {
            mockReq = { params: {} };
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 403 when verifying a code that does not exist (?verify=1)", async () => {
            mockReq = {
                params: { code: "non-existent-code" },
                query: { verify: "1" },
            };
            Formsession_model_1.default.countDocuments.mockResolvedValue(0);
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("returns 200 when verifying a code that exists (?verify=1)", async () => {
            mockReq = {
                params: { code: validCode },
                query: { verify: "1" },
            };
            Formsession_model_1.default.countDocuments.mockResolvedValue(1);
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
        });
        test("returns 404 if removal code is invalid", async () => {
            mockReq = {
                params: { code: "consumed-code" },
                query: {},
            };
            Formsession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(null),
                        }),
                    }),
                }),
            });
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid code" }));
        });
        test("returns 404 if the form is closed (acceptResponses = false)", async () => {
            mockReq = {
                params: { code: validCode },
                query: {},
            };
            const mockSession = {
                _id: validSessionId,
                form: { setting: { acceptResponses: false } },
            };
            Formsession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(mockSession),
                        }),
                    }),
                }),
            });
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Form is closed" }));
        });
        test("consumes removal code with ?skiplogin=1, deletes session, and clears cookies", async () => {
            mockReq = {
                params: { code: validCode },
                query: { skiplogin: "1" },
            };
            const mockSession = {
                _id: validSessionId,
                form: { setting: { acceptResponses: true } },
            };
            Formsession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(mockSession),
                        }),
                    }),
                }),
            });
            Formsession_model_1.default.deleteOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ acknowledged: true }),
            });
            await formsession_controller_1.default.ReplaceSession(mockReq, mockRes);
            expect(Formsession_model_1.default.deleteOne).toHaveBeenCalledWith({
                _id: validSessionId,
            });
            expect(mockClearCookie).toHaveBeenCalledWith("refresh_resp_cookie", expect.any(Object));
            expect(mockClearCookie).toHaveBeenCalledWith("access_resp_cookie", expect.any(Object));
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Session Terminated" }));
        });
    });
    describe("SignOut", () => {
        test("clears cookies and removes formsession from database", async () => {
            mockReq = {
                formsession: {
                    sub: validSessionId,
                },
            };
            Formsession_model_1.default.deleteOne.mockResolvedValue({
                acknowledged: true,
            });
            await formsession_controller_1.default.SignOut(mockReq, mockRes);
            expect(Formsession_model_1.default.deleteOne).toHaveBeenCalledWith({
                session_id: validSessionId,
            });
            expect(mockClearCookie).toHaveBeenCalledTimes(2);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Logged Out" }));
        });
    });
});
