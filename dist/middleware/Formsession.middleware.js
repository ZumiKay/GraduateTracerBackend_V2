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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const Formsession_model_1 = __importDefault(require("../model/Formsession.model"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importStar(require("../model/Form.model"));
const User_middleware_1 = __importStar(require("./User.middleware"));
const helper_1 = require("../utilities/helper");
const formsession_controller_1 = __importDefault(require("../controller/form/formsession.controller"));
// Response templates for common error scenarios
const RESPONSES = {
    missingCookieConfig: () => ({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_COOKIE_CONFIG",
    }),
    invalidFormId: () => ({
        success: false,
        status: 400,
        message: "Invalid or missing form ID",
        error: "INVALID_FORM_ID",
    }),
    formClosed: () => ({
        success: false,
        status: 403,
        message: "Form is closed",
        error: "FORM_CLOSED",
    }),
    missingSessionToken: () => ({
        success: false,
        status: 401,
        message: "Session token required",
        error: "MISSING_SESSION_TOKEN",
    }),
    invalidSessionToken: () => ({
        success: false,
        status: 401,
        message: "Invalid session token",
        error: "INVALID_SESSION_TOKEN",
    }),
    sessionNotFound: () => ({
        success: false,
        status: 401,
        message: "Session not found",
        error: "SESSION_NOT_FOUND",
    }),
    sessionExpired: () => ({
        success: false,
        status: 401,
        message: "Session expired",
        error: "SESSION_EXPIRED",
    }),
    invalidAccessToken: () => ({
        success: false,
        status: 401,
        message: "Invalid Session",
        error: "INVALID_ACCESS_TOKEN",
    }),
    tokenRenewalError: () => ({
        success: false,
        status: 500,
        message: "Token renewal failed",
        error: "TOKEN_RENEWAL_ERROR",
    }),
    internalServerError: () => ({
        success: false,
        status: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
    }),
    missingFormId: () => ({
        success: false,
        status: 400,
        message: "Form ID is missing",
        error: "MISSING_FORM_ID",
    }),
    invalidRequestType: () => ({
        success: false,
        status: 400,
        message: "Invalid request type",
        error: "INVALID_REQUEST_TYPE",
    }),
    missingRefreshTokenConfig: () => ({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_REFRESH_TOKEN_CONFIG",
    }),
};
class FormsessionMiddleware {
    /**
     * Validates environment configuration for cookies
     */
    static validateCookieConfig() {
        return !!(process.env.RESPONDENT_COOKIE && process.env.ACCESS_RESPONDENT_COOKIE);
    }
    /**
     * Validates form ID parameter
     */
    static validateFormId(formId) {
        return !!(formId && (0, mongoose_1.isValidObjectId)(formId));
    }
    /**
     * Checks if session has expired
     */
    static isSessionExpired(dbExpiredAt, isTokenExpired) {
        return dbExpiredAt <= new Date() || !!isTokenExpired;
    }
}
_a = FormsessionMiddleware;
FormsessionMiddleware.VerifyFormsession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    if (!_a.validateCookieConfig())
        return res.status(500).json(RESPONSES.missingCookieConfig());
    //Verify required param
    const { formId } = req.params;
    if (!_a.validateFormId(formId))
        return res.status(400).json(RESPONSES.invalidFormId());
    try {
        //Verify initial formdata
        const form = yield Form_model_1.default.findById(formId)
            .select("type setting.email setting.acceptResponses")
            .lean();
        if (!((_b = form === null || form === void 0 ? void 0 : form.setting) === null || _b === void 0 ? void 0 : _b.acceptResponses))
            return res.status(403).json(RESPONSES.formClosed());
        if ((form === null || form === void 0 ? void 0 : form.type) === Form_model_1.TypeForm.Normal && !form.setting.email) {
            return next();
        }
        // Extract both session_id and access_id from cookies
        const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE];
        const accessToken = req.cookies[process.env.ACCESS_RESPONDENT_COOKIE];
        if (!sessionToken) {
            return res.status(401).json(RESPONSES.missingSessionToken());
        }
        // Verify session token
        const extractedSessionToken = formsession_controller_1.default.ExtractToken({
            token: sessionToken,
        });
        if (!extractedSessionToken.data) {
            return res.status(401).json(RESPONSES.invalidSessionToken());
        }
        try {
            // Find session using both session_id and access_id for validation
            const sessionQuery = {
                $and: [
                    { form: formId },
                    { session_id: sessionToken },
                    ...(accessToken ? [{ access_id: accessToken }] : []),
                ],
            };
            const isSession = yield Formsession_model_1.default.findOne(sessionQuery).lean();
            if (!isSession) {
                return res.status(401).json(RESPONSES.sessionNotFound());
            }
            const dbExpiredAt = new Date(isSession.expiredAt);
            if (_a.isSessionExpired(dbExpiredAt, extractedSessionToken.isExpired)) {
                yield Formsession_model_1.default.deleteOne({ session_id: sessionToken });
                return res.status(401).json(RESPONSES.sessionExpired());
            }
            //Access Token Handler
            const verifiedAccessToken = accessToken
                ? formsession_controller_1.default.ExtractToken({
                    token: accessToken,
                })
                : undefined;
            if (verifiedAccessToken &&
                !(verifiedAccessToken === null || verifiedAccessToken === void 0 ? void 0 : verifiedAccessToken.isExpired) &&
                !(verifiedAccessToken === null || verifiedAccessToken === void 0 ? void 0 : verifiedAccessToken.data)) {
                return res.status(401).json(RESPONSES.invalidAccessToken());
            }
            // Renew access tokens if needed
            if (!verifiedAccessToken || verifiedAccessToken.isExpired) {
                const newAccessId = yield formsession_controller_1.default.GenerateUniqueAccessId({
                    email: isSession.respondentEmail,
                    expireIn: "30m",
                });
                // Update both session_id and access_id in database
                yield Formsession_model_1.default.updateOne({ session_id: sessionToken }, {
                    access_id: newAccessId,
                });
                const newExtractedAccessToken = formsession_controller_1.default.ExtractToken({
                    token: newAccessId,
                });
                req.formsession = Object.assign(Object.assign({}, extractedSessionToken), { sub: sessionToken, access_token: newAccessId, access_payload: newExtractedAccessToken });
                formsession_controller_1.default.setCookie(res, newAccessId, process.env.ACCESS_RESPONDENT_COOKIE, (0, helper_1.getDateByMinute)(30));
                return next();
            }
            // No renewal needed - use existing tokens
            req.formsession = Object.assign(Object.assign({}, extractedSessionToken), { sub: sessionToken, access_token: accessToken, access_payload: verifiedAccessToken.data });
            return next();
        }
        catch (error) {
            console.error("Token renewal failed:", error);
            return res.status(500).json(RESPONSES.tokenRenewalError());
        }
    }
    catch (error) {
        console.error("Verify Form session error:", error);
        return res.status(500).json(RESPONSES.internalServerError());
    }
});
FormsessionMiddleware.VerifyRespondentFormSessionData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { ty } = req.query;
    const { formId } = req.params;
    if (!formId)
        return res.status(400).json(RESPONSES.missingFormId());
    try {
        switch (ty) {
            case User_middleware_1.GetPublicFormDataTyEnum.initial: {
                // Check for both session and access tokens
                const isLoggedIn = process.env.RESPONDENT_COOKIE
                    ? req.cookies[process.env.RESPONDENT_COOKIE]
                    : undefined;
                if (isLoggedIn) {
                    yield _a.VerifyFormsession(req, res, next);
                    return;
                }
                return next();
            }
            case User_middleware_1.GetPublicFormDataTyEnum.data: {
                //Verify Session with both tokens
                yield _a.VerifyFormsession(req, res, next);
                return;
            }
            default:
                return res.status(400).json(RESPONSES.invalidRequestType());
        }
    }
    catch (error) {
        console.error("Verify Respondent Form session error:", error);
        return res.status(500).json(RESPONSES.internalServerError());
    }
});
FormsessionMiddleware.VerifyUserRespondentLogin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.REFRESH_TOKEN_COOKIE)
        return res.status(500).json(RESPONSES.missingRefreshTokenConfig());
    const existCookie = req.cookies[process.env.REFRESH_TOKEN_COOKIE];
    try {
        if (!existCookie) {
            return next();
        }
        yield User_middleware_1.default.VerifyRefreshToken(req, res, next);
    }
    catch (error) {
        console.error("Verify User Response Login error:", error);
        return res.status(500).json(RESPONSES.internalServerError());
    }
});
exports.default = FormsessionMiddleware;
