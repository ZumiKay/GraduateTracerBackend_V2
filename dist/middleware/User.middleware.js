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
const helper_1 = require("../utilities/helper");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Usersession_model_1 = __importDefault(require("../model/Usersession.model"));
const User_model_1 = __importDefault(require("../model/User.model"));
const Formsession_1 = __importDefault(require("../model/Formsession"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
class AuthenticateMiddleWare {
    constructor() {
        this.VerifyToken = (req, res, next) => {
            var _a;
            try {
                const accessToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.ACCESS_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : "access_token"];
                if (!accessToken)
                    return res
                        .status(401)
                        .json((0, helper_1.ReturnCode)(401, "No access token provided"));
                const verify = this.VerifyJWT(accessToken);
                if (!verify) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Invalid access token"));
                }
                req.user = verify;
                return next();
            }
            catch (error) {
                if (error.name === "TokenExpiredError") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access token expired"));
                }
                console.error("Token verification error:", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Token verification failed"));
            }
        };
        this.VerifyTokenAndSession = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const accessToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.ACCESS_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : "access_token"];
                const refreshToken = req === null || req === void 0 ? void 0 : req.cookies[(_b = process.env.REFRESH_TOKEN_COOKIE) !== null && _b !== void 0 ? _b : ""];
                if (!accessToken) {
                    return res
                        .status(401)
                        .json((0, helper_1.ReturnCode)(401, "No access token provided"));
                }
                const decoded = this.VerifyJWT(accessToken);
                if (!decoded) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Invalid access token"));
                }
                if (refreshToken) {
                    const session = yield Usersession_model_1.default.findOne({
                        session_id: refreshToken,
                        user: decoded.id,
                        expireAt: { $gte: new Date() },
                    });
                    if (!session) {
                        return res
                            .status(401)
                            .json((0, helper_1.ReturnCode)(401, "Session expired or invalid"));
                    }
                }
                const user = yield User_model_1.default.findById(decoded.id).select("_id email role");
                if (!user) {
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "User no longer exists"));
                }
                req.user = Object.assign(Object.assign({}, decoded), { userDetails: {
                        _id: user._id,
                        email: user.email,
                        role: user.role,
                    } });
                return next();
            }
            catch (error) {
                if (error.name === "TokenExpiredError") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Access token expired"));
                }
                console.error("Token and session verification error:", error);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Authentication verification failed"));
            }
        });
        this.VerifyRefreshToken = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const refreshToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.REFRESH_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : ""];
            if (!refreshToken)
                return res.status(401).json((0, helper_1.ReturnCode)(401, "No refresh token provided"));
            try {
                const isVerify = this.VerifyJWT(refreshToken);
                if (!isVerify)
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "Invalid refresh token"));
                const isValid = yield Usersession_model_1.default.findOne({
                    session_id: refreshToken,
                    expireAt: { $gte: new Date() },
                }).populate({ path: "user", select: "_id email role" });
                if (!isValid || !isValid.user) {
                    if (isValid) {
                        yield Usersession_model_1.default.deleteOne({ session_id: refreshToken });
                    }
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Session expired"));
                }
                req.session = isValid;
                req.user = isValid.user;
                return next();
            }
            catch (error) {
                console.error("Refresh token verification error:", error);
                if (error.name === "TokenExpiredError") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Refresh token expired"));
                }
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Refresh token verification failed"));
            }
        });
        this.RequireAdmin = (req, res, next) => {
            var _a;
            try {
                if (!req.user) {
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "User not authenticated"));
                }
                const userRole = ((_a = req.user.userDetails) === null || _a === void 0 ? void 0 : _a.role) || req.user.role;
                if (userRole !== "ADMIN") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Admin access required"));
                }
                return next();
            }
            catch (error) {
                console.error("Admin check error:", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Permission check failed"));
            }
        };
    }
    VerifyFormSession(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { formId } = req.params;
            if (!formId)
                return res.status(404).json((0, helper_1.ReturnCode)(404));
            try {
                const form = yield Form_model_1.default.findById(formId).select("setting").lean();
                if (!form)
                    return res.status(404).json((0, helper_1.ReturnCode)(404));
                if ((_a = form === null || form === void 0 ? void 0 : form.setting) === null || _a === void 0 ? void 0 : _a.email) {
                    const session_id = (_b = req.cookies) === null || _b === void 0 ? void 0 : _b[(_c = process.env.RESPONDENT_COOKIE) !== null && _c !== void 0 ? _c : ""];
                    if (!session_id)
                        return res.status(403).json((0, helper_1.ReturnCode)(403));
                    const isSessionExpire = yield Formsession_1.default.findOne({
                        session_id,
                    }).lean();
                    if (!isSessionExpire)
                        return res.status(403).json((0, helper_1.ReturnCode)(403));
                    const isExpire = isSessionExpire.expiredAt <= new Date();
                    if (isExpire)
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                }
                return next();
            }
            catch (error) {
                console.log("Verify formsession", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
    }
    VerifyJWT(token) {
        var _a;
        const verify = jsonwebtoken_1.default.verify(token, (_a = process.env.JWT_SECRET) !== null && _a !== void 0 ? _a : "secret");
        return verify;
    }
}
exports.default = new AuthenticateMiddleWare();
