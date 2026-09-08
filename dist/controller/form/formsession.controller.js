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
const helper_1 = require("../../utilities/helper");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Formsession_model_1 = __importDefault(require("../../model/Formsession.model"));
const mongoose_1 = require("mongoose");
const removalEmail_1 = require("../../utilities/removalEmail");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const User_model_1 = __importDefault(require("../../model/User.model"));
const bcrypt_1 = require("bcrypt");
const Usersession_model_1 = __importDefault(require("../../model/Usersession.model"));
const Response_model_1 = __importDefault(require("../../model/Response.model"));
class FormsessionService {
    static respondentLoginSchema = zod_1.z.object({
        formId: zod_1.z.string().min(1),
        email: zod_1.z.string().email().optional(),
        rememberMe: zod_1.z.boolean().optional(),
        name: zod_1.z.string().optional(),
        password: zod_1.z.string().optional(),
        isGuest: zod_1.z.boolean().optional(),
        existed: zod_1.z.string().optional(),
    });
    static sendEmailSchema = zod_1.z.object({
        respondentEmail: zod_1.z.string().email(),
        removeCode: zod_1.z.string().min(1),
        formId: zod_1.z.string().optional(),
    });
    static async GenerateUniqueSessionId({ email, maxAttempts = 3, expireIn = "1d", }) {
        if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
            throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
        }
        const basePayload = {
            email,
            timestamp: Date.now(),
            random: Math.random().toString(36).substring(2),
            process: process.pid,
        };
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const payload = {
                ...basePayload,
                attempt,
                entropy: Math.random().toString(36).substring(2),
                nanotime: process.hrtime.bigint().toString(),
            };
            const session_id = (0, helper_1.GenerateToken)(payload, expireIn, process.env.RESPONDENT_TOKEN_JWT_SECRET);
            const existingSession = await Formsession_model_1.default.exists({ session_id }).lean();
            if (!existingSession) {
                return session_id;
            }
        }
        const fallbackPayload = {
            ...basePayload,
            fallback: true,
            microseconds: process.hrtime.bigint().toString(),
            uuid: Math.random().toString(36) + Math.random().toString(36), // Double random
        };
        const fallbackId = (0, helper_1.GenerateToken)(fallbackPayload, expireIn, process.env.RESPONDENT_TOKEN_JWT_SECRET);
        return fallbackId;
    }
    static async GenerateUniqueAccessId({ email, formId, maxAttempts = 3, expireIn = "1d", }) {
        if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
            throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
        }
        const basePayload = {
            email,
            formId: formId || "public",
            timestamp: Date.now(),
            random: Math.random().toString(36).substring(2),
            type: "access_id",
            process: process.pid,
        };
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const payload = {
                ...basePayload,
                attempt,
                entropy: Math.random().toString(36).substring(2),
                nanotime: process.hrtime.bigint().toString(),
            };
            const access_id = (0, helper_1.GenerateToken)(payload, expireIn, process.env.RESPONDENT_TOKEN_JWT_SECRET);
            const existingAccess = await Formsession_model_1.default.exists({ access_id }).lean();
            if (!existingAccess) {
                return access_id;
            }
        }
        const fallbackPayload = {
            ...basePayload,
            fallback: true,
            microseconds: process.hrtime.bigint().toString(),
            uuid: Math.random().toString(36) + Math.random().toString(36), // Double random
        };
        const fallbackId = (0, helper_1.GenerateToken)(fallbackPayload, expireIn, process.env.RESPONDENT_TOKEN_JWT_SECRET);
        return fallbackId;
    }
    static async handleDuplicateSession(email, formId, res, form) {
        try {
            const requiresDuplicateSessionHandling = form.type === Form_model_1.TypeForm.Quiz ||
                (form.type === Form_model_1.TypeForm.Normal && form.setting?.submitonce === true);
            if (!requiresDuplicateSessionHandling) {
                return false;
            }
            const existingSession = await Formsession_model_1.default.findOne({
                $and: [{ respondentEmail: email }, { form: formId }],
            })
                .select("session_id access_id _id")
                .lean()
                .exec();
            if (!existingSession) {
                return false;
            }
            const [isSessionActive, isAccessActive] = [
                this.ExtractToken({ token: existingSession.session_id }),
                existingSession.access_id
                    ? this.ExtractToken({ token: existingSession.access_id })
                    : false,
            ];
            if (isSessionActive) {
                if (isAccessActive) {
                    try {
                        const [removeCode] = await Promise.all([
                            this.GenerateUniqueRemoveCode({ formsession: Formsession_model_1.default }),
                        ]);
                        await Promise.all([
                            Formsession_model_1.default.updateOne({ session_id: existingSession.session_id }, { removeCode }),
                            this.SendRemovalEmail({
                                respondentEmail: email,
                                removeCode: removeCode.toString(),
                                formId: formId,
                            }),
                        ]);
                        res.status(403).json({
                            success: false,
                            status: 403,
                            message: "There is already an active session. If it's not you, please check your email for removal instructions.",
                        });
                        return true;
                    }
                    catch (emailError) {
                        console.error(`Error sending removal email for ${email}:`, emailError);
                        res.status(403).json({
                            success: false,
                            status: 403,
                            message: "There is already an active session. Please try again later.",
                        });
                        return true;
                    }
                }
                try {
                    const newAccessId = await this.GenerateUniqueAccessId({
                        email,
                        formId,
                        expireIn: "30m",
                    });
                    this.setCookie(res, newAccessId, process.env.ACCESS_RESPONDENT_COOKIE, (0, helper_1.getDateByMinute)(30));
                    await Formsession_model_1.default.updateOne({ session_id: existingSession.session_id }, { access_id: newAccessId, removeCode: null });
                    res.status(200).json({
                        success: true,
                        status: 200,
                        message: "Session reactivated successfully",
                    });
                    return true;
                }
                catch (reactivateError) {
                    console.error(`Error reactivating session for ${email}:`, reactivateError);
                    res.status(500).json({
                        success: false,
                        status: 500,
                        message: "Failed to reactivate session",
                    });
                    return true;
                }
            }
            else {
                try {
                    await Formsession_model_1.default.deleteOne({ _id: existingSession._id });
                    return false;
                }
                catch (deleteError) {
                    console.error(`Error deleting expired session for ${email}:`, deleteError);
                    return false;
                }
            }
        }
        catch (error) {
            console.error(`Error handling duplicate session for ${email}:`, error);
            res.status(500).json({
                success: false,
                status: 500,
                message: "Verification Error",
            });
            return true;
        }
    }
    static setCookie(res, sessionId, cookie, expiredAt) {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            sameSite: "strict",
            maxAge: expiredAt ? expiredAt.getTime() - Date.now() : undefined,
        };
        res.cookie(cookie ?? process.env.RESPONDENT_COOKIE, sessionId, cookieOptions);
    }
    /**
     * Handles respondent login for form access
     *
     * Features:
     * - Support for guest and authenticated users
     * - Session reactivation for existing users
     *
     */
    static RespondentLogin = async (req, res) => {
        if (!process.env.RESPONDENT_TOKEN_JWT_SECRET ||
            !process.env.ACCESS_RESPONDENT_COOKIE ||
            !process.env.RESPONDENT_COOKIE) {
            (0, helper_1.SendResponse)(res, 500);
            return;
        }
        const validationResult = this.respondentLoginSchema.safeParse(req.body);
        if (!validationResult.success) {
            (0, helper_1.SendResponse)(res, 400);
            return;
        }
        const { formId, email, password, rememberMe, isGuest, name, existed } = validationResult.data;
        try {
            const [form, userData] = await Promise.all([
                Form_model_1.default.findById(formId)
                    .select("type totalscore setting.acceptResponses setting.acceptGuest setting.submitonce")
                    .lean()
                    .exec(),
                !isGuest && password
                    ? User_model_1.default.findOne({ email }).select("email password").lean().exec()
                    : Promise.resolve(null),
            ]);
            if (!form) {
                (0, helper_1.SendResponse)(res, 404, undefined, "Form not found");
                return;
            }
            if (!form.setting?.acceptResponses) {
                (0, helper_1.SendResponse)(res, 403, undefined, "Form is closed");
                return;
            }
            if (form.type === Form_model_1.TypeForm.Normal) {
                (0, helper_1.SendResponse)(res, 204);
                return;
            }
            // Validate guest access
            if (isGuest && !form.setting?.acceptGuest) {
                (0, helper_1.SendResponse)(res, 403, undefined, "Form don't accept guest");
                return;
            }
            if (!isGuest && !existed) {
                if (!password) {
                    (0, helper_1.SendResponse)(res, 400);
                    return;
                }
                if (!userData) {
                    (0, helper_1.SendResponse)(res, 401);
                    return;
                }
                const isValidPassword = (0, bcrypt_1.compareSync)(password, userData.password);
                if (!isValidPassword) {
                    (0, helper_1.SendResponse)(res, 401);
                    return;
                }
            }
            let expiredAt = rememberMe
                ? (0, helper_1.getDateByNumDay)(7)
                : (0, helper_1.getDateByNumDay)(1);
            const accessExpiredAt = (0, helper_1.getDateByMinute)(30);
            //  Generate tokens in parallel
            let session_id;
            let access_id;
            let isExistedLogin = existed === "1";
            let existedUserRefreshToken = isExistedLogin &&
                req.cookies[process.env.REFRESH_TOKEN_COOKIE];
            //Check if the registered login as guest
            if (isGuest) {
                const registeredUser = await User_model_1.default.findOne({ email });
                if (registeredUser) {
                    (0, helper_1.SendResponse)(res, 400, undefined, "User exist please login as user");
                    return;
                }
            }
            //Check usersession if existed login
            if (existedUserRefreshToken) {
                const isVerified = (0, helper_1.ExtractTokenPayload)({
                    token: existedUserRefreshToken,
                });
                if (!isVerified)
                    return res.status(401).json((0, helper_1.ReturnCode)(401));
                const isUser = await Usersession_model_1.default.findOne({
                    session_id: existedUserRefreshToken,
                })
                    .select("expireAt user")
                    .populate("user")
                    .lean();
                if (!isUser || !isUser.user?.email) {
                    (0, helper_1.SendResponse)(res, 401);
                    return;
                }
                if (isUser.expireAt <= new Date()) {
                    await Usersession_model_1.default.deleteOne({ _id: isUser._id });
                    (0, helper_1.SendResponse)(res, 401);
                    return;
                }
                existedUserRefreshToken = {
                    ...isVerified,
                    userDetails: {
                        _id: isUser._id,
                        email: isUser.user.email,
                        role: isUser.user.role,
                    },
                };
                expiredAt = isUser.expireAt;
            }
            //Duplication session prevention
            const userEmail = (isExistedLogin
                ? existedUserRefreshToken.userDetails?.email
                : email);
            const [hasDuplicateSession, existingResponse] = await Promise.all([
                this.handleDuplicateSession(userEmail, formId, res, form),
                form.setting?.submitonce
                    ? Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        respondentEmail: userEmail,
                    })
                        .select("_id totalScore submittedAt")
                        .lean()
                    : Promise.resolve(null),
            ]);
            if (hasDuplicateSession) {
                return; // Response already sent by handleDuplicateSession
            }
            const isResponsed = existingResponse
                ? {
                    message: "You already submitted a response to this form",
                    responseId: existingResponse._id.toString(),
                    totalScore: existingResponse.totalScore,
                    maxScore: form.totalscore,
                    submittedAt: existingResponse.submittedAt,
                }
                : undefined;
            const expiresInSeconds = expiredAt
                ? Math.floor((expiredAt.getTime() - Date.now()) / 1000)
                : "1d"; //Testing expiration token
            try {
                [session_id, access_id] = await Promise.all([
                    this.GenerateUniqueSessionId({
                        email: userEmail,
                        expireIn: expiresInSeconds,
                    }),
                    this.GenerateUniqueAccessId({
                        email: userEmail,
                        formId,
                        expireIn: "1m",
                    }),
                ]);
            }
            catch (tokenError) {
                (0, helper_1.SendResponse)(res, 500);
                return;
            }
            await Formsession_model_1.default.create({
                form: new mongoose_1.Types.ObjectId(formId),
                session_id,
                access_id,
                expiredAt,
                respondentEmail: userEmail,
                respondentName: name ?? userEmail.split("@")[0], // Extract name from email if not provided
                isGuest,
            });
            // Set main session cookie (refresh token)
            this.setCookie(res, session_id, process.env.RESPONDENT_COOKIE, expiredAt);
            // Set access token cookie
            this.setCookie(res, access_id, process.env.ACCESS_RESPONDENT_COOKIE, accessExpiredAt);
            return res.status(200).json({
                success: true,
                status: 200,
                message: "Login successful",
                data: {
                    expiresAt: expiredAt?.toISOString(),
                    isGuest,
                    isResponsed,
                },
            });
        }
        catch (error) {
            (0, helper_1.SendResponse)(res, 500);
        }
    };
    //   Replace all active session with new one
    static ReplaceSession = async (req, res) => {
        if (!process.env.RESPONDENT_TOKEN_JWT_SECRET ||
            !process.env.ACCESS_RESPONDENT_COOKIE ||
            !process.env.RESPONDENT_COOKIE) {
            return res.status(500).json({
                success: false,
                status: 500,
                message: "Server configuration error",
                error: "MISSING_ENV_VARIABLES",
            });
        }
        const { code } = req.params;
        const { skiplogin, verify } = req.query;
        if (!code)
            return res.status(404).json((0, helper_1.ReturnCode)(404));
        if (verify && !Number(parseInt(verify, 10)) && verify !== "1")
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        //Access Verification
        if (verify) {
            const isFormSession = await Formsession_model_1.default.countDocuments({
                removeCode: code,
            });
            if (!isFormSession || isFormSession === 0) {
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200));
        }
        const isSkipAutoLogin = skiplogin ? parseInt(skiplogin, 10) : undefined;
        if (isSkipAutoLogin && (isSkipAutoLogin !== 1 || isNaN(isSkipAutoLogin))) {
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        }
        try {
            const formsession = await Formsession_model_1.default.findOne({
                removeCode: code,
            })
                .populate({
                path: "form",
                select: "setting.acceptResponses",
                options: { lean: true },
            })
                .select("_id form respondentEmail respondentName isGuest")
                .lean()
                .exec();
            if (!formsession) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Invalid code"));
            }
            const form = formsession.form;
            if (!form?.setting?.acceptResponses) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form is closed"));
            }
            if (isSkipAutoLogin === 1) {
                await Formsession_model_1.default.deleteOne({ _id: formsession._id }).lean();
                const clearOptions = {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "PROD",
                    sameSite: "strict",
                };
                res.clearCookie(process.env.RESPONDENT_COOKIE, clearOptions);
                res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE, clearOptions);
                return res.status(200).json((0, helper_1.ReturnCode)(200, "Session Terminated"));
            }
            const [newUniqueSessionId, newUniqueAccessId] = await Promise.all([
                this.GenerateUniqueSessionId({
                    email: formsession.respondentEmail,
                    expireIn: "7d",
                }),
                this.GenerateUniqueAccessId({
                    email: formsession.respondentEmail,
                    expireIn: "30m",
                }),
            ]);
            const expiredAt = formsession.isGuest
                ? (0, helper_1.getDateByNumDay)(1)
                : (0, helper_1.getDateByNumDay)(7);
            await Formsession_model_1.default.updateOne({ _id: formsession._id }, {
                session_id: newUniqueSessionId,
                access_id: newUniqueAccessId,
                expiredAt,
                $unset: { removeCode: 1 },
            }).lean();
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "PROD",
                sameSite: "strict",
            };
            // Set main session cookie
            res.cookie(process.env.RESPONDENT_COOKIE, newUniqueSessionId, {
                ...cookieOptions,
                maxAge: expiredAt.getTime() - Date.now(),
            });
            // Set access cookie with shorter expiration
            if (newUniqueAccessId) {
                const accessExpiry = (0, helper_1.getDateByMinute)(30);
                res.cookie(process.env.ACCESS_RESPONDENT_COOKIE, newUniqueAccessId, { ...cookieOptions, maxAge: accessExpiry.getTime() - Date.now() });
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Logging to form"));
        }
        catch (error) {
            console.error("Replace form session error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Session replacement failed"));
        }
    };
    static SignOut = async (req, res) => {
        try {
            await Formsession_model_1.default.deleteOne({ session_id: req.formsession?.sub });
            // Clear cookies with the same options used when setting them
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "PROD",
                sameSite: "strict",
            };
            // Clear both respondent cookies
            res.clearCookie(process.env.RESPONDENT_COOKIE, cookieOptions);
            res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE, cookieOptions);
            // Return success only after cookies are cleared
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Logged Out"));
        }
        catch (error) {
            console.log("SignOut", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    /**
     * Session verification && Renew Access Session Token
     */
    static SessionVerification = async (req, res) => {
        if (!process.env.RESPONDENT_COOKIE ||
            !process.env.RESPONDENT_TOKEN_JWT_SECRET ||
            !process.env.ACCESS_RESPONDENT_COOKIE) {
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
        try {
            const { formId } = req.params;
            const isForm = await Form_model_1.default.findOne({
                _id: new mongoose_1.Types.ObjectId(formId),
            })
                .select("_id type setting.email")
                .lean();
            if (!isForm) {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            //If the form doesn't require the authentication skipped the verification
            if (!isForm.setting?.email)
                return res.status(200).json({
                    data: {
                        isNormalForm: true,
                    },
                });
            //Get Cookies
            const respondentCookie = req.cookies[process.env.RESPONDENT_COOKIE];
            const accessRespondentCookie = req.cookies[process.env.ACCESS_RESPONDENT_COOKIE];
            if (!respondentCookie) {
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            }
            const session = await Formsession_model_1.default.findOne({
                session_id: respondentCookie,
            }).lean();
            if (!session)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            const extractedToken = this.ExtractToken({
                token: respondentCookie,
            });
            //Refresh token expired or invalid
            if (extractedToken.isExpired || !extractedToken.data) {
                //Clear invalid session
                res.clearCookie(process.env.RESPONDENT_COOKIE);
                res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE);
                await Formsession_model_1.default.deleteOne({ session_id: respondentCookie });
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Session expired"));
            }
            //Verify AccessToken
            const verifiedAccessToken = accessRespondentCookie
                ? this.ExtractToken({
                    token: accessRespondentCookie,
                })
                : undefined;
            if (verifiedAccessToken &&
                !verifiedAccessToken.data &&
                !verifiedAccessToken.isExpired) {
                return res.status(401).json({
                    ...(0, helper_1.ReturnCode)(401, "Invalid Session"),
                });
            }
            //If access token expired, regenerate it
            if (!verifiedAccessToken || verifiedAccessToken.isExpired) {
                const newAccessId = await FormsessionService.GenerateUniqueAccessId({
                    email: session.respondentEmail,
                });
                await Formsession_model_1.default.updateOne({ session_id: session.session_id }, { access_id: newAccessId });
                FormsessionService.setCookie(res, newAccessId, process.env.ACCESS_RESPONDENT_COOKIE, (0, helper_1.getDateByMinute)(30));
            }
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: {
                    respondentEmail: session.respondentEmail,
                    respondentName: session.respondentName,
                    isGuest: session.isGuest,
                    expiresAt: session.expiredAt,
                },
            });
        }
        catch (error) {
            console.log("Session verification", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    static ExtractToken = ({ token, customSecret, }) => {
        try {
            const isValid = jsonwebtoken_1.default.verify(token, customSecret ?? (process.env.RESPONDENT_TOKEN_JWT_SECRET || "secret"));
            if (isValid) {
                return { data: isValid };
            }
            return { data: null, isExpired: false };
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                return { data: null, isExpired: true };
            }
            return { data: null, isExpired: false };
        }
    };
    static GenerateUniqueRemoveCode = async ({ formsession, maxAttempts = 5, }) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Generate 6-digit codes with better distribution
            const removeCode = Math.floor(100000 + Math.random() * 900000);
            const existingCode = await formsession.exists({
                removeCode: String(removeCode),
            });
            if (!existingCode) {
                return removeCode;
            }
        }
        // Fallback with timestamp-based uniqueness
        const timestampCode = Math.floor(Date.now() % 900000) + 100000;
        return timestampCode;
    };
    static SendRemovalEmail = async ({ respondentEmail, removeCode, formId, }) => {
        try {
            if (!formId)
                return { success: false, message: "Missing Parameter" };
            // Get form title if formId is provided
            const form = await Form_model_1.default.findById(formId).select("title").lean();
            if (!form)
                return { success: false, message: "Form not found" };
            const result = await (0, removalEmail_1.sendRemovalLinkEmail)(respondentEmail, removeCode, formId, form?.title ?? "Form");
            if (result.success) {
                console.log(`Removal email sent successfully to ${respondentEmail}`);
            }
            else {
                console.error(`Failed to send removal email to ${respondentEmail}: ${result.message}`);
            }
            return result;
        }
        catch (error) {
            console.error("SendRemovalEmail error:", error);
            return {
                success: false,
                message: `Failed to send removal email: ${error.message}`,
            };
        }
    };
    static SendRemovalEmailEndpoint = async (req, res) => {
        const { respondentEmail, removeCode, formId } = req.body;
        const validationResult = this.sendEmailSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                ...(0, helper_1.ReturnCode)(400, "Invalid request parameters"),
                errors: validationResult.error.errors,
            });
        }
        try {
            const result = await this.SendRemovalEmail({
                respondentEmail,
                removeCode,
                formId,
            });
            if (result.success) {
                return res.status(200).json({
                    ...(0, helper_1.ReturnCode)(200, "Removal email sent successfully"),
                });
            }
            else {
                return res.status(500).json({
                    ...(0, helper_1.ReturnCode)(500, result.message),
                });
            }
        }
        catch (error) {
            console.error("SendRemovalEmailEndpoint error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
}
exports.default = FormsessionService;
