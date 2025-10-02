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
const User_model_1 = __importDefault(require("../model/User.model"));
const helper_1 = require("../utilities/helper");
const bcrypt_1 = __importStar(require("bcrypt"));
const Usersession_model_1 = __importDefault(require("../model/Usersession.model"));
const email_1 = __importDefault(require("../utilities/email"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Formsession_1 = __importDefault(require("../model/Formsession"));
class AuthenticationController {
    constructor() {
        this.Login = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { email, password } = req.body;
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("login");
            try {
                const user = yield User_model_1.default.findOne({ email }).select("email password role");
                if (!user || !bcrypt_1.default.compareSync(password, user.password)) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
                }
                const TokenPayload = { id: user._id, role: user.role };
                const AccessToken = (0, helper_1.GenerateToken)(TokenPayload, "15m");
                const RefreshToken = (0, helper_1.GenerateToken)(TokenPayload, "1d");
                //Create Login Session
                yield Usersession_model_1.default.create({
                    session_id: RefreshToken,
                    expireAt: (0, helper_1.getDateByNumDay)(1),
                    user: user._id,
                    guest: null,
                });
                this.setAccessTokenCookie(res, AccessToken);
                this.setRefreshTokenCookie(res, RefreshToken);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { token: AccessToken }));
            }
            catch (error) {
                if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "user login")) {
                    return;
                }
                console.error(`[${operationId}] Login Error:`, error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.Logout = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("logout");
            try {
                const refresh_token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[(_b = process.env.REFRESH_TOKEN_COOKIE) !== null && _b !== void 0 ? _b : ""];
                if (!refresh_token)
                    return res.status(204).json((0, helper_1.ReturnCode)(204));
                yield Usersession_model_1.default.deleteOne({ session_id: refresh_token });
                this.clearAccessTokenCookie(res);
                this.clearRefreshTokenCookie(res);
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            catch (error) {
                if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "user logout")) {
                    return;
                }
                console.log(`[${operationId}] Logout Error`, error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.ForgotPassword = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { ty, email, code, password, html } = req.body;
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("forgot_password");
            try {
                switch (ty) {
                    case "vfy":
                        {
                            if (!email)
                                return res.status(400).json((0, helper_1.ReturnCode)(400));
                            let generateCode = (0, helper_1.RandomNumber)(6);
                            let isUnqiue = false;
                            while (!isUnqiue) {
                                const isCode = yield User_model_1.default.findOne({ code: generateCode });
                                if (!isCode) {
                                    isUnqiue = true;
                                }
                                generateCode = (0, helper_1.RandomNumber)(6);
                            }
                            yield User_model_1.default.findOneAndUpdate({ email }, {
                                code: generateCode,
                            });
                            //Send Code Email
                            const sendemail = yield (0, email_1.default)(email, "Reset Password", html.replace("$code$", generateCode.toString()));
                            if (!sendemail.success) {
                                return res
                                    .status(500)
                                    .json((0, helper_1.ReturnCode)(500, "Fail to send email"));
                            }
                        }
                        break;
                    case "confirm":
                        {
                            const isValid = yield User_model_1.default.findOneAndUpdate({ code }, { code: null });
                            if (!isValid)
                                return res.status(404).json((0, helper_1.ReturnCode)(404, "Invalid Code"));
                        }
                        break;
                    case "change":
                        {
                            if (!password)
                                return res.status(400).json((0, helper_1.ReturnCode)(400));
                            const changePassword = (0, helper_1.hashedPassword)(password);
                            yield User_model_1.default.updateOne({ email }, { password: changePassword });
                        }
                        break;
                    default:
                        {
                            res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request type"));
                        }
                        break;
                }
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            catch (error) {
                if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "forgot password operation")) {
                    return;
                }
                console.log(`[${operationId}] forgot password`, error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.CheckSession = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("check_session");
            try {
                const refreshToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.REFRESH_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : ""];
                const accessToken = req === null || req === void 0 ? void 0 : req.cookies[(_b = process.env.ACCESS_TOKEN_COOKIE) !== null && _b !== void 0 ? _b : ""];
                if (!refreshToken) {
                    return res
                        .status(204)
                        .json({ authenticated: false, message: "No refresh token found" });
                }
                // Verify the refresh token is still valid
                const userSession = yield Usersession_model_1.default.findOne({
                    $and: [
                        {
                            session_id: refreshToken,
                        },
                        {
                            expireAt: { $gte: new Date() },
                        },
                        {
                            respondent: null,
                        },
                    ],
                }).populate({ path: "user", select: "_id email role" });
                if (!userSession || !userSession.user) {
                    if (userSession) {
                        yield Usersession_model_1.default.deleteOne({ session_id: refreshToken });
                    }
                    // Clear cookies
                    this.clearAccessTokenCookie(res);
                    this.clearRefreshTokenCookie(res);
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "Session Expired"));
                }
                const user = userSession.user;
                const currentUser = yield User_model_1.default.findById(user._id).select("_id email role");
                if (!currentUser) {
                    // User was deleted, clean up session
                    yield Usersession_model_1.default.deleteOne({ session_id: refreshToken });
                    this.clearAccessTokenCookie(res);
                    this.clearRefreshTokenCookie(res);
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "User no longer exists"));
                }
                // Verify access token if present
                let tokenValid = false;
                if (accessToken) {
                    try {
                        const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.JWT_SECRET || "secret");
                        tokenValid = decoded.id === user._id.toString();
                    }
                    catch (error) {
                        // Access token invalid/expired, but refresh token is valid
                        tokenValid = false;
                    }
                }
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                        user: {
                            _id: currentUser._id,
                            email: currentUser.email,
                            role: currentUser.role,
                        },
                        session: {
                            sessionId: userSession.session_id,
                            expireAt: userSession.expireAt,
                            createdAt: userSession.createdAt,
                        },
                        authenticated: true,
                        tokenValid,
                        requiresRefresh: !tokenValid,
                    } }));
            }
            catch (error) {
                if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "session check")) {
                    return;
                }
                console.error(`[${operationId}] Check Session Error:`, error);
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
            }
        });
        this.RefreshToken = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("refresh_token");
            try {
                const refresh_token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[(_b = process.env.REFRESH_TOKEN_COOKIE) !== null && _b !== void 0 ? _b : ""];
                const user = yield Usersession_model_1.default.findOne({
                    session_id: refresh_token,
                })
                    .populate("user")
                    .exec();
                if (!user || !user.user)
                    return res.status(404).json((0, helper_1.ReturnCode)(404));
                const TokenPayload = { id: user.user._id, role: user.user.role };
                const newToken = (0, helper_1.GenerateToken)(TokenPayload, "1h");
                this.setAccessTokenCookie(res, newToken);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { token: newToken }));
            }
            catch (error) {
                if ((0, MongoErrorHandler_1.handleDatabaseError)(error, res, "token refresh")) {
                    return;
                }
                console.log(`[${operationId}] Refresh Token`, error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        //Respondent Authentication
        this.RespodnentLogin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { email, password, formId, isGuest, } = req.body;
            if (!email || !formId)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            let isUser = undefined;
            try {
                //Peroform Login
                if (password && !isGuest) {
                    const user = yield User_model_1.default.findOne({ email })
                        .select("_id password")
                        .lean();
                    if (!user)
                        return res.status(404).json({ message: "User not found" });
                    const compareUser = (0, bcrypt_1.compareSync)(password, user.password);
                    if (!compareUser)
                        return res.status(401).json({ message: "Invalid credential" });
                    isUser = user._id;
                }
                //Verify for single response form
                const isRespondent = yield Response_model_1.default.findOne({
                    $and: [{ respondentEmail: email }, { formId }],
                })
                    .select("_id totalScore isCompleted submittedAt respondentEmail respondentName")
                    .populate({ path: "formId", select: "_id totalScore setting" })
                    .lean();
                if (isRespondent &&
                    ((_a = isRespondent.formId.setting) === null || _a === void 0 ? void 0 : _a.submitonce))
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                            submittedResult: Object.assign(Object.assign({ message: "You already submitted response" }, isRespondent), { formId: undefined, maxScore: isRespondent.formId.totalscore }),
                        } }));
                //Generate unique session_id for form
                let token = (0, helper_1.GenerateToken)({ email: email }, "1h");
                let isUnique = false;
                while (isUnique) {
                    const isFormSession = yield Formsession_1.default.countDocuments({
                        session_id: token,
                    });
                    if (isFormSession) {
                        token = (0, helper_1.GenerateToken)({ email }, "1h");
                    }
                    else
                        isUnique = true;
                }
                //Create login session
                yield Formsession_1.default.create({
                    form: formId,
                    session_id: token,
                    expiredAt: (0, helper_1.getDateByNumDay)(1),
                    user: isUser,
                });
                process.env.RESPONDENT_COOKIE &&
                    res.cookie((_b = process === null || process === void 0 ? void 0 : process.env) === null || _b === void 0 ? void 0 : _b.RESPONDENT_COOKIE, token, {
                        sameSite: "lax",
                        expires: (0, helper_1.getDateByNumDay)(1),
                        secure: process.env.NODE_ENV === "PROD",
                    });
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            catch (error) {
                const err = error;
                console.log("Respondent Login", err);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : "Error Occured"));
            }
        });
        this.CheckRespondentSession = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const id = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[(_b = process.env.RESPONDENT_COOKIE) !== null && _b !== void 0 ? _b : ""];
            try {
                if (!id)
                    return res
                        .status(400)
                        .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400)), { data: { isError: true } }));
                const respondentSession = yield Formsession_1.default.findOne({
                    session_id: id,
                })
                    .select("session_id expireAt")
                    .lean();
                if (!respondentSession)
                    return res
                        .status(401)
                        .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(401)), { data: { isError: true } }));
                const isExpired = respondentSession.expiredAt < new Date();
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                        session_id: respondentSession.session_id,
                        userdata: respondentSession.user,
                        isExpired,
                    } }));
            }
            catch (error) {
                console.log("Check Respondent Session", error);
                return res
                    .status(500)
                    .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500)), { data: { isError: true } }));
            }
        });
        this.RenewRespondentSession = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { formId } = req.query;
            const session_id = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[(_b = process.env.RESPONDENT_COOKIE) !== null && _b !== void 0 ? _b : ""];
            if (!session_id)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "No session found"));
            try {
                if (!formId || !(0, mongoose_1.isValidObjectId)(new mongoose_1.Types.ObjectId(formId)))
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                const session = yield Formsession_1.default.findOne({ session_id }).lean();
                if (!session) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Can't Renew Session"));
                }
                //Check form status
                const isAccept = yield Form_model_1.default.findById(formId).select("setting").lean();
                if (!isAccept || !((_c = isAccept.setting) === null || _c === void 0 ? void 0 : _c.acceptResponses))
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, `${!isAccept ? "No Form is found" : "Form has closed"}`));
                const { email } = (0, helper_1.ExtractTokenPaylod)({
                    token: session_id,
                });
                //renew session
                let token = (0, helper_1.GenerateToken)({ email: email }, "1h");
                let isUnique = false;
                while (isUnique) {
                    const isFormSession = yield Formsession_1.default.countDocuments({
                        session_id: token,
                    });
                    if (isFormSession) {
                        token = (0, helper_1.GenerateToken)({ email }, "1h");
                    }
                    else
                        isUnique = true;
                }
                res.cookie((_d = process.env.RESPONDENT_COOKIE) !== null && _d !== void 0 ? _d : "respondent_accessT", token, {
                    sameSite: "lax",
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "PROD",
                    expires: (0, helper_1.getDateByMinute)(240),
                });
                yield Promise.all([
                    Formsession_1.default.deleteOne({ session_id }),
                    Formsession_1.default.create({
                        session_id: token,
                        form: formId,
                        expiredAt: (0, helper_1.getDateByNumDay)(1),
                        user: session.user,
                    }),
                ]);
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            catch (error) {
                console.log("Renew Respondent Session", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.RespondentLogout = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const session_id = (_c = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[(_b = process.env.RESPONDENT_COOKIE) !== null && _b !== void 0 ? _b : ""]) !== null && _c !== void 0 ? _c : null;
                if (!session_id)
                    return res.status(204).json((0, helper_1.ReturnCode)(204));
                const session = yield Formsession_1.default.findOneAndDelete({ session_id });
                if (!session)
                    return res.status(204).json((0, helper_1.ReturnCode)(204));
                res.clearCookie((_d = process.env.RESPONDENT_COOKIE) !== null && _d !== void 0 ? _d : "respondent_accessT");
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            catch (error) {
                console.log("Respondent Logout", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
    }
    setAccessTokenCookie(res, token) {
        res.cookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", token, {
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            expires: (0, helper_1.getDateByMinute)(15),
        });
    }
    setRefreshTokenCookie(res, refreshToken) {
        res.cookie(process.env.REFRESH_TOKEN_COOKIE || "refresh_token", refreshToken, {
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            expires: (0, helper_1.getDateByNumDay)(1),
        });
    }
    clearAccessTokenCookie(res) {
        res.clearCookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", {
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
        });
    }
    clearRefreshTokenCookie(res) {
        res.clearCookie(process.env.REFRESH_TOKEN_COOKIE || "refresh_token", {
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
        });
    }
}
exports.default = new AuthenticationController();
