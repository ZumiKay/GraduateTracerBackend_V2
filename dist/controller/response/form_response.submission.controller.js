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
exports.FormResponseSubmissionController = void 0;
const helper_1 = require("../../utilities/helper");
const MongoErrorHandler_1 = require("../../utilities/MongoErrorHandler");
const zod_1 = __importDefault(require("zod"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const ResponseProcessingService_1 = require("../../services/ResponseProcessingService");
const RespondentTrackingService_1 = require("../../services/RespondentTrackingService");
const ResponseQueryService_1 = require("../../services/ResponseQueryService");
const Formsession_model_1 = __importDefault(require("../../model/Formsession.model"));
const User_middleware_1 = require("../../middleware/User.middleware");
const notification_controller_1 = require("../utils/notification.controller");
class FormResponseSubmissionController {
    constructor() {
        this.GetFormForRespondent = (req, res) => __awaiter(this, void 0, void 0, function* () {
            return this.GetPublicFormData(req, res);
        });
        this.SubmitFormResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const submissionId = `submission_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 11)}`;
            try {
                const validationResult = this.validateSubmissionInput(req.body);
                if (!validationResult.isValid) {
                    return res.status(400).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, validationResult.message)), { validationErrors: validationResult.errors, submissionId }));
                }
                const { responseSet = [], respondentEmail, respondentName, } = req.body;
                const { formId } = req.params;
                const form = yield Form_model_1.default.findById(formId)
                    .select("setting type title totalscore")
                    .lean();
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                let submissionDataWithTracking;
                const baseSubmissionData = {
                    formId: new mongoose_1.Types.ObjectId(formId),
                    responseset: responseSet,
                    respondentEmail,
                    respondentName,
                };
                submissionDataWithTracking =
                    RespondentTrackingService_1.RespondentTrackingService.createSubmissionWithTracking(baseSubmissionData, req);
                let result;
                try {
                    //Quiz type process
                    if (form.type === Form_model_1.TypeForm.Quiz) {
                        result = yield ResponseProcessingService_1.ResponseProcessingService.processFormSubmission(submissionDataWithTracking, form);
                    }
                    //Normal type process
                    else {
                        result = yield ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission(submissionDataWithTracking);
                    }
                }
                catch (processingError) {
                    console.error(`[${submissionId}] Error during form processing:`, processingError);
                    if (processingError instanceof Error) {
                        const errorResponse = this.handleProcessingError(processingError, submissionId);
                        if (errorResponse) {
                            return res.status(errorResponse.status).json(errorResponse.body);
                        }
                    }
                    return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500, "Failed to process form submission")), { submissionId, error: processingError instanceof Error
                            ? processingError.message
                            : "Unknown processing error" }));
                }
                if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.submitonce) && req.formsession) {
                    res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE);
                    res.clearCookie(process.env.RESPONDENT_COOKIE);
                    yield Formsession_model_1.default.deleteOne({ session_id: req.formsession.sub });
                }
                //Create Notification for formOwner
                if (result.responseId) {
                    yield notification_controller_1.NotificationController.NotifyNewResponse(formId, result.responseId, {
                        name: respondentName,
                        email: respondentEmail,
                    });
                }
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form submitted successfully")), { data: result, submissionId, meta: {
                        formId,
                        formType: form.type,
                        submittedAt: new Date().toISOString(),
                    } }));
            }
            catch (error) {
                console.error(`[${submissionId}] Unexpected error in SubmitFormResponse:`, {
                    error: error instanceof Error
                        ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                        }
                        : error,
                    requestBody: req.body,
                    userAgent: req.headers["user-agent"],
                    ip: req.ip,
                });
                if (error instanceof Error) {
                    const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
                        operationId: submissionId,
                        customMessage: "Database operation failed during form submission",
                        includeErrorDetails: true,
                    });
                    if (mongoErrorHandled.handled) {
                        return;
                    }
                    if (error.name === "ValidationError" || error.name === "CastError") {
                        return res.status(400).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Invalid data provided")), { submissionId, error: error.message }));
                    }
                    if (error.message.includes("timeout") ||
                        error.name === "TimeoutError") {
                        return res.status(408).json({
                            code: 408,
                            message: "Request timeout - please try again",
                            submissionId,
                        });
                    }
                }
                return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500, "An unexpected error occurred during form submission")), { submissionId, timestamp: new Date().toISOString(), supportMessage: "Please contact support with the submission ID if this problem persists" }));
            }
        });
        this.GetPublicFormData = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                if (!process.env.REFRESH_TOKEN_COOKIE ||
                    !process.env.ACCESS_TOKEN_COOKIE ||
                    !process.env.RESPONDENT_COOKIE) {
                    throw new Error("Missing important Environment");
                }
                const { formId } = req.params;
                let { p, ty } = req.query;
                if (!ty)
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                if (!mongoose_1.Types.ObjectId.isValid(formId)) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                }
                const page = Number(p !== null && p !== void 0 ? p : "1");
                const isUserAlreadyAuthenticated = !!req.formsession;
                if (req.formsession) {
                    ty = User_middleware_1.GetPublicFormDataTyEnum.data;
                }
                switch (ty) {
                    case "initial": {
                        const initialData = yield Form_model_1.default.findById(formId)
                            .select("_id title type totalpage totalscore setting.email setting.acceptResponses setting.acceptGuest setting.submitonce")
                            .lean();
                        if (!initialData || !((_a = initialData.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses)) {
                            return res
                                .status(404)
                                .json((0, helper_1.ReturnCode)(404, initialData ? "Form is closed" : "Form not found"));
                        }
                        let isAuthenticated = false;
                        if ((_b = initialData.setting) === null || _b === void 0 ? void 0 : _b.email) {
                            if (isUserAlreadyAuthenticated) {
                                try {
                                    const formData = yield ResponseQueryService_1.ResponseQueryService.getPublicFormData(formId, page, req, res);
                                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign(Object.assign({}, initialData), { isAuthenticated: true, isLoggedin: true }), formData) }));
                                }
                                catch (error) {
                                    console.warn("Failed to fetch form content for authenticated user:", error);
                                    return res.status(200).json((0, helper_1.ReturnCode)(500));
                                }
                            }
                            isAuthenticated = false;
                        }
                        else {
                            isAuthenticated = true;
                        }
                        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, initialData), { isAuthenticated }) }));
                    }
                    case "data": {
                        if (!mongoose_1.Types.ObjectId.isValid(formId)) {
                            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                        }
                        const formData = yield ResponseQueryService_1.ResponseQueryService.getPublicFormData(formId, page, req, res);
                        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign(Object.assign({}, formData), { isAuthenticated: true }), (req.formsession && { isLoggedIn: true })) }));
                    }
                    default:
                        res.status(204).json((0, helper_1.ReturnCode)(204));
                }
            }
            catch (error) {
                console.error("Get Public Form Data Error:", error);
                if (error instanceof Error) {
                    if (error.message === "Form not found") {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, error.message));
                    }
                    if (error.message === "Form is no longer accepting responses") {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, error.message));
                    }
                    if (error.message === "You already submitted this form") {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, error.message));
                    }
                }
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve form data"));
            }
        });
    }
    validateSubmissionInput(body) {
        const errors = [];
        if (!body) {
            return {
                isValid: false,
                message: "Request body is required",
                errors: ["Request body is missing"],
            };
        }
        const { responseSet, respondentEmail, respondentName } = body;
        if (!responseSet) {
            errors.push("Response set is required");
        }
        else if (!Array.isArray(responseSet)) {
            errors.push("Response set must be an array");
        }
        else if (responseSet.length === 0) {
            errors.push("At least one response is required");
        }
        else {
            responseSet.forEach((response, index) => {
                if (!response.question) {
                    errors.push(`Response ${index + 1}: Question ID is required`);
                }
                if (response.response === undefined || response.response === null) {
                    errors.push(`Response ${index + 1}: Answer is required`);
                }
            });
        }
        if (respondentEmail && typeof respondentEmail === "string") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(respondentEmail)) {
                errors.push("Invalid email format");
            }
        }
        if (respondentName &&
            (typeof respondentName !== "string" || respondentName.trim().length === 0)) {
            errors.push("Respondent name must be a non-empty string if provided");
        }
        return {
            isValid: errors.length === 0,
            message: errors.length > 0 ? "Validation failed" : "Validation passed",
            errors,
        };
    }
    handleProcessingError(error, submissionId) {
        const errorMessage = error.message.toLowerCase();
        if (error.message === "Require" || errorMessage.includes("required")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Missing required questions")), { submissionId, error: "Please ensure all required questions are answered" }),
            };
        }
        if (error.message === "Format" ||
            errorMessage.includes("format") ||
            errorMessage.includes("invalid answer")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Invalid answer format")), { submissionId, error: "One or more answers are in an invalid format" }),
            };
        }
        if (errorMessage.includes("question not found")) {
            return {
                status: 404,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(404, "Question not found")), { submissionId, error: "One or more questions in your response could not be found" }),
            };
        }
        if (error.message === "Form not found" ||
            errorMessage.includes("form not found")) {
            return {
                status: 404,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(404, "Form not found")), { submissionId, error: error.message }),
            };
        }
        if (error.message === "Email is required for this form" ||
            errorMessage.includes("email is required")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Email is required")), { submissionId, error: "This form requires an email address to submit" }),
            };
        }
        if (error.message === "Form already exisited" ||
            errorMessage.includes("already submitted") ||
            errorMessage.includes("duplicate")) {
            return {
                status: 409,
                body: {
                    code: 409,
                    message: "Duplicate submission",
                    submissionId,
                    error: "You have already submitted a response to this form",
                },
            };
        }
        if (errorMessage.includes("access denied") ||
            errorMessage.includes("unauthorized")) {
            return {
                status: 403,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(403, "Access denied")), { submissionId, error: "You don't have permission to submit to this form" }),
            };
        }
        if (errorMessage.includes("form is closed") ||
            errorMessage.includes("form is inactive")) {
            return {
                status: 403,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(403, "Form is not available")), { submissionId, error: "This form is no longer accepting responses" }),
            };
        }
        return null;
    }
    GetInititalFormData(formId, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!formId)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            try {
                const formdata = yield Form_model_1.default.findById(formId)
                    .select("_id setting.acceptResponses")
                    .exec();
                if (!formdata) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404));
                }
                return res.status(200).json({ data: formdata });
            }
            catch (error) {
                console.log("Get Initial Formdata", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
    }
}
exports.FormResponseSubmissionController = FormResponseSubmissionController;
FormResponseSubmissionController.publicSubmitValidate = zod_1.default.object({
    body: zod_1.default.object({
        formId: zod_1.default.string().min(1, "Form is required"),
        respondentEmail: zod_1.default.string().email().optional(),
        respondentName: zod_1.default.string().optional(),
    }),
});
exports.default = new FormResponseSubmissionController();
