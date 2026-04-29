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
exports.FormResponseUtilityController = void 0;
const helper_1 = require("../../utilities/helper");
const SolutionValidationService_1 = __importDefault(require("../../services/SolutionValidationService"));
const EmailService_1 = __importDefault(require("../../services/EmailService"));
const FormLinkService_1 = __importDefault(require("../../services/FormLinkService"));
const User_model_1 = __importDefault(require("../../model/User.model"));
const mongoose_1 = require("mongoose");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const Content_model_1 = require("../../model/Content.model");
const ResponseValidationService_1 = require("../../services/ResponseValidationService");
const formHelpers_1 = require("../../utilities/formHelpers");
const respondentUtils_1 = require("../../utilities/respondentUtils");
const SendResponseEmail_1 = require("../../utilities/EmailTemplate/SendResponseEmail");
class FormResponseUtilityController {
    constructor() {
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
        this.SendFormLinks = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: true,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { formId, emails, message } = req.body;
                if (!formId || !emails || !Array.isArray(emails) || emails.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Form ID and email list are required"));
                }
                const form = yield Form_model_1.default.findById(formId);
                if (!form || !((_b = form.setting) === null || _b === void 0 ? void 0 : _b.acceptResponses)) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                if (form.user.toString() !== validation.user.sub) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                }
                const emailService = new EmailService_1.default();
                const userDetails = yield User_model_1.default.findById(new mongoose_1.Types.ObjectId(validation.user.sub));
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
        this.GenerateFormLink = (req, res) => __awaiter(this, void 0, void 0, function* () {
            if (!req.user)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            try {
                const { formId } = req.body;
                if (!formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                }
                const form = yield Form_model_1.default.findById(formId).select("_id user owners editors");
                if (!form) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                }
                const hasAccess = (0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(req.user.sub));
                if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(req.user.sub))) {
                    return res.status(403).json((0, helper_1.ReturnCode)(403, "No Access"));
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
        this.SendResponseCardEmail = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { responseId, recipientEmail, includeAnswerKey = true } = req.body;
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
                const isQuizForm = form.type === Form_model_1.TypeForm.Quiz;
                const questions = [];
                let totalScore = 0;
                let maxScore = 0;
                let correctCount = 0;
                let incorrectCount = 0;
                for (const responseItem of response.responseset) {
                    const question = responseItem.question;
                    if (!question)
                        continue;
                    const questionType = question.type;
                    const hasAnswerKey = question.answer &&
                        SolutionValidationService_1.default.isAnswerisempty(question.answer.answer);
                    const questionMaxScore = question.score || 0;
                    const questionScore = responseItem.score || 0;
                    maxScore += questionMaxScore;
                    totalScore += questionScore;
                    const isCorrect = questionScore === questionMaxScore && questionMaxScore > 0;
                    if (isCorrect)
                        correctCount++;
                    else if (questionMaxScore > 0)
                        incorrectCount++;
                    // Extract choices for choice-type questions
                    let choices;
                    if (questionType === Content_model_1.QuestionType.MultipleChoice && question.multiple) {
                        choices = question.multiple.map((opt) => {
                            var _a, _b;
                            return ({
                                content: opt.content,
                                idx: opt.idx,
                                isCorrect: hasAnswerKey && Array.isArray((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer)
                                    ? question.answer.answer.includes(opt.idx)
                                    : ((_b = question.answer) === null || _b === void 0 ? void 0 : _b.answer) === opt.idx,
                            });
                        });
                    }
                    else if (questionType === Content_model_1.QuestionType.CheckBox &&
                        question.checkbox) {
                        choices = question.checkbox.map((opt) => {
                            var _a;
                            return ({
                                content: opt.content,
                                idx: opt.idx,
                                isCorrect: hasAnswerKey && Array.isArray((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer)
                                    ? question.answer.answer.includes(opt.idx)
                                    : false,
                            });
                        });
                    }
                    else if (questionType === Content_model_1.QuestionType.Selection &&
                        question.selection) {
                        choices = question.selection.map((opt) => {
                            var _a;
                            return ({
                                content: opt.content,
                                idx: opt.idx,
                                isCorrect: hasAnswerKey && ((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer) === opt.idx,
                            });
                        });
                    }
                    questions.push({
                        title: (0, helper_1.contentTitleToString)(question.title),
                        type: questionType,
                        qIdx: question.qIdx,
                        answer: hasAnswerKey && includeAnswerKey
                            ? (_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer
                            : null,
                        userResponse: responseItem.response,
                        score: questionScore,
                        maxScore: questionMaxScore,
                        isCorrect,
                        choices,
                    });
                }
                const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
                // Only count questions that have a score (maxScore > 0) for totalQuestions
                const scorableQuestionsCount = questions.filter((q) => q.maxScore > 0).length;
                const emailData = {
                    to: recipientEmail,
                    formTitle: form.title || "Untitled Form",
                    formDescription: form.description
                        ? (0, helper_1.contentTitleToString)(form.description)
                        : undefined,
                    totalScore,
                    maxScore,
                    scorePercentage,
                    correctCount,
                    incorrectCount,
                    totalQuestions: scorableQuestionsCount,
                    responseId,
                    isQuizForm,
                    includeAnswerKey,
                    questions,
                    respondentName: response.respondentName || "Anonymous",
                    respondentEmail: response.respondentEmail,
                    submittedAt: response.createdAt,
                    completionStatus: response.completionStatus,
                };
                const emailService = new EmailService_1.default();
                const success = yield emailService.sendResponseCardEmail(emailData);
                if (success) {
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Response card email sent successfully")), { data: {
                            sentTo: recipientEmail,
                            totalScore,
                            maxScore,
                            scorePercentage: scorePercentage.toFixed(1),
                        } }));
                }
                else {
                    return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to send email"));
                }
            }
            catch (error) {
                console.error("Send Response Card Email Error:", error);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to send response email"));
            }
        });
        this.ExportResponsePDF = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { formId, responseId } = req.params;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
                if (!form)
                    return;
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
                const pdfBuffer = yield this.generateResponsePDF(form, response);
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
                const htmlContent = (0, SendResponseEmail_1.generateResponseHTML)(form, response);
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
}
exports.FormResponseUtilityController = FormResponseUtilityController;
exports.default = new FormResponseUtilityController();
