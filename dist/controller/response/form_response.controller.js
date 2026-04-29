"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormResponseController = exports.FormResponseUtilityController = exports.FormResponseSubmissionController = exports.FormResponseScoringController = exports.FormResponseQueryController = void 0;
const zod_1 = __importDefault(require("zod"));
var form_response_query_controller_1 = require("./form_response.query.controller");
Object.defineProperty(exports, "FormResponseQueryController", { enumerable: true, get: function () { return form_response_query_controller_1.FormResponseQueryController; } });
var form_response_scoring_controller_1 = require("./form_response.scoring.controller");
Object.defineProperty(exports, "FormResponseScoringController", { enumerable: true, get: function () { return form_response_scoring_controller_1.FormResponseScoringController; } });
var form_response_submission_controller_1 = require("./form_response.submission.controller");
Object.defineProperty(exports, "FormResponseSubmissionController", { enumerable: true, get: function () { return form_response_submission_controller_1.FormResponseSubmissionController; } });
var form_response_utility_controller_1 = require("./form_response.utility.controller");
Object.defineProperty(exports, "FormResponseUtilityController", { enumerable: true, get: function () { return form_response_utility_controller_1.FormResponseUtilityController; } });
const form_response_query_controller_2 = __importDefault(require("./form_response.query.controller"));
const form_response_scoring_controller_2 = __importDefault(require("./form_response.scoring.controller"));
const form_response_submission_controller_2 = __importDefault(require("./form_response.submission.controller"));
const form_response_utility_controller_2 = __importDefault(require("./form_response.utility.controller"));
class FormResponseController {
    constructor() {
        // Query methods
        this.GetResponseByFormId = form_response_query_controller_2.default.GetResponseByFormId;
        this.GetResponseByUser = form_response_query_controller_2.default.GetResponseByUser;
        this.GetResponsesInfo = form_response_query_controller_2.default.GetResponsesInfo;
        this.GetResponsesWithFilters = form_response_query_controller_2.default.GetResponsesWithFilters;
        this.GetResponseByID = form_response_query_controller_2.default.GetResponseByID;
        this.GetUserResponses = form_response_query_controller_2.default.GetUserResponses;
        this.DeleteResponse = form_response_query_controller_2.default.DeleteResponse;
        this.BulkDeleteResponses = form_response_query_controller_2.default.BulkDeleteResponses;
        this.GetResponseAnalytics = form_response_query_controller_2.default.GetResponseAnalytics;
        this.GetChoiceQuestionAnalytics = form_response_query_controller_2.default.GetChoiceQuestionAnalytics;
        this.GetFormAnalytics = form_response_query_controller_2.default.GetFormAnalytics;
        this.ExportAnalytics = form_response_query_controller_2.default.ExportAnalytics;
        // Scoring methods
        this.UpdateResponseScore = form_response_scoring_controller_2.default.UpdateResponseScore;
        this.UpdateQuestionScore = form_response_scoring_controller_2.default.UpdateQuestionScore;
        this.BatchUpdateScores = form_response_scoring_controller_2.default.BatchUpdateScores;
        this.RecalculateResponseScore = form_response_scoring_controller_2.default.RecalculateResponseScore;
        // Submission methods
        this.GetFormForRespondent = form_response_submission_controller_2.default.GetFormForRespondent;
        this.SubmitFormResponse = form_response_submission_controller_2.default.SubmitFormResponse;
        this.GetInititalFormData = form_response_submission_controller_2.default.GetInititalFormData;
        this.GetPublicFormData = form_response_submission_controller_2.default.GetPublicFormData;
        // Utility methods
        this.ValidateFormForSubmission = form_response_utility_controller_2.default.ValidateFormForSubmission;
        this.SendFormLinks = form_response_utility_controller_2.default.SendFormLinks;
        this.GenerateFormLink = form_response_utility_controller_2.default.GenerateFormLink;
        this.SendResponseCardEmail = form_response_utility_controller_2.default.SendResponseCardEmail;
        this.ExportResponsePDF = form_response_utility_controller_2.default.ExportResponsePDF;
    }
}
exports.FormResponseController = FormResponseController;
// Static validators
FormResponseController.publicSubmitValidate = zod_1.default.object({
    body: zod_1.default.object({
        formId: zod_1.default.string().min(1, "Form is required"),
        respondentEmail: zod_1.default.string().email().optional(),
        respondentName: zod_1.default.string().optional(),
    }),
});
FormResponseController.sendResponseCardEmailValidate = zod_1.default.object({
    body: zod_1.default.object({
        responseId: zod_1.default.string().min(1, "Response ID is required"),
        recipientEmail: zod_1.default.string().email("Valid email is required"),
    }),
});
exports.default = new FormResponseController();
