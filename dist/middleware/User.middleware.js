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
class AuthenticateMiddleWare {
    constructor() {
        this.VerifyToken = (req, res, next) => {
            var _a;
            try {
                const accessToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.ACCESS_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : "access_token"];
                console.log({ url: req.url, accessToken });
                if (!accessToken)
                    return res.status(401).json((0, helper_1.ReturnCode)(401));
                const verify = this.VerifyJWT(accessToken);
                if (!verify) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                }
                req.user = verify;
                return next();
            }
            catch (error) {
                if (error.name === "TokenExpiredError") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                }
                return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500)), { error }));
            }
        };
        this.VerifyRefreshToken = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const refreshToken = req === null || req === void 0 ? void 0 : req.cookies[(_a = process.env.REFRESH_TOKEN_COOKIE) !== null && _a !== void 0 ? _a : ""];
            if (!refreshToken)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            try {
                const isVerify = this.VerifyJWT(refreshToken);
                if (!isVerify)
                    return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthenticated"));
                const isValid = yield Usersession_model_1.default.findOne({
                    $and: [
                        { session_id: refreshToken },
                        {
                            expireAt: {
                                $gte: new Date(),
                            },
                        },
                    ],
                });
                if (!isValid)
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                return next();
            }
            catch (error) {
                console.log("Verify Refresh Token", error);
                if (error.name === "TokenExpiredError") {
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                }
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
    }
    //Helper
    VerifyJWT(token) {
        var _a;
        const verify = jsonwebtoken_1.default.verify(token, (_a = process.env.JWT_SECRET) !== null && _a !== void 0 ? _a : "secret");
        return verify;
    }
    extractBearerToken(authHeader) {
        if (!authHeader || !authHeader.startsWith("Bearer "))
            return null;
        return authHeader.split(" ")[1];
    }
}
exports.default = new AuthenticateMiddleWare();
