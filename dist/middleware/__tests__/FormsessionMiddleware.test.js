"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const customType_1 = require("../../types/customType");
const Formsession_middleware_1 = __importDefault(require("../Formsession.middleware"));
const User_model_1 = require("../../model/User.model");
const mongoose_1 = require("mongoose");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const helper_1 = require("../../utilities/helper");
const Formsession_model_1 = __importDefault(require("../../model/Formsession.model"));
const FormLinkService_test_1 = require("../../services/__tests__/FormLinkService.test");
const User_middleware_1 = require("../User.middleware");
jest.mock("../../model/Formsession.model");
jest.mock("../../model/Form.model");
describe("Formsession mideleware test", () => {
    let mockedReq;
    let mockRes;
    let nextFun;
    let sampleActiveSession;
    const originalEnv = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            RESPONDENT_TOKEN_JWT_SECRET: "verysecret",
            RESPONDENT_COOKIE: "refreshFormCookie",
            ACCESS_RESPONDENT_COOKIE: "accessFormCookie",
        };
        //Request obj mocks
        nextFun = jest.fn();
        mockedReq = {
            body: {},
            cookies: {},
            params: {
                formId: new mongoose_1.Types.ObjectId().toString(),
            },
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            clearCookie: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
        };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    describe("VerifyFormsession method", () => {
        const mockFormReq = ({ form, sampleSession, }) => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(form),
                }),
            });
            sampleSession &&
                Formsession_model_1.default.findOne.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(sampleSession),
                });
        };
        const sampleForm = {
            _id: mockedReq?.params?.formId,
            type: Form_model_1.TypeForm.Quiz,
            setting: {
                email: true,
                acceptResponses: true,
            },
        };
        test("status 500 if missing env", async () => {
            process.env = {
                ...originalEnv,
                RESPONDENT_COOKIE: undefined,
                ACCESS_RESPONDENT_COOKIE: undefined,
            };
            await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.missingCookieConfig());
        });
        test("status 400 if formId is invalid", async () => {
            mockedReq = {
                ...mockedReq,
                params: {
                    formId: "invalidFormId",
                },
            };
            await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.invalidFormId());
        });
        test("status 500 with DB Errors", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockRejectedValue(new Error("Error DB")),
                }),
            });
            await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.internalServerError());
        });
        test("return status 401 and delete formsession if the session token is invalid", async () => {
            const sampleExpiredToken = (0, helper_1.GenerateToken)({ role: User_model_1.ROLE.USER }, -1, process.env.RESPONDENT_TOKEN_JWT_SECRET);
            const accessToken = (0, helper_1.GenerateToken)({ role: User_model_1.ROLE.USER }, "1h", process.env.RESPONDENT_TOKEN_JWT_SECRET);
            mockedReq = {
                ...mockedReq,
                cookies: {
                    [process.env.RESPONDENT_COOKIE]: sampleExpiredToken,
                    [process.env.ACCESS_RESPONDENT_COOKIE]: accessToken,
                },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(sampleForm),
                }),
            });
            Formsession_model_1.default.deleteOne.mockResolvedValue({});
            await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.invalidSessionToken());
            expect(Formsession_model_1.default.deleteOne).toHaveBeenCalledWith({
                session_id: sampleExpiredToken,
            });
        });
        describe("Renew Access Token", () => {
            beforeEach(() => {
                //Mock 1hr expire cookie
                mockedReq = {
                    ...mockedReq,
                    cookies: {
                        [process.env.RESPONDENT_COOKIE]: (0, helper_1.GenerateToken)({ role: User_model_1.ROLE.USER }, "1h", process.env.RESPONDENT_TOKEN_JWT_SECRET),
                        [process.env.ACCESS_RESPONDENT_COOKIE]: (0, helper_1.GenerateToken)({ role: User_model_1.ROLE.USER }, -1, process.env.RESPONDENT_TOKEN_JWT_SECRET),
                    },
                };
                mockRes = {
                    ...mockRes,
                    clearCookie: jest.fn().mockReturnThis(),
                    cookie: jest.fn(),
                };
                sampleActiveSession = {
                    form: sampleForm._id,
                    session_id: mockedReq?.cookies?.[process.env.RESPONDENT_COOKIE],
                    access_id: mockedReq?.cookies?.[process.env.ACCESS_RESPONDENT_COOKIE],
                    expiredAt: new Date((0, FormLinkService_test_1.generateExpirationDate)({ hours: 1 })),
                    respondentEmail: "test@example.com",
                };
            });
            test("should clear Cookie if invalid session", async () => {
                Form_model_1.default.findById.mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(sampleForm),
                    }),
                });
                Formsession_model_1.default.findOne.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                });
                await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
                expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.sessionNotFound());
            });
            test("shoud return status 500 if the renew token failed", async () => {
                mockFormReq({
                    form: sampleForm,
                    sampleSession: sampleActiveSession,
                });
                Formsession_model_1.default.updateOne.mockRejectedValue(new Error("Error Update AccessToken"));
                await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
                expect(mockRes.status).toHaveBeenCalledWith(500);
                expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.tokenRenewalError());
            });
            test("should renew the token correctly if the accesstoken is expired and called next()", async () => {
                //mock valid session
                const sampleActiveSession = {
                    form: sampleForm._id,
                    session_id: mockedReq?.cookies?.[process.env.RESPONDENT_COOKIE],
                    access_id: mockedReq?.cookies?.[process.env.ACCESS_RESPONDENT_COOKIE],
                    expiredAt: new Date((0, FormLinkService_test_1.generateExpirationDate)({ hours: 1 })),
                    respondentEmail: "test@example.com",
                };
                mockFormReq({
                    form: sampleForm,
                    sampleSession: sampleActiveSession,
                });
                //Mock db req
                Formsession_model_1.default.updateOne.mockResolvedValue({});
                Formsession_model_1.default.exists.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                });
                await Formsession_middleware_1.default.VerifyFormsession(mockedReq, mockRes, nextFun);
                expect(mockedReq.formsession).toBeDefined();
                expect(mockedReq.formsession?.sub).toBeDefined();
                expect(mockedReq.formsession?.access_token).toBeDefined();
                expect(mockedReq.formsession?.access_payload).toBeDefined();
                expect(mockRes.cookie).toHaveBeenCalled();
                expect(nextFun).toHaveBeenCalled();
            });
        });
    });
    describe("Verify Respondent FormSessionData Method", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mockedReq = {
                ...mockedReq,
                query: {
                    ty: User_middleware_1.GetPublicFormDataTyEnum.initial,
                },
            };
        });
        test("return status 400 if it formId is invalid", async () => {
            mockedReq = {
                ...mockedReq,
                params: {
                    formId: "')'or'')(')",
                },
            };
            await Formsession_middleware_1.default.VerifyRespondentFormSessionData(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(customType_1.RESPONSES.missingFormId());
        });
        describe("verify for public form getData (ty = 'initial') '", () => {
            test("isLoggedIn undefined call next()", async () => {
                await Formsession_middleware_1.default.VerifyRespondentFormSessionData(mockedReq, mockRes, nextFun);
                expect(nextFun).toHaveBeenCalled();
                expect(nextFun).toHaveBeenCalledTimes(1);
            });
        });
    });
});
