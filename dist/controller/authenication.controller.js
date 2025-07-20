"use strict";
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
const bcrypt_1 = __importDefault(require("bcrypt"));
const Usersession_model_1 = __importDefault(require("../model/Usersession.model"));
const email_1 = __importDefault(require("../utilities/email"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthenticationController {
    constructor() {
        this.Login = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { email, password } = req.body;
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
                });
                this.setAccessTokenCookie(res, AccessToken);
                this.setRefreshTokenCookie(res, RefreshToken);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { token: AccessToken }));
            }
            catch (error) {
                console.error("Login Error:", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.Logout = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
                console.log("Logout Error", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.ForgotPassword = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { ty, email, code, password, html } = req.body;
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
                console.log("forgot password", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.CheckSession = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
                    session_id: refreshToken,
                    expireAt: { $gte: new Date() }, // Check if session hasn't expired
                }).populate({ path: "user", select: "_id email role" });
                if (!userSession || !userSession.user) {
                    // Clean up expired session
                    if (userSession) {
                        yield Usersession_model_1.default.deleteOne({ session_id: refreshToken });
                    }
                    // Clear cookies
                    this.clearAccessTokenCookie(res);
                    this.clearRefreshTokenCookie(res);
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "Session Expired"));
                }
                // Additional security checks
                const user = userSession.user;
                // Check if user still exists and is active
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
                console.error("Check Session Error:", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
            }
        });
        this.RefreshToken = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
                console.log("Refresh Token", error);
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
