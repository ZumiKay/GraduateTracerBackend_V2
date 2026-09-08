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
const supertest_1 = __importDefault(require("supertest"));
const User_model_1 = __importStar(require("../../../model/User.model"));
const app_1 = __importDefault(require("../../../app"));
const helper_1 = require("../../../utilities/helper");
const bcrypt_1 = __importDefault(require("bcrypt"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
const email_1 = __importDefault(require("../../../utilities/email"));
const sessionCache_1 = __importDefault(require("../../../utilities/sessionCache"));
// Mocked modules
jest.mock("../../../database", () => jest.fn());
jest.mock("../../../model/User.model");
jest.mock("../../../model/Usersession.model");
jest.mock("bcrypt");
jest.mock("../../../utilities/email");
jest.mock("../../../middleware/Traffic.middleware", () => ({
    __esModule: true,
    default: {
        LoginRateLimit: (req, res, next) => next(),
        ApiRateLimit: (req, res, next) => next(),
        PasswordResetRateLimit: (req, res, next) => next(),
        Ratelimit: (req, res, next) => next(),
    },
}));
describe("Authentications Route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionCache_1.default.clear();
        bcrypt_1.default.genSaltSync.mockReturnValue("salt");
        bcrypt_1.default.hashSync.mockReturnValue("hashedpassword");
    });
    describe("/registeruser", () => {
        test("200 status", async () => {
            const sampleRegisterUserdata = {
                email: "test@example.com",
                name: "testname",
                password: "pass@11223345",
                role: User_model_1.ROLE.USER,
            };
            User_model_1.default.findOne.mockResolvedValue(null);
            User_model_1.default.create.mockResolvedValue(sampleRegisterUserdata);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleRegisterUserdata)
                .set("Accept", "application/json");
            expect(superTest.status).toBe(201);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(201, "User registered"));
        });
        test("400 status on invalid body validation", async () => {
            const sampleRegisterUserdata = {
                email: "')01029302@@@@@@@@@@@@g.com",
                name: "testname",
                password: "pass@11223345",
                role: User_model_1.ROLE.USER,
            };
            User_model_1.default.findOne.mockResolvedValue(null);
            User_model_1.default.create.mockResolvedValue(sampleRegisterUserdata);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleRegisterUserdata)
                .set("Accept", "application/json");
            expect(superTest.status).toBe(400);
            expect(superTest.body?.errors).toBeDefined();
        });
        test("400 status when username or email already exists", async () => {
            const sampleRegisterUserdata = {
                email: "existing@example.com",
                name: "existinguser",
                password: "pass@11223345",
                role: User_model_1.ROLE.USER,
            };
            User_model_1.default.findOne.mockResolvedValue(sampleRegisterUserdata);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleRegisterUserdata)
                .set("Accept", "application/json");
            expect(superTest.status).toBe(400);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(400, "Username or email already exist"));
        });
    });
    describe("/login", () => {
        let sampleUser = {};
        beforeEach(() => {
            sampleUser = {
                email: "test@example.com",
                name: "testuser",
                role: User_model_1.ROLE.USER,
                password: "hashedpassword",
            };
        });
        test("200 status on successful login", async () => {
            User_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(sampleUser),
                }),
            });
            bcrypt_1.default.compareSync.mockReturnValue(true);
            Usersession_model_1.default.create.mockResolvedValue({});
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUser.email,
                password: "pass@12345",
                rememberMe: true,
            });
            expect(superTest.status).toBe(200);
            expect(superTest.header?.["set-cookie"]).toBeDefined();
            expect(superTest.body.data).toBeDefined();
        });
        test("404 status when user does not exist", async () => {
            User_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: "notfound@example.com",
                password: "pass@12345",
            });
            expect(superTest.status).toBe(404);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
        });
        test("404 status when password does not match", async () => {
            User_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(sampleUser),
                }),
            });
            bcrypt_1.default.compareSync.mockReturnValue(false);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUser.email,
                password: "wrongpass@12345",
            });
            expect(superTest.status).toBe(404);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
        });
        test("400 status when payload validation fails", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: "invalid-email-format",
                password: "short",
            });
            expect(superTest.status).toBe(400);
            expect(superTest.body?.errors).toBeDefined();
        });
    });
    describe("/checksession", () => {
        test("200 status when valid session exists in database", async () => {
            const refreshToken = "valid_refresh_token";
            const expireDate = (0, helper_1.getDateByNumDay)(7);
            const mockSession = {
                _id: "session_123",
                session_id: refreshToken,
                expireAt: expireDate,
                user: {
                    _id: "user_123",
                    email: "test@example.com",
                    name: "testuser",
                    role: User_model_1.ROLE.USER,
                },
            };
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(mockSession),
                        }),
                    }),
                }),
            });
            Usersession_model_1.default.deleteMany.mockReturnValue({
                exec: jest.fn().mockResolvedValue({}),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);
            expect(superTest.status).toBe(200);
            expect(superTest.body.data).toBeDefined();
            expect(superTest.body.data.isAuthenticated).toBe(true);
            expect(superTest.body.data.user.email).toBe("test@example.com");
        });
        test("200 status when session exists in cache", async () => {
            const refreshToken = "cached_refresh_token";
            sessionCache_1.default.set(refreshToken, {
                userId: "user_cached_123",
                email: "cached@example.com",
                name: "cacheduser",
                role: User_model_1.ROLE.USER,
                expiresAt: new Date().toISOString(),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);
            expect(superTest.status).toBe(200);
            expect(superTest.body.data.isAuthenticated).toBe(true);
            expect(superTest.body.data.user.email).toBe("cached@example.com");
            expect(Usersession_model_1.default.findOne).not.toHaveBeenCalled();
        });
        test("401 status when refresh token cookie is missing", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default).get(process.env.API_BASEURL + "/checksession");
            expect(superTest.status).toBe(401);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(401, "No session found"));
        });
        test("401 status when session is expired or not found in database", async () => {
            const refreshToken = "expired_refresh_token";
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        lean: jest.fn().mockReturnValue({
                            exec: jest.fn().mockResolvedValue(null),
                        }),
                    }),
                }),
            });
            Usersession_model_1.default.deleteMany.mockReturnValue({
                exec: jest.fn().mockResolvedValue({}),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);
            expect(superTest.status).toBe(401);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(401, "Session expired"));
        });
    });
    describe("/logout", () => {
        test("200 status when refresh token cookie is provided", async () => {
            const refreshToken = "logout_refresh_token";
            Usersession_model_1.default.deleteOne.mockResolvedValue({});
            const superTest = await (0, supertest_1.default)(app_1.default)
                .delete(process.env.API_BASEURL + "/logout")
                .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);
            expect(superTest.status).toBe(200);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(200));
            expect(Usersession_model_1.default.deleteOne).toHaveBeenCalledWith({
                session_id: refreshToken,
            });
        });
        test("204 status when refresh token cookie is missing", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default).delete(process.env.API_BASEURL + "/logout");
            expect(superTest.status).toBe(204);
        });
    });
    describe("/refreshtoken", () => {
        test("200 status when valid refresh token is provided", async () => {
            const validTokenPayload = {
                sub: "user_123",
                role: User_model_1.ROLE.USER,
            };
            const validRefreshToken = (0, helper_1.GenerateToken)(validTokenPayload, "7d");
            const mockSession = {
                _id: "session_123",
                session_id: validRefreshToken,
                expireAt: (0, helper_1.getDateByNumDay)(7),
                user: {
                    _id: "user_123",
                    email: "test@example.com",
                    role: User_model_1.ROLE.USER,
                },
            };
            const mockPopulateResult = {
                ...mockSession,
                exec: jest.fn().mockResolvedValue(mockSession),
                then: (resolve, reject) => Promise.resolve(mockSession).then(resolve, reject),
            };
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue(mockPopulateResult),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/refreshtoken")
                .set("Cookie", [
                `${process.env.REFRESH_TOKEN_COOKIE}=${validRefreshToken}`,
            ]);
            expect(superTest.status).toBe(200);
            expect(superTest.header?.["set-cookie"]).toBeDefined();
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(200));
        });
        test("401 status when refresh token cookie is missing", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default).post(process.env.API_BASEURL + "/refreshtoken");
            expect(superTest.status).toBe(401);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(401, "No refresh token provided"));
        });
        test("401 status when refresh token is invalid", async () => {
            Usersession_model_1.default.deleteOne.mockResolvedValue({});
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/refreshtoken")
                .set("Cookie", [
                `${process.env.REFRESH_TOKEN_COOKIE}=invalid_refresh_token`,
            ]);
            expect(superTest.status).toBe(401);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(401, "Invalid refresh token"));
        });
        test("403 status when session is expired or not found in database", async () => {
            const validTokenPayload = {
                sub: "user_123",
                role: User_model_1.ROLE.USER,
            };
            const validRefreshToken = (0, helper_1.GenerateToken)(validTokenPayload, "7d");
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/refreshtoken")
                .set("Cookie", [
                `${process.env.REFRESH_TOKEN_COOKIE}=${validRefreshToken}`,
            ]);
            expect(superTest.status).toBe(403);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(403, "Session expired or invalid"));
        });
    });
    describe("/forgotpassword", () => {
        test("200 status for ty: 'vfy' when verification code is sent via email", async () => {
            User_model_1.default.findOne.mockResolvedValue(null);
            User_model_1.default.findOneAndUpdate.mockResolvedValue({});
            email_1.default.mockResolvedValue({
                success: true,
                message: "Email sent successfully",
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "vfy",
                email: "test@example.com",
                html: "Your reset code is: $code$",
            });
            expect(superTest.status).toBe(200);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(200));
            expect(email_1.default).toHaveBeenCalledWith("test@example.com", "Reset Password", expect.stringMatching(/Your reset code is: \d{6}/));
        });
        test("500 status for ty: 'vfy' when email sending fails", async () => {
            User_model_1.default.findOne.mockResolvedValue(null);
            User_model_1.default.findOneAndUpdate.mockResolvedValue({});
            email_1.default.mockResolvedValue({
                success: false,
                message: "SMTP error",
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "vfy",
                email: "test@example.com",
                html: "Your reset code is: $code$",
            });
            expect(superTest.status).toBe(500);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(500, "Fail to send email"));
        });
        test("400 status for ty: 'vfy' when email is missing", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "vfy",
                html: "Your reset code is: $code$",
            });
            expect(superTest.status).toBe(400);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(400));
        });
        test("200 status for ty: 'confirm' when code is valid", async () => {
            User_model_1.default.findOneAndUpdate.mockResolvedValue({
                _id: "user_123",
                email: "test@example.com",
            });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "confirm",
                code: "123456",
            });
            expect(superTest.status).toBe(200);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(200));
            expect(User_model_1.default.findOneAndUpdate).toHaveBeenCalledWith({ code: "123456" }, { code: null });
        });
        test("404 status for ty: 'confirm' when code is invalid", async () => {
            User_model_1.default.findOneAndUpdate.mockResolvedValue(null);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "confirm",
                code: "invalid_code",
            });
            expect(superTest.status).toBe(404);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Invalid Code"));
        });
        test("200 status for ty: 'change' when password is provided", async () => {
            User_model_1.default.updateOne.mockResolvedValue({ modifiedCount: 1 });
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "change",
                email: "test@example.com",
                password: "NewPassword@123",
            });
            expect(superTest.status).toBe(200);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(200));
            expect(User_model_1.default.updateOne).toHaveBeenCalledWith({ email: "test@example.com" }, { password: expect.any(String) });
        });
        test("400 status for ty: 'change' when password is missing", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "change",
                email: "test@example.com",
            });
            expect(superTest.status).toBe(400);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(400));
        });
        test("400 status when invalid request type is provided", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "invalid_ty",
            });
            expect(superTest.status).toBe(400);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(400, "Invalid request type"));
        });
    });
});
