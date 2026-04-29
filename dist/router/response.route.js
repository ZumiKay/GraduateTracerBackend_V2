"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const form_response_controller_1 = __importDefault(require("../controller/response/form_response.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const form_response_controller_2 = __importDefault(require("../controller/response/form_response.controller"));
const form_controller_1 = require("../controller/form/form.controller");
const Formsession_middleware_1 = __importDefault(require("../middleware/Formsession.middleware"));
const ResponseQueryService_1 = require("../services/ResponseQueryService");
const formsession_controller_1 = __importDefault(require("../controller/form/formsession.controller"));
const form_response_return_controller_1 = __importDefault(require("../controller/response/form_response_return.controller"));
const analytics_controller_1 = __importDefault(require("../controller/analytics/analytics.controller"));
const ResponseRouter = (0, express_1.Router)();
//Form session management
ResponseRouter.post("/respondentlogin", formsession_controller_1.default.RespondentLogin);
ResponseRouter.get("/verifyformsession/:formId", formsession_controller_1.default.SessionVerification);
ResponseRouter.patch("/sessionremoval/:code", formsession_controller_1.default.ReplaceSession);
ResponseRouter.delete("/sessionlogout/:formId", Formsession_middleware_1.default.VerifyFormsession, formsession_controller_1.default.SignOut);
//Fetch selected user response
ResponseRouter.get("/getuserresponses/:formId/:page/:resIdx/:userId", User_middleware_1.default.VerifyToken, ResponseQueryService_1.ResponseQueryService.getUserResponses);
// Get list of respondent by formId
ResponseRouter.get("/getrespondents/:formId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponsesInfo);
// Get responses with filters and pagination
ResponseRouter.get("/getresponselist", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponsesWithFilters);
//Get response by id
ResponseRouter.get("/getresponseById/:id/:formId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseByID);
//Validate Form data before submission
ResponseRouter.get("/validate", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ValidateFormForSubmission);
// Send form links via email
ResponseRouter.post("/send-links", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendFormLinks);
// Generate form link
ResponseRouter.post("/generate-link", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GenerateFormLink);
//Get Respondent Form
ResponseRouter.get("/form/:formId", Formsession_middleware_1.default.VerifyRespondentFormSessionData, form_response_controller_1.default.GetFormForRespondent);
// Submit form response for registered user
ResponseRouter.post("/submit-response/:formId", Formsession_middleware_1.default.VerifyFormsession, form_response_controller_1.default.SubmitFormResponse);
// Manual scoring for responses
ResponseRouter.put("/update-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateResponseScore);
// Update individual question score
ResponseRouter.put("/update-question-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateQuestionScore);
// Batch update scores for multiple responses
ResponseRouter.put("/batch-update-scores", User_middleware_1.default.VerifyToken, form_response_controller_1.default.BatchUpdateScores);
// Recalculate total score for a response
ResponseRouter.put("/recalculate-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.RecalculateResponseScore);
// Delete a response
ResponseRouter.delete("/:responseId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.DeleteResponse);
// Bulk delete responses
ResponseRouter.delete("/bulk/delete", User_middleware_1.default.VerifyToken, form_response_controller_1.default.BulkDeleteResponses);
// Send response as card email
ResponseRouter.post("/send-card-email", form_response_controller_1.default.SendResponseCardEmail);
//Return Response to user through email
ResponseRouter.post("/return", User_middleware_1.default.VerifyToken, form_response_return_controller_1.default.ReturnResponse);
ResponseRouter.get("/:formId/:responseId/export/pdf", User_middleware_1.default.VerifyToken, form_response_controller_2.default.ExportResponsePDF);
// Get filled form data with user responses (protected route)
ResponseRouter.get("/filled-form/:formId", User_middleware_1.default.VerifyToken, form_controller_1.GetFilledForm);
ResponseRouter.get("/filled-form/:formId/:responseId", User_middleware_1.default.VerifyToken, form_controller_1.GetFilledForm);
//Analytics routes
ResponseRouter.get("/getanalytics", User_middleware_1.default.VerifyToken, analytics_controller_1.default.GetAnalyticsData);
exports.default = ResponseRouter;
