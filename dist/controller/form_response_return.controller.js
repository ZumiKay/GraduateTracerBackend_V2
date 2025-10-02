"use strict";
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
const form_response_controller_1 = require("./form_response.controller");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const EmailService_1 = __importDefault(require("../services/EmailService"));
const helper_1 = require("../utilities/helper");
const formHelpers_1 = require("../utilities/formHelpers");
class FormResponseReturnController extends form_response_controller_1.FormResponseController {
    constructor() {
        super(...arguments);
        this.ReturnResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { responseId, html, reason, feedback } = req.body;
            const user = req.user;
            // Validate user authentication
            if (!user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            if (!responseId) {
                return res.status(400).json({ message: "Response ID is required" });
            }
            if (!html) {
                return res.status(400).json({ message: "HTML content is required" });
            }
            try {
                const formResponse = yield Response_model_1.default.findById(responseId).lean();
                if (!formResponse) {
                    return res.status(404).json({ message: "Response not found" });
                }
                const form = yield Form_model_1.default.findById(formResponse.formId);
                if (!form) {
                    return res.status(404).json({ message: "Form not found" });
                }
                if (!(0, formHelpers_1.hasFormAccess)(form, user.id)) {
                    return res.status(403).json({
                        message: "You don't have permission to return responses for this form",
                    });
                }
                if (formResponse.totalScore === undefined) {
                    return res.status(400).json({
                        message: "Response has no score to return",
                    });
                }
                const recipientEmail = formResponse.respondentEmail;
                if (!recipientEmail) {
                    return res.status(400).json({
                        message: "No email address found for this respondent",
                    });
                }
                try {
                    const emailService = new EmailService_1.default();
                    // Create email content with score and custom HTML
                    const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .score-card { 
                background-color: white; 
                border: 2px solid #f59e0b; 
                border-radius: 8px; 
                padding: 20px; 
                text-align: center; 
                margin: 20px 0; 
              }
              .score-number { font-size: 36px; font-weight: bold; color: #f59e0b; }
              .feedback-section { 
                background-color: #fef3c7; 
                border-left: 4px solid #f59e0b; 
                padding: 15px; 
                margin: 20px 0; 
              }
              .custom-content { 
                background-color: white; 
                border-radius: 8px; 
                padding: 20px; 
                margin: 20px 0; 
                border: 1px solid #e5e7eb; 
              }
              .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Your Form Response Has Been Returned</h1>
              </div>
              <div class="content">
                <h2>${form.title}</h2>
                <p>Your response has been reviewed and returned with feedback.</p>
                
                <div class="score-card">
                  <div class="score-number">${formResponse.totalScore}</div>
                  <p>Your Current Score</p>  
                </div>
                
                ${reason
                        ? `
                  <div class="feedback-section">
                    <h3>Reason for Return:</h3>
                    <p>${reason}</p>
                  </div>
                `
                        : ""}
                
                ${feedback
                        ? `
                  <div class="feedback-section">
                    <h3>Feedback:</h3>
                    <p>${feedback}</p>
                  </div>
                `
                        : ""}
                
                <div class="custom-content">
                  <h3>Additional Information:</h3>
                  ${html}
                </div>
                
                <p>Response ID: ${formResponse._id}</p>
                <p>Please review the feedback and make any necessary corrections before resubmitting.</p>
              </div>
              <div class="footer">
                <p>This email was sent from Graduate Tracer System</p>
              </div>
            </div>
          </body>
          </html>
        `;
                    const emailSuccess = yield emailService.sendEmail({
                        to: [recipientEmail],
                        subject: `Response Returned: ${form.title}`,
                        html: emailHtml,
                    });
                    if (!emailSuccess) {
                        console.warn("Failed to send return email, but continuing with response update");
                    }
                    return res.status(200).json(Object.assign({}, (0, helper_1.ReturnCode)(200)));
                }
                catch (emailError) {
                    console.error("Error sending return email:", emailError);
                    return res.status(500).json({
                        message: "Failed to send return email",
                        error: emailError instanceof Error ? emailError.message : "Unknown error",
                    });
                }
            }
            catch (error) {
                console.error("Error returning response:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        });
    }
}
exports.default = new FormResponseReturnController();
