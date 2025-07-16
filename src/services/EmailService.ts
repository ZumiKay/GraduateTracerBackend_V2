import nodemailer from "nodemailer";
import { FormType } from "../model/Form.model";

export interface EmailData {
  to: string[];
  subject: string;
  html: string;
}

export interface FormLinkEmailData {
  formId: string;
  formTitle: string;
  formOwner: string;
  recipientEmails: string[];
  message?: string;
}

export interface ResponseEmailData {
  to: string;
  formTitle: string;
  totalScore: number;
  maxScore: number;
  responseId: string;
  isAutoScored: boolean;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Generic email sending method
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: emailData.to.join(","),
        subject: emailData.subject,
        html: emailData.html,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }

  // Send form link to multiple recipients
  async sendFormLinks(data: FormLinkEmailData): Promise<boolean> {
    const formUrl = `${process.env.FRONTEND_URL}/form-access/${data.formId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background-color: #4f46e5; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: bold;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Fill Out a Form</h1>
          </div>
          <div class="content">
            <h2>${data.formTitle}</h2>
            <p>Hello!</p>
            <p>You have been invited by <strong>${
              data.formOwner
            }</strong> to fill out a form.</p>
            ${data.message ? `<p><em>${data.message}</em></p>` : ""}
            <p>Click the button below to access the form:</p>
            <a href="${formUrl}" class="button">Fill Out Form</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${formUrl}">${formUrl}</a></p>
            <p>Thank you for your participation!</p>
          </div>
          <div class="footer">
            <p>This email was sent from Graduate Tracer System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: data.recipientEmails,
      subject: `Form Invitation: ${data.formTitle}`,
      html,
    });
  }

  // Send response results to respondent
  async sendResponseResults(data: ResponseEmailData): Promise<boolean> {
    const scorePercentage = ((data.totalScore / data.maxScore) * 100).toFixed(
      1
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .score-card { 
            background-color: white; 
            border: 2px solid #059669; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0; 
          }
          .score-number { font-size: 36px; font-weight: bold; color: #059669; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Form Response Results</h1>
          </div>
          <div class="content">
            <h2>${data.formTitle}</h2>
            <p>Thank you for completing the form!</p>
            
            <div class="score-card">
              <div class="score-number">${data.totalScore} / ${
      data.maxScore
    }</div>
              <p>Score: ${scorePercentage}%</p>
              ${
                data.isAutoScored
                  ? "<p><small>This score was calculated automatically.</small></p>"
                  : "<p><small>This score was manually reviewed and assigned.</small></p>"
              }
            </div>
            
            <p>Response ID: ${data.responseId}</p>
            <p>If you have any questions about your results, please contact the form administrator.</p>
          </div>
          <div class="footer">
            <p>This email was sent from Graduate Tracer System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [data.to],
      subject: `Results for: ${data.formTitle}`,
      html,
    });
  }
}

export default EmailService;
