"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const form_response_controller_1 = __importDefault(require("../controller/form_response.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const form_response_return_controller_1 = __importDefault(require("../controller/form_response_return.controller"));
const form_response_controller_2 = __importDefault(require("../controller/form_response.controller"));
const form_controller_1 = require("../controller/form.controller");
const ResponseRouter = (0, express_1.Router)();
//Fetch selected user response
ResponseRouter.get("/getuserresponses", User_middleware_1.default.VerifyToken, form_response_controller_2.default.GetUserResponses);
// Get list of respondent by formId
ResponseRouter.get("/getrespondents", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponsesInfo);
// Get responses with filters and pagination
ResponseRouter.get("/getresponselist", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponsesWithFilters);
//Validate Form data before submission
ResponseRouter.get("/validate", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ValidateFormForSubmission);
// Send form links via email
ResponseRouter.post("/send-links", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendFormLinks);
// Generate form link
ResponseRouter.post("/generate-link", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GenerateFormLink);
// Get form for respondent
ResponseRouter.get("/form/:formId", User_middleware_1.default.VerifyFormSession, form_response_controller_1.default.GetFormForRespondent);
// Submit form response for registered user
ResponseRouter.post("/submit-response", form_response_controller_1.default.SubmitFormResponse);
// Manual scoring for responses
ResponseRouter.put("/update-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateResponseScore);
// Get response analytics for charts
ResponseRouter.get("/analytics", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseAnalytics);
// Delete a response
ResponseRouter.delete("/:responseId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.DeleteResponse);
// Bulk delete responses
ResponseRouter.delete("/bulk/delete", User_middleware_1.default.VerifyToken, form_response_controller_1.default.BulkDeleteResponses);
// Send response as card email
ResponseRouter.post("/send-card-email", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendResponseCardEmail);
//Return Response
ResponseRouter.post("/return", User_middleware_1.default.VerifyToken, form_response_return_controller_1.default.ReturnResponse);
ResponseRouter.get("/response/:formId/:responseId/export/pdf", User_middleware_1.default.VerifyToken, form_response_controller_2.default.ExportResponsePDF);
// Get filled form data with user responses (protected route)
ResponseRouter.get("/filled-form/:formId", User_middleware_1.default.VerifyToken, form_controller_1.GetFilledForm);
ResponseRouter.get("/filled-form/:formId/:responseId", User_middleware_1.default.VerifyToken, form_controller_1.GetFilledForm);
exports.default = ResponseRouter;
