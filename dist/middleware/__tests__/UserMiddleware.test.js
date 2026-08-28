"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const User_middleware_1 = __importDefault(require("../User.middleware"));
const User_model_1 = require("../../model/User.model");
const helper_1 = require("../../utilities/helper");
const Usersession_model_1 = __importDefault(require("../../model/Usersession.model"));
const authenication_controller_1 = __importDefault(require("../../controller/auth/authenication.controller"));
const mongoose_1 = require("mongoose");
jest.mock("../../model/Usersession.model");
jest.mock("../../controller/auth/authenication.controller");
describe("UserMiddleware Unit Tests", () => {
    let errorSpy;
    let mockedReq;
    let mockRes;
    let nextFun;
    const originalEnv = process.env;
    const sampleUser = {
        sub: new mongoose_1.Types.ObjectId().toString(),
        role: User_model_1.ROLE.USER,
        email: "testuser@example.com",
    };
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            JWT_SECRET: "testjwtsecret",
            ACCESS_TOKEN_COOKIE: "access_token",
            REFRESH_TOKEN_COOKIE: "refresh_token",
        };
        nextFun = jest.fn();
        mockedReq = {
            body: {},
            cookies: {},
            params: {},
            query: {},
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            clearCookie: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
        };
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    describe("VerifyToken", () => {
        test("should return 500 when required environment variables are missing", async () => {
            process.env = {
                ...originalEnv,
                JWT_SECRET: undefined,
            };
            await User_middleware_1.default.VerifyToken(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "TOKEN_INVALID",
                message: "Missing required environment variables",
            });
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 401 when access token is missing from cookies", async () => {
            mockedReq.cookies = {};
            await User_middleware_1.default.VerifyToken(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "TOKEN_MISSING",
                message: "No access token provided",
            });
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 401 with shouldRefresh flag when access token is expired", async () => {
            const expiredAccessToken = (0, helper_1.GenerateToken)(sampleUser, -1, process.env.JWT_SECRET);
            mockedReq.cookies = {
                [process.env.ACCESS_TOKEN_COOKIE]: expiredAccessToken,
            };
            await User_middleware_1.default.VerifyToken(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "TOKEN_EXPIRED",
                message: "Access token expired",
                shouldRefresh: true,
            });
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should clear cookie and return 403 when access token is invalid / malformed", async () => {
            mockedReq.cookies = {
                [process.env.ACCESS_TOKEN_COOKIE]: "invalid.token.structure",
            };
            await User_middleware_1.default.VerifyToken(mockedReq, mockRes, nextFun);
            expect(authenication_controller_1.default.clearAccessTokenCookie).toHaveBeenCalledWith(mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: "TOKEN_INVALID",
                message: "Invalid access token",
            });
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should attach decoded user payload to req.user and call next() when access token is valid", async () => {
            const validAccessToken = (0, helper_1.GenerateToken)(sampleUser, "30m", process.env.JWT_SECRET);
            mockedReq.cookies = {
                [process.env.ACCESS_TOKEN_COOKIE]: validAccessToken,
            };
            await User_middleware_1.default.VerifyToken(mockedReq, mockRes, nextFun);
            expect(mockedReq.user).toBeDefined();
            expect(mockedReq.user?.sub).toBe(sampleUser.sub);
            expect(mockedReq.user?.role).toBe(sampleUser.role);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(nextFun).toHaveBeenCalled();
        });
    });
    describe("VerifyRefreshToken", () => {
        test("should return 401 when refresh token is missing from cookies", async () => {
            mockedReq.cookies = {};
            await User_middleware_1.default.VerifyRefreshToken(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(401, "No refresh token provided"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should delete session, clear refresh cookie, and return 401 when refresh token signature is invalid", async () => {
            const invalidRefreshToken = "invalid.refresh.token";
            mockedReq.cookies = {
                [process.env.REFRESH_TOKEN_COOKIE]: invalidRefreshToken,
            };
            Usersession_model_1.default.deleteOne.mockResolvedValue({});
            await User_middleware_1.default.VerifyRefreshToken(mockedReq, mockRes, nextFun);
            expect(Usersession_model_1.default.deleteOne).toHaveBeenCalledWith({
                session_id: invalidRefreshToken,
            });
            expect(authenication_controller_1.default.clearRefreshTokenCookie).toHaveBeenCalledWith(mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(401, "Invalid refresh token"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 403 when refresh token is valid JWT but session is expired or not found in database", async () => {
            const validRefreshToken = (0, helper_1.GenerateToken)(sampleUser, "7d", process.env.JWT_SECRET);
            mockedReq.cookies = {
                [process.env.REFRESH_TOKEN_COOKIE]: validRefreshToken,
            };
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            await User_middleware_1.default.VerifyRefreshToken(mockedReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(403, "Session expired or invalid"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should attach req.session and req.user and call next() when refresh token and DB session are valid", async () => {
            const validRefreshToken = (0, helper_1.GenerateToken)(sampleUser, "7d", process.env.JWT_SECRET);
            mockedReq.cookies = {
                [process.env.REFRESH_TOKEN_COOKIE]: validRefreshToken,
            };
            const mockDbSession = {
                _id: new mongoose_1.Types.ObjectId(),
                session_id: validRefreshToken,
                expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
                user: {
                    _id: sampleUser.sub,
                    email: sampleUser.email,
                    role: sampleUser.role,
                },
            };
            Usersession_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockDbSession),
            });
            await User_middleware_1.default.VerifyRefreshToken(mockedReq, mockRes, nextFun);
            expect(mockedReq.session).toEqual(mockDbSession);
            expect(mockedReq.user).toEqual(mockDbSession.user);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(nextFun).toHaveBeenCalled();
        });
    });
});
