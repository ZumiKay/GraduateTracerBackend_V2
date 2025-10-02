import { Response } from "express";
import { CustomRequest } from "../types/customType";
import { FormResponseController } from "./form_response.controller";
import FormResponse from "../model/Response.model";
import Form from "../model/Form.model";
import EmailService from "../services/EmailService";
import { ReturnCode } from "../utilities/helper";
import { hasFormAccess } from "../utilities/formHelpers";

interface ReturnResponseRequestBody {
  responseId: string;
  html: string;
  reason?: string;
  feedback?: string;
}

class FormResponseReturnController extends FormResponseController {
  public ReturnResponse = async (req: CustomRequest, res: Response) => {
    const { responseId, html, reason, feedback } =
      req.body as ReturnResponseRequestBody;
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
      const formResponse = await FormResponse.findById(responseId).lean();
      if (!formResponse) {
        return res.status(404).json({ message: "Response not found" });
      }
      const form = await Form.findById(formResponse.formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      if (!hasFormAccess(form, user.id)) {
        return res.status(403).json({
          message:
            "You don't have permission to return responses for this form",
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
        const emailService = new EmailService();

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
                
                ${
                  reason
                    ? `
                  <div class="feedback-section">
                    <h3>Reason for Return:</h3>
                    <p>${reason}</p>
                  </div>
                `
                    : ""
                }
                
                ${
                  feedback
                    ? `
                  <div class="feedback-section">
                    <h3>Feedback:</h3>
                    <p>${feedback}</p>
                  </div>
                `
                    : ""
                }
                
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

        const emailSuccess = await emailService.sendEmail({
          to: [recipientEmail],
          subject: `Response Returned: ${form.title}`,
          html: emailHtml,
        });

        if (!emailSuccess) {
          console.warn(
            "Failed to send return email, but continuing with response update"
          );
        }

        return res.status(200).json({ ...ReturnCode(200) });
      } catch (emailError) {
        console.error("Error sending return email:", emailError);
        return res.status(500).json({
          message: "Failed to send return email",
          error:
            emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error returning response:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

export default new FormResponseReturnController();
