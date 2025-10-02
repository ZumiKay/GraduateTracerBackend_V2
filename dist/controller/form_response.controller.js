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
exports.FormResponseController = void 0;
const helper_1 = require("../utilities/helper");
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
const zod_1 = __importDefault(require("zod"));
const mongoose_1 = require("mongoose");
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
const EmailService_1 = __importDefault(require("../services/EmailService"));
const FormLinkService_1 = __importDefault(require("../services/FormLinkService"));
const User_model_1 = __importDefault(require("../model/User.model"));
const ResponseValidationService_1 = require("../services/ResponseValidationService");
const ResponseQueryService_1 = require("../services/ResponseQueryService");
const ResponseProcessingService_1 = require("../services/ResponseProcessingService");
const ResponseAnalyticsService_1 = require("../services/ResponseAnalyticsService");
const RespondentTrackingService_1 = require("../services/RespondentTrackingService");
const respondentUtils_1 = require("../utilities/respondentUtils");
const Form_model_1 = __importStar(require("../model/Form.model"));
const Content_model_1 = __importDefault(require("../model/Content.model"));
const Response_model_1 = __importDefault(require("../model/Response.model"));
const formHelpers_1 = require("../utilities/formHelpers");
class FormResponseController {
    constructor() {
        this.GetResponseByFormId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid)
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.id, res);
                if (!form)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, validation.page, validation.limit);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get Response By FormId Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        this.GetResponseByUser = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid)
                    return;
                const { respondentEmail, formId } = req.query;
                if (!respondentEmail || !formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                }
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.id, res);
                if (!form)
                    return;
                let populatedResponse = yield Response_model_1.default.findOne({
                    $and: [
                        {
                            formId,
                        },
                        {
                            respondentEmail,
                        },
                    ],
                })
                    .select("_id responseset totalScore isCompleted completionStatus respondentEmail respondentName respondentType submittedAt")
                    .lean();
                //Populate response set question
                const responseContent = yield Content_model_1.default.find({
                    _id: { $in: populatedResponse === null || populatedResponse === void 0 ? void 0 : populatedResponse.responseset.map((i) => i.question) },
                }).lean();
                populatedResponse = Object.assign(Object.assign({}, populatedResponse), { responseset: populatedResponse === null || populatedResponse === void 0 ? void 0 : populatedResponse.responseset.map((res) => {
                        return Object.assign(Object.assign({}, res), { question: responseContent.find((q) => q._id === res.question) });
                    }) });
                if (!populatedResponse) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                }
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: populatedResponse }));
            }
            catch (error) {
                console.error("Get Response By UserId Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve response"));
            }
        });
        this.ValidateFormForSubmission = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { formId } = req.query;
            if (!formId || typeof formId !== "string") {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
            }
            try {
                const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
                const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors, canSubmit: errors.length === 0 }) }));
            }
            catch (error) {
                console.error("Validate Form Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
            }
        });
        // Send form links via email
        this.SendFormLinks = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: true,
                });
                if (!validation.isValid)
                    return;
                const { formId, emails, message } = req.body;
                if (!formId || !emails || !Array.isArray(emails) || emails.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Form ID and email list are required"));
                }
                const form = yield Form_model_1.default.findById(formId);
                if (!form || !((_a = form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses)) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (form.user.toString() !== ((_b = validation.user.id) === null || _b === void 0 ? void 0 : _b.toString())) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                const emailService = new EmailService_1.default();
                const userDetails = yield User_model_1.default.findById(validation.user.id);
                const success = yield emailService.sendFormLinks({
                    formId,
                    formTitle: form.title,
                    formOwner: (userDetails === null || userDetails === void 0 ? void 0 : userDetails.email) || "Form Owner",
                    recipientEmails: emails,
                    message,
                });
                res
                    .status(200)
                    .json((0, helper_1.ReturnCode)(200, success
                    ? "Form links sent successfully"
                    : "Failed to send form links"));
            }
            catch (error) {
                console.error("Send Form Links Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send form links"));
            }
        });
        // Generate form link
        this.GenerateFormLink = (req, res) => __awaiter(this, void 0, void 0, function* () {
            if (!req.user)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            try {
                const { formId } = req.body;
                if (!formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                }
                const form = yield Form_model_1.default.findById(formId);
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (!(0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.creator, form, req.user.id) ||
                    !(0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.owner, form, req.user.id)) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                const linkService = new FormLinkService_1.default();
                const link = yield linkService.getValidatedFormLink(formId);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: link }));
            }
            catch (error) {
                const err = error;
                console.error("Generate Form Link Error:", error);
                return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500, "Failed to generate form link")), { error: err === null || err === void 0 ? void 0 : err.message }));
            }
        });
        this.GetFormForRespondent = (req, res) => __awaiter(this, void 0, void 0, function* () {
            return this.GetPublicFormData(req, res);
        });
        // Submit respondent response
        this.SubmitFormResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const submissionId = `submission_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 11)}`;
            try {
                const validationResult = this.validateSubmissionInput(req.body);
                if (!validationResult.isValid) {
                    console.warn(`[${submissionId}] Input validation failed:`, validationResult.errors);
                    return res.status(400).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, validationResult.message)), { validationErrors: validationResult.errors, submissionId }));
                }
                const { formInfo, responseSet, respondentEmail, respondentName } = req.body;
                let form;
                try {
                    form = yield Form_model_1.default.findById(formInfo._id)
                        .select("setting type title")
                        .lean();
                }
                catch (dbError) {
                    const errorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(dbError, res, {
                        operationId: submissionId,
                        customMessage: "Failed to retrieve form information",
                        includeErrorDetails: true,
                    });
                    if (errorHandled.handled) {
                        return;
                    }
                    console.error(`[${submissionId}] Unexpected error retrieving form:`, dbError);
                    return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500, "Database error occurred while retrieving form")), { submissionId, formId: formInfo._id }));
                }
                if (!form) {
                    console.warn(`[${submissionId}] Form not found:`, formInfo._id);
                    return res.status(404).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(404, "Form not found")), { submissionId, formId: formInfo._id }));
                }
                if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.submitonce) && form.type === Form_model_1.TypeForm.Normal) {
                    try {
                        const trackingResult = yield RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists(formInfo._id.toString(), req, Response_model_1.default);
                        if (trackingResult.hasResponded) {
                            console.info(`[${submissionId}] Duplicate submission detected:`, {
                                formId: formInfo._id,
                                trackingMethod: trackingResult.trackingMethod,
                                responseId: trackingResult.responseId,
                            });
                            return res.status(409).json({
                                code: 409,
                                message: "Duplicate submission detected",
                                details: `You have already submitted a response to this form`,
                                trackingMethod: trackingResult.trackingMethod,
                                previousResponseId: trackingResult.responseId,
                                submissionId,
                                formTitle: form.title,
                            });
                        }
                    }
                    catch (trackingError) {
                        console.error(`[${submissionId}] Error during duplicate check:`, trackingError);
                    }
                }
                let submissionDataWithTracking;
                try {
                    const baseSubmissionData = {
                        formId: formInfo._id.toString(),
                        responseset: responseSet,
                        respondentEmail,
                        respondentName,
                    };
                    submissionDataWithTracking =
                        RespondentTrackingService_1.RespondentTrackingService.createSubmissionWithTracking(baseSubmissionData, req);
                }
                catch (trackingError) {
                    console.error(`[${submissionId}] Error creating tracking data:`, trackingError);
                    return res.status(500).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(500, "Failed to prepare submission data")), { submissionId, error: trackingError instanceof Error
                            ? trackingError.message
                            : "Unknown tracking error" }));
                }
                let result;
                try {
                    if (formInfo.type === Form_model_1.TypeForm.Quiz) {
                        result = yield ResponseProcessingService_1.ResponseProcessingService.processFormSubmission(submissionDataWithTracking);
                    }
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
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form submitted successfully")), { data: result, submissionId, meta: {
                        formId: formInfo._id,
                        formType: formInfo.type,
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
                    // Handle MongoDB/Database errors first
                    const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
                        operationId: submissionId,
                        customMessage: "Database operation failed during form submission",
                        includeErrorDetails: true,
                    });
                    if (mongoErrorHandled.handled) {
                        return;
                    }
                    // Handle validation errors
                    if (error.name === "ValidationError" || error.name === "CastError") {
                        return res.status(400).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Invalid data provided")), { submissionId, error: error.message }));
                    }
                    // Handle timeout errors
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
        // Get responses with filtering and pagination
        this.GetResponsesWithFilters = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: true,
                });
                if (!validation.isValid)
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.id, res);
                if (!form)
                    return;
                // Extract filter parameters matching frontend implementation
                const filters = {
                    formId: validation.formId,
                    searchTerm: req.query.q,
                    completionStatus: req.query.status,
                    startDate: req.query.startD,
                    endDate: req.query.endD,
                    minScore: req.query.startS,
                    maxScore: req.query.endS,
                    email: req.query.email,
                    sortBy: req.query.sortBy,
                    sortOrder: req.query.sortOrder,
                    page: validation.page,
                    limit: validation.limit,
                };
                const result = yield ResponseQueryService_1.ResponseQueryService.getResponsesWithFilters(filters);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get Responses With Filters Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        // Manual scoring for responses
        this.UpdateResponseScore = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid)
                    return;
                const { responseId, scores } = req.body;
                if (!responseId || !scores || !Array.isArray(scores)) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Response ID and scores are required"));
                }
                const { response, form } = yield ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.id, res);
                if (!response || !form)
                    return;
                yield ResponseProcessingService_1.ResponseProcessingService.updateResponseScores(responseId, scores);
                res.status(200).json((0, helper_1.ReturnCode)(200, "Scores updated successfully"));
            }
            catch (error) {
                console.error("Update Response Score Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update scores"));
            }
        });
        // Get response analytics for charts
        this.GetResponseAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid)
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.id, res);
                if (!form)
                    return;
                const responses = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, 1, 1000 // Get all responses for analytics
                );
                const analytics = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getResponseAnalytics(validation.formId, responses.responses, form);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analytics }));
            }
            catch (error) {
                console.error("Get Response Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        this.GetPublicFormData = (req, res, isPrivate) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { formId } = req.params;
                const { p, ty } = req.query;
                const page = Number(p !== null && p !== void 0 ? p : "1");
                if (!formId || !ty)
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                //handle Form data type base on fetch type
                switch (ty) {
                    case "initial": {
                        const initialData = yield Form_model_1.default.findById(formId)
                            .select("_id setting.acceptResponses")
                            .exec();
                        if (!initialData) {
                            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                        }
                        return res
                            .status(200)
                            .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: initialData }));
                    }
                    case "data": {
                        const formData = yield ResponseQueryService_1.ResponseQueryService.getPublicFormData(formId, page, req, res);
                        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formData }));
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
        // Get analytics data for a form
        this.GetFormAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid)
                    return;
                const { formId } = req.params;
                const { period = "7d" } = req.query;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.id, res);
                if (!form)
                    return;
                const analyticsData = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId, period);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analyticsData }));
            }
            catch (error) {
                console.error("Get Form Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        // Export analytics as PDF or CSV
        this.ExportAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid)
                    return;
                const { formId } = req.params;
                const { format = "pdf" } = req.query;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.id, res);
                if (!form)
                    return;
                const analyticsData = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId);
                if (format === "csv") {
                    const responses = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formId, 1, 1000);
                    const csvData = ResponseAnalyticsService_1.ResponseAnalyticsService.generateCSVData(analyticsData, responses.responses);
                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader("Content-Disposition", `attachment; filename="${form.title}-analytics.csv"`);
                    res.send(csvData);
                }
                else {
                    res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Only CSV export is currently supported"));
                }
            }
            catch (error) {
                console.error("Export Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to export analytics"));
            }
        });
        // Export individual response as PDF
        this.ExportResponsePDF = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid)
                    return;
                const { formId, responseId } = req.params;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.id, res);
                if (!form)
                    return;
                // Get the specific response with full data
                const response = yield Response_model_1.default.findOne({
                    _id: new mongoose_1.Types.ObjectId(responseId),
                    formId: new mongoose_1.Types.ObjectId(formId),
                }).populate({
                    path: "responseset.questionId",
                    model: "Content",
                });
                if (!response) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                }
                // Generate PDF using Puppeteer
                const pdfBuffer = yield this.generateResponsePDF(form, response);
                // Get respondent name for filename
                const respondentName = (0, respondentUtils_1.getResponseDisplayName)(response) || "Response";
                const filename = `${respondentName}_${form.title}_Response.pdf`;
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                res.send(pdfBuffer);
            }
            catch (error) {
                console.error("Export Response PDF Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to export response as PDF"));
            }
        });
        // Get all responses by current user
        this.GetUserResponses = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { formId, page, uid, isValid } = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireUserInfo: true,
                    requireFormId: true,
                });
                if (!isValid || !uid || !formId)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.getUserResponses({
                    page: page !== null && page !== void 0 ? page : 1,
                    formId,
                    user: uid,
                    limit: 1, //Only one response
                });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get User Responses Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve user responses"));
            }
        });
        // Delete a response by ID
        this.DeleteResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: true,
                });
                if (!validation.isValid)
                    return;
                const { responseId } = req.params;
                if (!responseId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
                }
                const { response, form } = yield ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.id, res);
                if (!response || !form)
                    return;
                yield ResponseQueryService_1.ResponseQueryService.deleteResponse(responseId);
                res.status(200).json((0, helper_1.ReturnCode)(200, "Response deleted successfully"));
            }
            catch (error) {
                console.error("Delete Response Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete response"));
            }
        });
        this.BulkDeleteResponses = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid)
                    return;
                const { responseIds, formId } = req.body;
                if (!responseIds ||
                    !Array.isArray(responseIds) ||
                    responseIds.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Response IDs array is required"));
                }
                if (!formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                }
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.id, res);
                if (!form)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses(responseIds, formId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Responses deleted successfully")), { data: result }));
            }
            catch (error) {
                console.error("Bulk Delete Responses Error:", error);
                if (error instanceof Error && error.message.includes("don't exist")) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, error.message));
                }
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete responses"));
            }
        });
        // Send response as card email
        this.SendResponseCardEmail = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid)
                    return;
                const { responseId, recipientEmail } = req.body;
                if (!responseId || !recipientEmail) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Response ID and recipient email are required"));
                }
                const response = yield Response_model_1.default.findById(responseId)
                    .populate("formId")
                    .populate({
                    path: "responseset.question",
                })
                    .lean();
                if (!response) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                }
                const form = response.formId;
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                // Check if user has access to this form
                const hasAccess = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(form._id.toString(), validation.user.id, res);
                if (!hasAccess)
                    return;
                // Build questions array with scores and warnings
                const questions = [];
                let totalScore = 0;
                let maxScore = 0;
                let hasNonAutoScorableQuestions = false;
                const nonAutoScorableWarnings = new Set();
                // Process each response in the response set
                for (const responseItem of response.responseset) {
                    const question = responseItem.question;
                    if (!question)
                        continue;
                    const questionType = question.type;
                    const hasAnswerKey = question.answer &&
                        SolutionValidationService_1.default.isAnswerisempty(question.answer.answer);
                    const questionScore = question.score || 0;
                    maxScore += questionScore;
                    if (!hasAnswerKey) {
                        nonAutoScorableWarnings.add(question.qIdx);
                    }
                    questions.push({
                        title: (0, helper_1.contentTitleToString)(question.title),
                        type: questionType,
                        answer: hasAnswerKey
                            ? (_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer
                            : null,
                        userResponse: responseItem.response,
                        score: (_b = response.totalScore) !== null && _b !== void 0 ? _b : 0,
                        maxScore: questionScore,
                        isCorrect: responseItem.score === question.score,
                    });
                }
                // Prepare email data
                const emailData = {
                    to: recipientEmail,
                    formTitle: form.title || "Untitled Form",
                    totalScore: totalScore,
                    maxScore: maxScore,
                    responseId: responseId,
                    isAutoScored: form.type === Form_model_1.TypeForm.Quiz,
                    questions: questions,
                    respondentName: response.respondentName || "Anonymous",
                    submittedAt: response.createdAt,
                };
                // Send the email
                const emailService = new EmailService_1.default();
                const success = yield emailService.sendResponseResults(emailData);
                if (success) {
                    const message = hasNonAutoScorableQuestions
                        ? `Email sent successfully. Warning: ${nonAutoScorableWarnings.size} question(s) could not be auto-scored and require manual review.`
                        : "Email sent successfully";
                    res.status(200).json(Object.assign({}, (0, helper_1.ReturnCode)(200, message)));
                }
                else {
                    res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send email"));
                }
            }
            catch (error) {
                console.error("Send Response Card Email Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send response email"));
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
        const { formInfo, responseSet, respondentEmail, respondentName } = body;
        if (!formInfo) {
            errors.push("Form information is required");
        }
        else {
            if (!formInfo._id) {
                errors.push("Form ID is required");
            }
            if (!formInfo.type) {
                errors.push("Form type is required");
            }
            else if (!Object.values(Form_model_1.TypeForm).includes(formInfo.type)) {
                errors.push(`Invalid form type: ${formInfo.type}. Must be one of: ${Object.values(Form_model_1.TypeForm).join(", ")}`);
            }
        }
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
                if (!response.questionId) {
                    errors.push(`Response ${index + 1}: Question ID is required`);
                }
                if (response.answer === undefined || response.answer === null) {
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
        // Required field errors
        if (error.message === "Require" || errorMessage.includes("required")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Missing required questions")), { submissionId, error: "Please ensure all required questions are answered" }),
            };
        }
        // Format errors
        if (error.message === "Format" ||
            errorMessage.includes("format") ||
            errorMessage.includes("invalid answer")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Invalid answer format")), { submissionId, error: "One or more answers are in an invalid format" }),
            };
        }
        // Question not found errors
        if (errorMessage.includes("question not found")) {
            return {
                status: 404,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(404, "Question not found")), { submissionId, error: "One or more questions in your response could not be found" }),
            };
        }
        // Form not found errors
        if (error.message === "Form not found" ||
            errorMessage.includes("form not found")) {
            return {
                status: 404,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(404, "Form not found")), { submissionId, error: error.message }),
            };
        }
        // Email requirement errors
        if (error.message === "Email is required for this form" ||
            errorMessage.includes("email is required")) {
            return {
                status: 400,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400, "Email is required")), { submissionId, error: "This form requires an email address to submit" }),
            };
        }
        // Duplicate submission errors
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
        // Form access errors
        if (errorMessage.includes("access denied") ||
            errorMessage.includes("unauthorized")) {
            return {
                status: 403,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(403, "Access denied")), { submissionId, error: "You don't have permission to submit to this form" }),
            };
        }
        // Form closed/inactive errors
        if (errorMessage.includes("form is closed") ||
            errorMessage.includes("form is inactive")) {
            return {
                status: 403,
                body: Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(403, "Form is not available")), { submissionId, error: "This form is no longer accepting responses" }),
            };
        }
        return null; // Let the calling function handle unknown errors
    }
    //Get Respodnent Info
    GetResponsesInfo(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user)
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: true,
            });
            if (!validation.isValid)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            try {
                // Use aggregation pipeline to get unique respondent emails
                const form = yield Form_model_1.default.findById(validation.formId).select("_id owners editors user");
                const hasAccess = (0, formHelpers_1.hasFormAccess)(form, req.user.id);
                if (!hasAccess)
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                const respondents = yield Response_model_1.default.aggregate([
                    {
                        $match: {
                            formId: validation.formId,
                            respondentEmail: { $exists: true, $nin: [null, ""] },
                        },
                    },
                    {
                        $group: {
                            _id: "$respondentEmail",
                            respondentEmail: { $first: "$respondentEmail" },
                            respondentName: { $first: "$respondentName" },
                            respondentType: { $first: "$respondentType" },
                            responseCount: { $sum: 1 },
                            lastSubmitted: { $max: "$submittedAt" },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            respondentEmail: 1,
                            respondentName: 1,
                            respondentType: 1,
                            responseCount: 1,
                            lastSubmitted: 1,
                        },
                    },
                    {
                        $sort: { lastSubmitted: -1 },
                    },
                ]);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: respondents }));
            }
            catch (error) {
                console.log("Fetching respondentList", error);
                res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
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
    generateResponsePDF(form, response) {
        return __awaiter(this, void 0, void 0, function* () {
            const puppeteer = require("puppeteer");
            let browser;
            try {
                browser = yield puppeteer.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox"],
                });
                const page = yield browser.newPage();
                // Generate HTML content for the response
                const htmlContent = this.generateResponseHTML(form, response);
                yield page.setContent(htmlContent, { waitUntil: "networkidle0" });
                const pdfBuffer = yield page.pdf({
                    format: "A4",
                    printBackground: true,
                    margin: {
                        top: "20px",
                        right: "20px",
                        bottom: "20px",
                        left: "20px",
                    },
                });
                return pdfBuffer;
            }
            finally {
                if (browser) {
                    yield browser.close();
                }
            }
        });
    }
    generateResponseHTML(form, response) {
        var _a;
        const respondentName = (0, respondentUtils_1.getResponseDisplayName)(response);
        const submittedAt = response.submittedAt
            ? new Date(response.submittedAt).toLocaleDateString()
            : "N/A";
        let questionsHTML = "";
        // Process each response in the responseset
        if (response.responseset && Array.isArray(response.responseset)) {
            response.responseset.forEach((responseItem, index) => {
                var _a;
                const question = responseItem.questionId;
                if (!question)
                    return;
                const questionTitle = ((_a = question.title) === null || _a === void 0 ? void 0 : _a.text) || `Question ${index + 1}`;
                const questionType = question.type;
                let answerHTML = "";
                // Format answer based on question type
                switch (questionType) {
                    case "text":
                    case "email":
                    case "number":
                        answerHTML = responseItem.answer || "No answer provided";
                        break;
                    case "multiple":
                    case "selection":
                        if (Array.isArray(responseItem.answer)) {
                            answerHTML = responseItem.answer.join(", ");
                        }
                        else {
                            answerHTML = responseItem.answer || "No selection made";
                        }
                        break;
                    case "checkbox":
                        if (Array.isArray(responseItem.answer)) {
                            answerHTML = responseItem.answer.join(", ");
                        }
                        else {
                            answerHTML = "No options selected";
                        }
                        break;
                    case "rangedate":
                        if (responseItem.answer &&
                            Array.isArray(responseItem.answer) &&
                            responseItem.answer.length === 2) {
                            const startDate = new Date(responseItem.answer[0]).toLocaleDateString();
                            const endDate = new Date(responseItem.answer[1]).toLocaleDateString();
                            answerHTML = `${startDate} - ${endDate}`;
                        }
                        else {
                            answerHTML = "No date range provided";
                        }
                        break;
                    case "rangenumber":
                        if (responseItem.answer &&
                            Array.isArray(responseItem.answer) &&
                            responseItem.answer.length === 2) {
                            answerHTML = `${responseItem.answer[0]} - ${responseItem.answer[1]}`;
                        }
                        else {
                            answerHTML = "No number range provided";
                        }
                        break;
                    default:
                        answerHTML =
                            JSON.stringify(responseItem.answer) || "No answer provided";
                }
                const score = responseItem.score !== undefined ? responseItem.score : "Not scored";
                questionsHTML += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="color: #333; margin-bottom: 10px; font-size: 16px;">${questionTitle}</h3>
            <p style="margin-bottom: 8px;"><strong>Type:</strong> ${questionType}</p>
            <p style="margin-bottom: 8px;"><strong>Answer:</strong> ${answerHTML}</p>
            <p style="margin-bottom: 0;"><strong>Score:</strong> ${score}</p>
          </div>
        `;
            });
        }
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response Export - ${form.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .form-title {
            color: #007bff;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .response-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .response-info p {
            margin: 5px 0;
          }
          .questions-section {
            margin-top: 20px;
          }
          .section-title {
            color: #007bff;
            font-size: 20px;
            margin-bottom: 20px;
            border-bottom: 1px solid #007bff;
            padding-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="form-title">${form.title}</h1>
          <p>Response Export</p>
        </div>
        
        <div class="response-info">
          <h2>Response Information</h2>
          <p><strong>Respondent:</strong> ${respondentName}</p>
          <p><strong>Email:</strong> ${response.respondentEmail || ((_a = response.guest) === null || _a === void 0 ? void 0 : _a.email) || "N/A"}</p>
          <p><strong>Total Score:</strong> ${response.totalScore || 0}/${form.totalscore || "N/A"}</p>
          <p><strong>Completion Status:</strong> ${response.completionStatus || "partial"}</p>
          <p><strong>Submitted:</strong> ${submittedAt}</p>
          <p><strong>Response ID:</strong> ${response._id}</p>
        </div>

        <div class="questions-section">
          <h2 class="section-title">Responses</h2>
          ${questionsHTML || "<p>No responses found.</p>"}
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `;
    }
}
exports.FormResponseController = FormResponseController;
// Public form submission validation
FormResponseController.publicSubmitValidate = zod_1.default.object({
    body: zod_1.default.object({
        formId: zod_1.default.string().min(1, "Form is required"),
        respondentEmail: zod_1.default.string().email().optional(),
        respondentName: zod_1.default.string().optional(),
    }),
});
// Send response card email validation
FormResponseController.sendResponseCardEmailValidate = zod_1.default.object({
    body: zod_1.default.object({
        responseId: zod_1.default.string().min(1, "Response ID is required"),
        recipientEmail: zod_1.default.string().email("Valid email is required"),
    }),
});
exports.default = new FormResponseController();
