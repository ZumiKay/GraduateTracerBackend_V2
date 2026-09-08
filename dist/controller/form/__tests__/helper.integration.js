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
exports.loggedNormalUser = exports.loginNormalUser = exports.loggedUserInForm = exports.createResponse = exports.createQuestionsWithFormId = exports.createTestForm = exports.createTestUser = exports.mockEmailSender = exports.mockTrafficMiddleware = exports.testEnv = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_model_1 = __importStar(require("../../../model/User.model"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importStar(require("../../../model/Form.model"));
const mockdata_1 = require("../../../utilities/mockdata");
const Response_model_1 = __importDefault(require("../../../model/Response.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const helper_1 = require("../../../utilities/helper");
const Formsession_model_1 = __importDefault(require("../../../model/Formsession.model"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
exports.testEnv = {
    ...process.env,
    RESPONDENT_TOKEN_JWT_SECRET: "test_respondent_jwt_secret_key_12345",
    ACCESS_RESPONDENT_COOKIE: "graduate_access_resp",
    RESPONDENT_COOKIE: "graduate_refresh_resp",
    REFRESH_TOKEN_COOKIE: "graduate_refreshT",
    ACCESS_TOKEN_COOKIE: process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT",
    JWT_SECRET: "test_jwt_secret_key_12345",
    INVITE_LINK_SECRET: process.env.INVITE_LINK_SECRET || "test_invite_secret_key_12345",
};
const mockTrafficMiddleware = () => jest.mock("../../../middleware/Traffic.middleware", () => ({
    __esModule: true,
    default: {
        LoginRateLimit: (req, res, next) => next(),
        ApiRateLimit: (req, res, next) => next(),
        PasswordResetRateLimit: (req, res, next) => next(),
        Ratelimit: (req, res, next) => next(),
    },
}));
exports.mockTrafficMiddleware = mockTrafficMiddleware;
const mockEmailSender = () => jest.mock("../../../utilities/email", () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue({
        success: true,
        message: "Email sent successfully",
    }),
}));
exports.mockEmailSender = mockEmailSender;
const sampleUserData = {
    email: "respondent_user@example.com",
    name: "respondent_user",
    password: "Password@12345",
    role: User_model_1.ROLE.USER,
};
const createTestUser = async (overrides) => {
    const password = overrides?.password ?? sampleUserData.password;
    const hashedPassword = bcrypt_1.default.hashSync(password, 10);
    return await User_model_1.default.create({
        ...sampleUserData,
        ...overrides,
        password: hashedPassword,
    });
};
exports.createTestUser = createTestUser;
const createTestForm = async (userId, overrides) => {
    return await Form_model_1.default.create({
        title: "Integration Test Quiz Form",
        type: Form_model_1.TypeForm.Quiz,
        totalpage: 3,
        totalscore: 50,
        user: userId,
        setting: {
            acceptResponses: true,
            acceptGuest: true,
            email: true,
            submitonce: true,
        },
        ...overrides,
    });
};
exports.createTestForm = createTestForm;
/**Create questions with formId require
 * @requires Form
 */
const createQuestionsWithFormId = async ({ formId, replaceQuestion, }) => {
    try {
        if (replaceQuestion) {
            await Content_model_1.default.deleteMany({ formId });
        }
        const sampleTestQuestions = replaceQuestion
            ? replaceQuestion.map((q) => ({ page: 1, ...q, formId }))
            : mockdata_1.MockContentFactory.createSampleForm(formId);
        const createdContent = await Content_model_1.default.create([...sampleTestQuestions]);
        return createdContent;
    }
    catch (error) {
        console.log("createQuestionsWithFormId", error);
    }
};
exports.createQuestionsWithFormId = createQuestionsWithFormId;
const createResponse = async ({ formId, userId, respondentEmail, }) => {
    try {
        let email = respondentEmail;
        if (!email && userId) {
            const user = await User_model_1.default.findById(userId).lean();
            email = user?.email;
        }
        return await Response_model_1.default.create({
            formId,
            userId,
            respondentEmail: email,
            responseset: [
                mockdata_1.MockContentFactory.createResponseSet({
                    question: new mongoose_1.Types.ObjectId(),
                }),
            ],
        });
    }
    catch (error) {
        console.log("FormResponse Test", error);
    }
};
exports.createResponse = createResponse;
const loggedUserInForm = async ({ email, password, formId, }) => {
    const isUser = await User_model_1.default.findOne({ email }).lean();
    if (!isUser) {
        console.log("Integration", "No user found");
        return;
    }
    const isValid = bcrypt_1.default.compareSync(password, isUser.password);
    if (!isValid) {
        console.log("Integration", "Wrong Password");
        return;
    }
    //create formsession
    const payload = {
        id: isUser._id.toString(),
        email: isUser.email,
        ...(formId ? { formId: formId.toString() } : {}),
    };
    const accessToken = (0, helper_1.GenerateToken)(payload, "30m", process.env.RESPONDENT_TOKEN_JWT_SECRET);
    const refreshToken = (0, helper_1.GenerateToken)(payload, "12h", process.env.RESPONDENT_TOKEN_JWT_SECRET);
    await Formsession_model_1.default.create({
        form: formId ? new mongoose_1.Types.ObjectId(formId) : undefined,
        access_id: accessToken,
        session_id: refreshToken,
        expiredAt: (0, helper_1.getDateByNumDay)(1),
        respondentEmail: isUser.email,
        respondentName: isUser.name,
    });
    return { accessToken, refreshToken };
};
exports.loggedUserInForm = loggedUserInForm;
/**
 * Helper to log in a normal system user, generate access/refresh JWT tokens,
 * record a Usersession in MongoDB, and return authentication cookies ready for Supertest.
 */
const loginNormalUser = async (options) => {
    let targetUser = null;
    let rememberMe = false;
    if (options) {
        if ("_id" in options && options._id) {
            targetUser = options;
        }
        else if ("user" in options && options.user) {
            targetUser = options.user;
            rememberMe = Boolean(options.rememberMe);
        }
        else if ("email" in options && options.email) {
            rememberMe = Boolean(options.rememberMe);
            targetUser = await User_model_1.default.findOne({ email: options.email }).lean();
            if (!targetUser) {
                console.log("Integration", "No user found for email:", options.email);
                return;
            }
            if (options.password && targetUser.password) {
                const isValid = bcrypt_1.default.compareSync(options.password, targetUser.password);
                if (!isValid) {
                    console.log("Integration", "Wrong Password");
                    return;
                }
            }
        }
    }
    if (!targetUser) {
        targetUser = await User_model_1.default.findOne({ email: sampleUserData.email }).lean();
        if (!targetUser) {
            targetUser = await (0, exports.createTestUser)();
        }
    }
    const userId = targetUser._id?.toString?.() ||
        targetUser.id?.toString?.() ||
        String(targetUser._id);
    const userRole = targetUser.role || User_model_1.ROLE.USER;
    const tokenPayload = {
        sub: userId,
        role: userRole,
    };
    const jwtSecret = exports.testEnv.JWT_SECRET || process.env.JWT_SECRET;
    const accessToken = (0, helper_1.GenerateToken)(tokenPayload, "15m", jwtSecret);
    const refreshToken = (0, helper_1.GenerateToken)(tokenPayload, rememberMe ? "7d" : "1d", jwtSecret);
    const sessionExpireAt = rememberMe
        ? (0, helper_1.getDateByNumDay)(7)
        : (0, helper_1.getDateByNumDay)(1);
    await Usersession_model_1.default.create({
        session_id: refreshToken,
        expireAt: sessionExpireAt,
        user: mongoose_1.Types.ObjectId.isValid(userId) ? new mongoose_1.Types.ObjectId(userId) : undefined,
    });
    const cookies = [
        `${exports.testEnv.ACCESS_TOKEN_COOKIE}=${accessToken}`,
        `${exports.testEnv.REFRESH_TOKEN_COOKIE}=${refreshToken}`,
    ];
    return {
        user: targetUser,
        accessToken,
        refreshToken,
        cookies,
        cookieHeader: cookies,
    };
};
exports.loginNormalUser = loginNormalUser;
exports.loggedNormalUser = exports.loginNormalUser;
