"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const form_response_controller_1 = __importDefault(require("../controller/form_response.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const ResponseRouter = (0, express_1.Router)();
// Existing routes
ResponseRouter.post("/submit", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SubmitResponse);
ResponseRouter.get("/getbyformid", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseByFormId);
ResponseRouter.get("/getbyuserid", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseByUserId);
// Get all responses by current user
ResponseRouter.get("/user-responses", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetUserResponses);
ResponseRouter.get("/guest", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetGuestResponse);
ResponseRouter.get("/validate", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ValidateFormForSubmission);
// New routes for enhanced response functionality
// Send form links via email
ResponseRouter.post("/send-links", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendFormLinks);
// Generate form link
ResponseRouter.post("/generate-link", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GenerateFormLink);
// Get form for respondent (public access)
ResponseRouter.get("/form/:formId", form_response_controller_1.default.GetFormForRespondent);
// Submit form response (for respondents)
ResponseRouter.post("/submit-response", form_response_controller_1.default.SubmitFormResponse);
// Get responses with filters and pagination
ResponseRouter.get("/responses", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponsesWithFilters);
// Manual scoring for responses
ResponseRouter.put("/score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateResponseScore);
// Get response analytics for charts
ResponseRouter.get("/analytics", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseAnalytics);
exports.default = ResponseRouter;
