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
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("../../../app"));
const User_model_1 = __importStar(require("../../../model/User.model"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
const sessionCache_1 = __importDefault(require("../../../utilities/sessionCache"));
const email_1 = __importDefault(require("../../../utilities/email"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const helper_1 = require("../../../utilities/helper");
// Mock email utility to prevent sending actual external emails during tests
jest.mock("../../../utilities/email", () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue({
        success: true,
        message: "Email sent successfully",
    }),
}));
// Mock traffic rate limits for fast integration test execution
jest.mock("../../../middleware/Traffic.middleware", () => ({
    __esModule: true,
    default: {
        LoginRateLimit: (req, res, next) => next(),
        ApiRateLimit: (req, res, next) => next(),
        PasswordResetRateLimit: (req, res, next) => next(),
        Ratelimit: (req, res, next) => next(),
    },
}));
describe("Authentication Controller - Docker Integration Tests", () => {
    const dbUri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/graduatetracer_test";
    beforeAll(async () => {
        // Ensure mongoose is connected to the test database
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(dbUri);
        }
    });
    afterAll(async () => {
        // Clean up collections and close database connection
        if (mongoose_1.default.connection.readyState !== 0) {
            await User_model_1.default.deleteMany({});
            await Usersession_model_1.default.deleteMany({});
            await mongoose_1.default.connection.close();
        }
    });
    beforeEach(async () => {
        sessionCache_1.default.clear();
        jest.clearAllMocks();
        if (mongoose_1.default.connection.readyState !== 0) {
            await User_model_1.default.deleteMany({});
            await Usersession_model_1.default.deleteMany({});
        }
    });
    const sampleUserData = {
        email: "integration_user@example.com",
        name: "integration_user",
        password: "Password@12345",
        role: User_model_1.ROLE.USER,
    };
    describe("POST /registeruser - Real Database Registration", () => {
        test("successfully creates a new user document in MongoDB with hashed password", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData)
                .set("Accept", "application/json");
            expect(res.status).toBe(201);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(201, "User registered"));
            // Verify document in MongoDB
            const savedUser = await User_model_1.default.findOne({ email: sampleUserData.email });
            expect(savedUser).not.toBeNull();
            expect(savedUser?.name).toBe(sampleUserData.name);
            expect(savedUser?.role).toBe(User_model_1.ROLE.USER);
            expect(savedUser?.password).not.toBe(sampleUserData.password);
            expect(bcrypt_1.default.compareSync(sampleUserData.password, savedUser.password)).toBe(true);
        });
        test("prevents duplicate registration with 400 when email and name already exist", async () => {
            // First registration
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
            // Duplicate registration attempt
            const duplicateRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
            expect(duplicateRes.status).toBe(400);
            expect(duplicateRes.body).toStrictEqual((0, helper_1.ReturnCode)(400, "Username or email already exist"));
            const userCount = await User_model_1.default.countDocuments({
                email: sampleUserData.email,
            });
            expect(userCount).toBe(1);
        });
    });
    describe("POST /login & Session Lifecycle", () => {
        beforeEach(async () => {
            // Register test user directly via API
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
        });
        test("logs in with valid credentials, sets cookies, and creates Usersession in MongoDB", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: sampleUserData.password,
                rememberMe: true,
            });
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.email).toBe(sampleUserData.email);
            expect(res.headers["set-cookie"]).toBeDefined();
            const cookies = res.headers["set-cookie"];
            const refreshCookieName = process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
            const refreshTokenCookie = cookies.find((c) => c.startsWith(`${refreshCookieName}=`));
            expect(refreshTokenCookie).toBeDefined();
            // Extract raw token value
            const refreshToken = refreshTokenCookie?.split(";")[0].split("=")[1];
            expect(refreshToken).toBeDefined();
            // Verify Usersession exists in MongoDB
            const dbSession = await Usersession_model_1.default.findOne({ session_id: refreshToken });
            expect(dbSession).not.toBeNull();
            expect(dbSession?.user).toBeDefined();
        });
        test("returns 404 on incorrect password", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: "WrongPassword@999",
            });
            expect(res.status).toBe(404);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
            const sessionCount = await Usersession_model_1.default.countDocuments({});
            expect(sessionCount).toBe(0);
        });
        test("returns 404 on non-existent user", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: "nonexistent@example.com",
                password: "Password@12345",
            });
            expect(res.status).toBe(404);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
        });
    });
    describe("GET /checksession - End-to-End Session Verification", () => {
        let refreshCookieHeader;
        beforeEach(async () => {
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
            const loginRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: sampleUserData.password,
                rememberMe: true,
            });
            const cookies = loginRes.headers["set-cookie"];
            const refreshCookieName = process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
            refreshCookieHeader = cookies.find((c) => c.startsWith(`${refreshCookieName}=`));
        });
        test("returns 200 with user profile when valid session cookie is provided", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [refreshCookieHeader]);
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.isAuthenticated).toBe(true);
            expect(res.body.data.user.email).toBe(sampleUserData.email);
        });
        test("returns 401 when session cookie is missing", async () => {
            const res = await (0, supertest_1.default)(app_1.default).get(process.env.API_BASEURL + "/checksession");
            expect(res.status).toBe(401);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(401, "No session found"));
        });
        test("returns 401 when session has been removed from database", async () => {
            sessionCache_1.default.clear();
            await Usersession_model_1.default.deleteMany({});
            const res = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [refreshCookieHeader]);
            expect(res.status).toBe(401);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(401, "Session expired"));
        });
    });
    describe("POST /refreshtoken - Real Token Rotation", () => {
        let refreshCookieHeader;
        beforeEach(async () => {
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
            const loginRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: sampleUserData.password,
                rememberMe: true,
            });
            const cookies = loginRes.headers["set-cookie"];
            const refreshCookieName = process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
            refreshCookieHeader = cookies.find((c) => c.startsWith(`${refreshCookieName}=`));
        });
        test("successfully issues new access token cookie when valid refresh token provided", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/refreshtoken")
                .set("Cookie", [refreshCookieHeader]);
            expect(res.status).toBe(200);
            expect(res.headers["set-cookie"]).toBeDefined();
            const cookies = res.headers["set-cookie"];
            const accessCookieName = process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT";
            const hasAccessToken = cookies.some((c) => c.startsWith(`${accessCookieName}=`));
            expect(hasAccessToken).toBe(true);
        });
        test("returns 401 when refresh token cookie is absent", async () => {
            const res = await (0, supertest_1.default)(app_1.default).post(process.env.API_BASEURL + "/refreshtoken");
            expect(res.status).toBe(401);
            expect(res.body).toStrictEqual((0, helper_1.ReturnCode)(401, "No refresh token provided"));
        });
    });
    describe("PUT /forgotpassword - Full Reset Flow in MongoDB", () => {
        beforeEach(async () => {
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
        });
        test("executes complete reset flow: verify code -> confirm code -> change password -> login with new password", async () => {
            // Step 1: Request reset code (vfy)
            const vfyRes = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "vfy",
                email: sampleUserData.email,
                html: "Your reset code is $code$",
            });
            expect(vfyRes.status).toBe(200);
            expect(email_1.default).toHaveBeenCalled();
            // Retrieve generated code from database
            const userWithCode = await User_model_1.default.findOne({ email: sampleUserData.email });
            expect(userWithCode?.code).toBeDefined();
            const resetCode = String(userWithCode.code);
            // Step 2: Confirm reset code (confirm)
            const confirmRes = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "confirm",
                code: resetCode,
            });
            expect(confirmRes.status).toBe(200);
            // Verify code was cleared in MongoDB
            const userClearedCode = await User_model_1.default.findOne({
                email: sampleUserData.email,
            });
            expect(userClearedCode?.code).toBeNull();
            // Step 3: Change password (change)
            const newPassword = "NewSecurePassword@2026";
            const changeRes = await (0, supertest_1.default)(app_1.default)
                .put(process.env.API_BASEURL + "/forgotpassword")
                .send({
                ty: "change",
                email: sampleUserData.email,
                password: newPassword,
            });
            expect(changeRes.status).toBe(200);
            // Step 4: Verify user can login with NEW password
            const newLoginRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: newPassword,
            });
            expect(newLoginRes.status).toBe(200);
            expect(newLoginRes.body.data.email).toBe(sampleUserData.email);
            // Old password should now fail
            const oldLoginRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: sampleUserData.password,
            });
            expect(oldLoginRes.status).toBe(404);
        });
    });
    describe("DELETE /logout - End-to-End Logout", () => {
        let refreshCookieHeader;
        let refreshToken;
        beforeEach(async () => {
            await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/registeruser")
                .send(sampleUserData);
            const loginRes = await (0, supertest_1.default)(app_1.default)
                .post(process.env.API_BASEURL + "/login")
                .send({
                email: sampleUserData.email,
                password: sampleUserData.password,
            });
            const cookies = loginRes.headers["set-cookie"];
            const refreshCookieName = process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
            refreshCookieHeader = cookies.find((c) => c.startsWith(`${refreshCookieName}=`));
            refreshToken = refreshCookieHeader.split(";")[0].split("=")[1];
        });
        test("deletes session from database and invalidates auth session", async () => {
            // Verify session exists prior to logout
            let session = await Usersession_model_1.default.findOne({ session_id: refreshToken });
            expect(session).not.toBeNull();
            // Perform logout
            const logoutRes = await (0, supertest_1.default)(app_1.default)
                .delete(process.env.API_BASEURL + "/logout")
                .set("Cookie", [refreshCookieHeader]);
            expect(logoutRes.status).toBe(200);
            // Verify session is deleted from MongoDB
            session = await Usersession_model_1.default.findOne({ session_id: refreshToken });
            expect(session).toBeNull();
            // Verify subsequent checksession fails
            sessionCache_1.default.clear();
            const checkRes = await (0, supertest_1.default)(app_1.default)
                .get(process.env.API_BASEURL + "/checksession")
                .set("Cookie", [refreshCookieHeader]);
            expect(checkRes.status).toBe(401);
        });
    });
});
