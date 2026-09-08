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
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_model_1 = __importStar(require("../../../model/User.model"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
const helper_integration_1 = require("./helper.integration");
describe("Normal User Login Helper Integration Tests", () => {
    beforeAll(async () => {
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
    });
    beforeEach(async () => {
        process.env = helper_integration_1.testEnv;
    });
    afterAll(async () => {
        await User_model_1.default.deleteMany({});
        await Usersession_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    test("successfully logs in when passed a user document directly", async () => {
        const user = await (0, helper_integration_1.createTestUser)({
            name: "Direct User",
            email: `direct_${Date.now()}@gmail.com`,
            role: User_model_1.ROLE.USER,
        });
        const result = await (0, helper_integration_1.loginNormalUser)(user);
        expect(result).toBeDefined();
        expect(result?.user._id.toString()).toBe(user._id.toString());
        expect(result?.accessToken).toBeDefined();
        expect(result?.refreshToken).toBeDefined();
        expect(result?.cookies).toHaveLength(2);
        expect(result?.cookies[0]).toContain(`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=`);
        expect(result?.cookies[1]).toContain(`${helper_integration_1.testEnv.REFRESH_TOKEN_COOKIE}=`);
        // Verify token validity
        const verified = jsonwebtoken_1.default.verify(result.accessToken, helper_integration_1.testEnv.JWT_SECRET);
        expect(verified.sub).toBe(user._id.toString());
        // Verify Usersession in DB
        const session = await Usersession_model_1.default.findOne({ session_id: result?.refreshToken });
        expect(session).toBeDefined();
        expect(session?.user?.toString()).toBe(user._id.toString());
    });
    test("successfully logs in when passed { user } in options", async () => {
        const user = await (0, helper_integration_1.createTestUser)({
            name: "Options User",
            email: `options_${Date.now()}@gmail.com`,
            role: User_model_1.ROLE.ADMIN,
        });
        const result = await (0, helper_integration_1.loginNormalUser)({ user, rememberMe: true });
        expect(result).toBeDefined();
        expect(result?.user._id.toString()).toBe(user._id.toString());
        const verified = jsonwebtoken_1.default.verify(result.accessToken, helper_integration_1.testEnv.JWT_SECRET);
        expect(verified.role).toBe(User_model_1.ROLE.ADMIN);
        const session = await Usersession_model_1.default.findOne({ session_id: result?.refreshToken });
        expect(session).toBeDefined();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const diff = session.expireAt.getTime() - Date.now();
        expect(diff).toBeGreaterThan(sevenDaysMs - 60000);
    });
    test("successfully logs in when passed { email, password }", async () => {
        const email = `cred_${Date.now()}@gmail.com`;
        const password = "Password@12345";
        const user = await (0, helper_integration_1.createTestUser)({ email, password });
        const result = await (0, helper_integration_1.loginNormalUser)({ email, password });
        expect(result).toBeDefined();
        expect(result?.user.email).toBe(email);
        const session = await Usersession_model_1.default.findOne({ session_id: result?.refreshToken });
        expect(session).toBeDefined();
        expect(session?.user?.toString()).toBe(user._id.toString());
    });
    test("returns undefined when password does not match", async () => {
        const email = `wrongpass_${Date.now()}@gmail.com`;
        await (0, helper_integration_1.createTestUser)({ email, password: "CorrectPassword123" });
        const result = await (0, helper_integration_1.loginNormalUser)({ email, password: "WrongPassword" });
        expect(result).toBeUndefined();
    });
    test("returns undefined when email does not exist", async () => {
        const result = await (0, helper_integration_1.loginNormalUser)({
            email: "nonexistent_email_123@gmail.com",
            password: "Password@12345",
        });
        expect(result).toBeUndefined();
    });
    test("auto-creates or finds default user when called with no arguments", async () => {
        const result = await (0, helper_integration_1.loginNormalUser)();
        expect(result).toBeDefined();
        expect(result?.user).toBeDefined();
        expect(result?.accessToken).toBeDefined();
        expect(result?.cookies).toHaveLength(2);
    });
    test("loggedNormalUser alias works identically to loginNormalUser", async () => {
        expect(helper_integration_1.loggedNormalUser).toBe(helper_integration_1.loginNormalUser);
    });
});
