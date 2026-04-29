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
exports.GetPublicFormDataTyEnum = void 0;
const helper_1 = require("../utilities/helper");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Usersession_model_1 = __importDefault(require("../model/Usersession.model"));
const authenication_controller_1 = __importDefault(require("../controller/auth/authenication.controller"));
// ==================== Types & Enums ====================
var GetPublicFormDataTyEnum;
(function (GetPublicFormDataTyEnum) {
    GetPublicFormDataTyEnum["initial"] = "initial";
    GetPublicFormDataTyEnum["verify"] = "verify";
    GetPublicFormDataTyEnum["data"] = "data";
})(GetPublicFormDataTyEnum || (exports.GetPublicFormDataTyEnum = GetPublicFormDataTyEnum = {}));
// ==================== Constants ====================
const TOKEN_CONFIG = {
    ACCESS_TOKEN_EXPIRY: "30m",
    ACCESS_TOKEN_EXPIRY_MINUTES: 30,
};
const ERROR_MESSAGES = {
    NO_ACCESS_TOKEN: "No access token provided",
    NO_REFRESH_TOKEN: "No refresh token provided",
    INVALID_ACCESS_TOKEN: "Invalid access token",
    INVALID_REFRESH_TOKEN: "Invalid refresh token",
    ACCESS_TOKEN_EXPIRED: "Access token expired",
    REFRESH_TOKEN_EXPIRED: "Refresh token expired",
    SESSION_EXPIRED: "Session expired or invalid",
    USER_NOT_EXISTS: "User no longer exists",
    NOT_AUTHENTICATED: "User not authenticated",
    ADMIN_REQUIRED: "Admin access required",
    VERIFICATION_FAILED: "Token verification failed",
    PERMISSION_CHECK_FAILED: "Permission check failed",
    MISSING_ENV_VARS: "Missing required environment variables",
};
const ERROR_CODES = {
    TOKEN_MISSING: "TOKEN_MISSING",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    TOKEN_INVALID: "TOKEN_INVALID",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    REFRESH_REQUIRED: "REFRESH_REQUIRED",
};
// ==================== Authentication Middleware Class ====================
class AuthenticateMiddleWare {
    constructor() {
        // ==================== Private Helper Methods ====================
        // ==================== Public Middleware Methods ====================
        /**
         * Verifies access token (Hybrid approach - no auto-refresh)
         * Returns specific error codes for frontend to handle refresh
         */
        this.VerifyToken = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            // Validate environment variables
            if (!this.validateEnvVars()) {
                res.status(500).json({
                    success: false,
                    error: ERROR_CODES.TOKEN_INVALID,
                    message: ERROR_MESSAGES.MISSING_ENV_VARS,
                });
                return;
            }
            try {
                const { accessToken } = this.getTokensFromCookies(req);
                // Check if access token exists
                if (!accessToken) {
                    res.status(401).json({
                        success: false,
                        error: ERROR_CODES.TOKEN_MISSING,
                        message: ERROR_MESSAGES.NO_ACCESS_TOKEN,
                    });
                    return;
                }
                // Verify access token
                const verifiedToken = this.verifyJWT(accessToken);
                // Token expired - signal frontend to refresh
                if (verifiedToken.isExpired) {
                    res.status(401).json({
                        success: false,
                        error: ERROR_CODES.TOKEN_EXPIRED,
                        message: ERROR_MESSAGES.ACCESS_TOKEN_EXPIRED,
                        shouldRefresh: true, // Signal to frontend
                    });
                    return;
                }
                // Token invalid
                if (!verifiedToken.isValid || !verifiedToken.data) {
                    authenication_controller_1.default.clearAccessTokenCookie(res);
                    res.status(403).json({
                        success: false,
                        error: ERROR_CODES.TOKEN_INVALID,
                        message: ERROR_MESSAGES.INVALID_ACCESS_TOKEN,
                    });
                    return;
                }
                req.user = verifiedToken.data;
                next();
                return;
            }
            catch (error) {
                console.error("Token verification error:", error);
                res.status(500).json({
                    success: false,
                    error: ERROR_CODES.TOKEN_INVALID,
                    message: ERROR_MESSAGES.VERIFICATION_FAILED,
                });
                return;
            }
        });
        /**
         * Verifies and validates refresh token
         */
        this.VerifyRefreshToken = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { refreshToken } = this.getTokensFromCookies(req);
                if (!refreshToken) {
                    return res
                        .status(401)
                        .json((0, helper_1.ReturnCode)(401, ERROR_MESSAGES.NO_REFRESH_TOKEN));
                }
                // Verify JWT signature
                const verifiedToken = this.verifyJWT(refreshToken);
                //Clean up invalid token
                if (!verifiedToken.isValid) {
                    yield Usersession_model_1.default.deleteOne({
                        session_id: verifiedToken,
                    });
                    //Clear Cookie
                    authenication_controller_1.default.clearRefreshTokenCookie(res);
                    return res
                        .status(401)
                        .json((0, helper_1.ReturnCode)(401, ERROR_MESSAGES.INVALID_REFRESH_TOKEN));
                }
                // Validate session in database
                const validSession = yield Usersession_model_1.default.findOne({
                    session_id: refreshToken,
                    expireAt: { $gte: new Date() },
                }).populate({ path: "user", select: "_id email role" });
                if (!validSession || !validSession.user) {
                    // Cleanup invalid session
                    if (validSession) {
                        yield this.cleanupExpiredSession(refreshToken);
                    }
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, ERROR_MESSAGES.SESSION_EXPIRED));
                }
                req.session = validSession;
                req.user = validSession.user;
                return next();
            }
            catch (error) {
                const err = error;
                console.error("Refresh token verification error:", error);
                if (err.name === "TokenExpiredError") {
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, ERROR_MESSAGES.REFRESH_TOKEN_EXPIRED));
                }
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, ERROR_MESSAGES.VERIFICATION_FAILED));
            }
        });
        /**
         * Middleware to require admin role
         */
        this.RequireAdmin = (req, res, next) => {
            var _a;
            try {
                if (!req.user) {
                    return res
                        .status(401)
                        .json((0, helper_1.ReturnCode)(401, ERROR_MESSAGES.NOT_AUTHENTICATED));
                }
                const userRole = ((_a = req.user.userDetails) === null || _a === void 0 ? void 0 : _a.role) || req.user.role;
                if (userRole !== "ADMIN") {
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, ERROR_MESSAGES.ADMIN_REQUIRED));
                }
                return next();
            }
            catch (error) {
                console.error("Admin check error:", error);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, ERROR_MESSAGES.PERMISSION_CHECK_FAILED));
            }
        };
    }
    /**
     * Validates required environment variables
     */
    validateEnvVars() {
        return !!(process.env.JWT_SECRET &&
            process.env.ACCESS_TOKEN_COOKIE &&
            process.env.REFRESH_TOKEN_COOKIE);
    }
    /**
     * Extracts and verifies a JWT token
     */
    verifyJWT(token) {
        var _a;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, (_a = process.env.JWT_SECRET) !== null && _a !== void 0 ? _a : "secret");
            return {
                isValid: true,
                isExpired: false,
                data: decoded,
            };
        }
        catch (error) {
            if (error.name === "TokenExpiredError") {
                return { isValid: false, isExpired: true };
            }
            return { isValid: false, isExpired: false };
        }
    }
    /**
     * Retrieves tokens from cookies
     */
    getTokensFromCookies(req) {
        return {
            accessToken: req.cookies[process.env.ACCESS_TOKEN_COOKIE],
            refreshToken: req.cookies[process.env.REFRESH_TOKEN_COOKIE],
        };
    }
    /**
     * Validates and retrieves active session
     */
    validateSession(sessionToken, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                session_id: sessionToken,
                expireAt: { $gte: new Date() },
            };
            if (userId) {
                query.user = userId;
            }
            return yield Usersession_model_1.default.findOne(query)
                .select("session_id expireAt userId")
                .populate({ path: "user", select: "_id email role" })
                .lean()
                .exec();
        });
    }
    /**
     * Cleans up expired session
     */
    cleanupExpiredSession(sessionToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Usersession_model_1.default.deleteOne({ session_id: sessionToken });
            }
            catch (error) {
                console.error("Failed to cleanup expired session:", error);
            }
        });
    }
}
exports.default = new AuthenticateMiddleWare();
