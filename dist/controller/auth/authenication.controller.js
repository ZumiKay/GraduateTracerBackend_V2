"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const User_model_1 = __importDefault(require("../../model/User.model"));
const helper_1 = require("../../utilities/helper");
const bcrypt_1 = __importDefault(require("bcrypt"));
const Usersession_model_1 = __importDefault(require("../../model/Usersession.model"));
const email_1 = __importDefault(require("../../utilities/email"));
const sessionCache_1 = __importDefault(require("../../utilities/sessionCache"));
class AuthenticationController {
    Login = async (req, res) => {
        const { email, password, rememberMe } = req.body;
        try {
            const user = await User_model_1.default.findOne({
                $or: [
                    {
                        email,
                    },
                    { name: email },
                ],
            })
                .select("email name password role")
                .lean();
            if (!user || !bcrypt_1.default.compareSync(password, user.password)) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Incorrect Credential"));
            }
            //Login session creation
            const TokenPayload = { sub: user._id, role: user.role };
            const AccessToken = (0, helper_1.GenerateToken)(TokenPayload, "15m");
            const RefreshToken = (0, helper_1.GenerateToken)(TokenPayload, rememberMe ? "7d" : "1d");
            //Create Login Session
            await Usersession_model_1.default.create({
                session_id: RefreshToken,
                expireAt: (0, helper_1.getDateByNumDay)(1),
                user: user._id,
                guest: null,
            });
            //Set Authentication Cookie
            this.setAccessTokenCookie(res, AccessToken);
            this.setRefreshTokenCookie(res, RefreshToken);
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: {
                    ...user,
                },
            });
        }
        catch (error) {
            console.error(`Login Error:`, error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    Logout = async (req, res) => {
        try {
            const refresh_token = req.cookies?.[process.env.REFRESH_TOKEN_COOKIE ?? ""];
            if (!refresh_token)
                return res.status(204).json((0, helper_1.ReturnCode)(204));
            // Invalidate cache for this session
            sessionCache_1.default.invalidate(refresh_token);
            await Usersession_model_1.default.deleteOne({ session_id: refresh_token });
            this.clearAccessTokenCookie(res);
            this.clearRefreshTokenCookie(res);
            return res.status(200).json((0, helper_1.ReturnCode)(200));
        }
        catch (error) {
            console.log(`Logout Error`, error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    ForgotPassword = async (req, res) => {
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
                            const isCode = await User_model_1.default.findOne({ code: generateCode });
                            if (!isCode) {
                                isUnqiue = true;
                            }
                            generateCode = (0, helper_1.RandomNumber)(6);
                        }
                        await User_model_1.default.findOneAndUpdate({ email }, {
                            code: generateCode,
                        });
                        //Send Code Email
                        const sendemail = await (0, email_1.default)(email, "Reset Password", html.replace("$code$", generateCode.toString()));
                        if (!sendemail.success) {
                            return res
                                .status(500)
                                .json((0, helper_1.ReturnCode)(500, "Fail to send email"));
                        }
                    }
                    break;
                case "confirm":
                    {
                        const isValid = await User_model_1.default.findOneAndUpdate({ code }, { code: null });
                        if (!isValid)
                            return res.status(404).json((0, helper_1.ReturnCode)(404, "Invalid Code"));
                    }
                    break;
                case "change":
                    {
                        if (!password)
                            return res.status(400).json((0, helper_1.ReturnCode)(400));
                        const changePassword = (0, helper_1.hashedPassword)(password);
                        await User_model_1.default.updateOne({ email }, { password: changePassword });
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
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    /**
     * Check session for valid user session
     * Optimized for frequent calls with:
     * - In-memory caching (2-minute TTL)
     * - Lean queries for better performance
     * - Reduced field selection
     * - Early returns to minimize processing
     */
    CheckSession = async (req, res) => {
        try {
            const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];
            if (!refreshToken) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "No session found"));
            }
            // Check cache first
            const cachedSession = sessionCache_1.default.get(refreshToken);
            if (cachedSession) {
                return res.status(200).json({
                    ...(0, helper_1.ReturnCode)(200),
                    data: {
                        user: {
                            _id: cachedSession.userId,
                            email: cachedSession.email,
                            name: cachedSession.name,
                            role: cachedSession.role,
                        },
                        isAuthenticated: true,
                    },
                });
            }
            const userSession = await Usersession_model_1.default.findOne({
                session_id: refreshToken,
                expireAt: { $gte: new Date() },
                respondent: null,
            })
                .populate({
                path: "user",
                select: "_id email name role",
            })
                .select("session_id expireAt createdAt user")
                .lean()
                .exec();
            Usersession_model_1.default.deleteMany({
                expireAt: { $lt: new Date() },
            })
                .exec()
                .catch((err) => {
                console.error(`Background cleanup error:`, err);
            });
            if (!userSession?.user) {
                this.clearAccessTokenCookie(res);
                this.clearRefreshTokenCookie(res);
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Session expired"));
            }
            const user = userSession.user;
            // Cache the session data for future requests
            sessionCache_1.default.set(refreshToken, {
                userId: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
            });
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: {
                    user: {
                        _id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                    },
                    isAuthenticated: true,
                },
            });
        }
        catch (error) {
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    };
    RefreshToken = async (req, res) => {
        //Generate MongoDB operation ID
        if (!process.env.REFRESH_TOKEN_COOKIE) {
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
        try {
            const refresh_token = req.cookies?.[process.env.REFRESH_TOKEN_COOKIE];
            const user = await Usersession_model_1.default.findOne({
                session_id: refresh_token,
            })
                .populate("user")
                .exec();
            if (!user || !user.user)
                return res.status(404).json((0, helper_1.ReturnCode)(404));
            const TokenPayload = { sub: user.user._id, role: user.user.role };
            const newToken = (0, helper_1.GenerateToken)(TokenPayload, "30m");
            this.setAccessTokenCookie(res, newToken);
            return res.status(200).json({ ...(0, helper_1.ReturnCode)(200) });
        }
        catch (error) {
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    setAccessTokenCookie(res, token) {
        res.cookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", token, {
            sameSite: "lax",
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            expires: (0, helper_1.getDateByMinute)(30),
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
