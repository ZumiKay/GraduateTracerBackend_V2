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
const customType_1 = require("../types/customType");
const Formsession_model_1 = __importDefault(require("../model/Formsession.model"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const User_middleware_1 = __importStar(require("./User.middleware"));
const helper_1 = require("../utilities/helper");
const formsession_controller_1 = __importDefault(require("../controller/form/formsession.controller"));
const formHelpers_1 = require("../utilities/formHelpers");
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
    static VerifyFormsession = async (req, res, next) => {
        if (!this.validateCookieConfig()) {
            res.status(500).json(customType_1.RESPONSES.missingCookieConfig());
            return;
        }
        //Verify required param
        const { formId } = req.params;
        if (!this.validateFormId(formId)) {
            res.status(400).json(customType_1.RESPONSES.invalidFormId());
            return;
        }
        try {
            //Verify initial formdata
            const form = await Form_model_1.default.findById(formId)
                .select("type setting.email setting.acceptResponses")
                .lean();
            if (!form?.setting?.acceptResponses) {
                res.status(403).json(customType_1.RESPONSES.formClosed());
                return;
            }
            if (!form.setting.email) {
                next();
                return;
            }
            // Extract both session_id and access_id from cookies
            const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE];
            const accessToken = req.cookies[process.env.ACCESS_RESPONDENT_COOKIE];
            if (!sessionToken) {
                res.status(401).json(customType_1.RESPONSES.missingSessionToken());
                return;
            }
            // Verify session token
            const extractedSessionToken = (0, helper_1.ExtractTokenPayload)({
                token: sessionToken,
                customSecret: process.env.RESPONDENT_TOKEN_JWT_SECRET,
            });
            //invalid token handle
            if (!extractedSessionToken) {
                await Formsession_model_1.default.deleteOne({ session_id: sessionToken });
                res.status(401).json(customType_1.RESPONSES.invalidSessionToken());
                return;
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
                const isSession = await Formsession_model_1.default.findOne(sessionQuery).lean();
                if (!isSession) {
                    res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE);
                    res.clearCookie(process.env.RESPONDENT_COOKIE);
                    res.status(401).json(customType_1.RESPONSES.sessionNotFound());
                    return;
                }
                //Access Token Handler
                const verifiedAccessToken = accessToken
                    ? (0, helper_1.ExtractTokenPayload)({
                        token: accessToken,
                        customSecret: process.env.RESPONDENT_TOKEN_JWT_SECRET,
                    })
                    : undefined;
                // Renew access tokens if needed happen cuz session token still valid
                if (!verifiedAccessToken) {
                    const newAccessId = (0, helper_1.GenerateToken)({ email: isSession.respondentEmail }, "30m");
                    // Update both session_id and access_id in database
                    await Formsession_model_1.default.updateOne({ session_id: sessionToken }, {
                        access_id: newAccessId,
                    });
                    const newExtractedAccessToken = formsession_controller_1.default.ExtractToken({
                        token: newAccessId,
                    });
                    req.formsession = {
                        sub: sessionToken,
                        access_token: newAccessId,
                        access_payload: newExtractedAccessToken,
                    };
                    formsession_controller_1.default.setCookie(res, newAccessId, process.env.ACCESS_RESPONDENT_COOKIE, (0, helper_1.getDateByMinute)(30));
                    next();
                    return;
                }
                // No renewal needed - use existing tokens
                req.formsession = {
                    sub: sessionToken,
                    access_token: accessToken,
                    access_payload: verifiedAccessToken,
                };
                next();
            }
            catch (error) {
                console.error("Token renewal failed:", error);
                res.status(500).json(customType_1.RESPONSES.tokenRenewalError());
            }
        }
        catch (error) {
            console.error("Verify Form session error:");
            res.status(500).json(customType_1.RESPONSES.internalServerError());
        }
    };
    static VerifyRespondentFormSessionData = async (req, res, next) => {
        const { ty } = req.query;
        const { formId } = req.params;
        if (!formId || !(0, formHelpers_1.isValidObjectIdString)(formId)) {
            res.status(400).json(customType_1.RESPONSES.missingFormId());
            return;
        }
        try {
            switch (ty) {
                case User_middleware_1.GetPublicFormDataTyEnum.initial: {
                    // Check for both session and access tokens
                    const isLoggedIn = process.env.RESPONDENT_COOKIE
                        ? req.cookies[process.env.RESPONDENT_COOKIE]
                        : undefined;
                    if (isLoggedIn) {
                        await this.VerifyFormsession(req, res, next);
                        return;
                    }
                    next();
                    return;
                }
                case User_middleware_1.GetPublicFormDataTyEnum.data: {
                    //Verify Session with both tokens
                    await this.VerifyFormsession(req, res, next);
                    return;
                }
                case User_middleware_1.GetPublicFormDataTyEnum.preview: {
                    await User_middleware_1.default.VerifyToken(req, res, next);
                    return;
                }
                default:
                    return res.status(400).json(customType_1.RESPONSES.invalidRequestType());
            }
        }
        catch (error) {
            console.error("Verify Respondent Form session error:", error);
            return res.status(500).json(customType_1.RESPONSES.internalServerError());
        }
    };
    static VerifyUserRespondentLogin = async (req, res, next) => {
        if (!process.env.REFRESH_TOKEN_COOKIE)
            return res.status(500).json(customType_1.RESPONSES.missingRefreshTokenConfig());
        const existCookie = req.cookies[process.env.REFRESH_TOKEN_COOKIE];
        try {
            if (!existCookie) {
                return next();
            }
            await User_middleware_1.default.VerifyRefreshToken(req, res, next);
        }
        catch (error) {
            console.error("Verify User Response Login error:", error);
            return res.status(500).json(customType_1.RESPONSES.internalServerError());
        }
    };
}
exports.default = FormsessionMiddleware;
