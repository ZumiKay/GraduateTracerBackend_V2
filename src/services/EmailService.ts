import nodemailer from "nodemailer";
import { contentTitleToString } from "../utilities/helper";
import { ContentTitle } from "../model/Content.model";

export interface EmailData {
  to: string[];
  subject: string;
  html: string;
}

export interface FormLinkEmailData {
  formId: string;
  formTitle: string | ContentTitle;
  formOwner: string;
  recipientEmails: string[];
  message?: string;
}

export interface ResponseEmailData {
  to: string;
  formTitle: string | ContentTitle;
  totalScore: number;
  maxScore: number;
  responseId: string;
  isAutoScored: boolean;
  questions?: Array<{
    title: string | ContentTitle;
    type: string;
    answer: any;
    userResponse: any;
    score: number;
    maxScore: number;
    isCorrect?: boolean;
  }>;
  respondentName?: string;
  submittedAt?: Date;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.EMAIL_APP_PASSWORD,
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
            <h2>${this.escapeHtml(
              this.convertTitleToString(data.formTitle)
            )}</h2>
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
      subject: `Form Invitation: ${this.convertTitleToString(data.formTitle)}`,
      html,
    });
  }

  // Send response results to respondent
  async sendResponseResults(data: ResponseEmailData): Promise<boolean> {
    const scorePercentage = ((data.totalScore / data.maxScore) * 100).toFixed(
      1
    );
    const submittedDate = data.submittedAt
      ? new Date(data.submittedAt).toLocaleDateString()
      : new Date().toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            line-height: 1.6; 
            color: #374151; 
            margin: 0; 
            padding: 0; 
            background-color: #f9fafb;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background-color: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #059669 0%, #047857 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
          
          .total-score-section { 
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white; 
            padding: 30px; 
            text-align: center;
            margin: 0;
          }
          .total-score-card { 
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 16px; 
            padding: 30px; 
            display: inline-block;
            min-width: 300px;
          }
          .score-number { 
            font-size: 48px; 
            font-weight: 700; 
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .score-percentage { 
            font-size: 24px; 
            margin: 10px 0; 
            opacity: 0.9;
          }
          .score-label { 
            font-size: 14px; 
            opacity: 0.8; 
            margin: 0;
          }
          
          .content { padding: 30px; }
          
          .questions-section { margin-top: 30px; }
          .questions-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #1f2937; 
            margin-bottom: 20px;
            text-align: center;
          }
          
          .question-card { 
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px; 
            margin-bottom: 20px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
          }
          
          .question-header {
            padding: 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
          }
          .question-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #1f2937; 
            margin: 0 0 8px 0;
          }
          .question-type { 
            font-size: 12px; 
            color: #6b7280; 
            text-transform: uppercase; 
            font-weight: 500;
            background: #e5e7eb;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
          }
          
          .question-content { padding: 20px; }
          
          .answer-section { margin-bottom: 16px; }
          .answer-label { 
            font-size: 14px; 
            color: #6b7280; 
            font-weight: 500; 
            margin-bottom: 8px;
          }
          .answer-value { 
            background: #f3f4f6; 
            padding: 12px 16px; 
            border-radius: 8px; 
            font-size: 16px;
            border-left: 4px solid #d1d5db;
          }
          .correct-answer { border-left-color: #10b981; background: #ecfdf5; }
          .wrong-answer { border-left-color: #ef4444; background: #fef2f2; }
          
          .score-section { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            background: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            margin-top: 16px;
          }
          .question-score { 
            font-size: 18px; 
            font-weight: 600;
          }
          .score-correct { color: #059669; }
          .score-incorrect { color: #dc2626; }
          .score-partial { color: #d97706; }
          
          .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .badge-correct { background: #d1fae5; color: #065f46; }
          .badge-incorrect { background: #fee2e2; color: #991b1b; }
          .badge-partial { background: #fef3c7; color: #92400e; }
          
          .summary { 
            background: #f8fafc; 
            padding: 20px; 
            border-radius: 12px; 
            margin: 30px 0;
            border: 1px solid #e5e7eb;
          }
          
          .footer { 
            background: #1f2937;
            color: #9ca3af;
            padding: 30px; 
            text-align: center; 
            font-size: 14px;
          }
          .footer strong { color: #ffffff; }
          
          @media (max-width: 600px) {
            .container { margin: 0; box-shadow: none; }
            .header, .content, .total-score-section, .footer { padding: 20px; }
            .total-score-card { min-width: auto; width: 100%; }
            .score-number { font-size: 36px; }
            .questions-title { font-size: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>🎉 Form Completion Results</h1>
            <p>${this.escapeHtml(this.convertTitleToString(data.formTitle))}</p>
          </div>
          
          <!-- Total Score Section -->
          <div class="total-score-section">
            <div class="total-score-card">
              <div class="score-number">${data.totalScore}/${
      data.maxScore
    }</div>
              <div class="score-percentage">${scorePercentage}%</div>
              <p class="score-label">Overall Score</p>
            </div>
          </div>
          
          <div class="content">
            <!-- Summary Information -->
            <div class="summary">
              <h3 style="margin-top: 0; color: #1f2937;">📋 Summary</h3>
              <p><strong>Respondent:</strong> ${
                data.respondentName || "Anonymous"
              }</p>
              <p><strong>Submitted:</strong> ${submittedDate}</p>
              <p><strong>Response ID:</strong> ${data.responseId}</p>
              <p><strong>Scoring Method:</strong> ${
                data.isAutoScored
                  ? "🤖 Automatically calculated"
                  : "👨‍💼 Manually reviewed"
              }</p>
            </div>
            
            ${
              data.questions && data.questions.length > 0
                ? `
            <!-- Questions Section -->
            <div class="questions-section">
              <h2 class="questions-title">📝 Detailed Results</h2>
              
              ${data.questions
                .map((question, index) => {
                  const isCorrect = question.score === question.maxScore;
                  const isPartial =
                    question.score > 0 && question.score < question.maxScore;

                  return `
                <div class="question-card">
                  <div class="question-header">
                    <h4 class="question-title">Question ${
                      index + 1
                    }: ${this.escapeHtml(
                    this.convertTitleToString(question.title)
                  )}</h4>
                    <span class="question-type">${question.type}</span>
                  </div>
                  
                  <div class="question-content">
                    <div class="answer-section">
                      <div class="answer-label">Your Answer:</div>
                      <div class="answer-value ${
                        isCorrect ? "correct-answer" : "wrong-answer"
                      }">
                        ${this.formatAnswer(question.userResponse)}
                      </div>
                    </div>
                    
                    ${
                      question.answer
                        ? `
                    <div class="answer-section">
                      <div class="answer-label">Correct Answer:</div>
                      <div class="answer-value correct-answer">
                        ${this.formatAnswer(question.answer)}
                      </div>
                    </div>
                    `
                        : ""
                    }
                    
                    <div class="score-section">
                      <div class="question-score ${
                        isCorrect
                          ? "score-correct"
                          : isPartial
                          ? "score-partial"
                          : "score-incorrect"
                      }">
                        ${question.score}/${question.maxScore} points
                      </div>
                      <div class="status-badge ${
                        isCorrect
                          ? "badge-correct"
                          : isPartial
                          ? "badge-partial"
                          : "badge-incorrect"
                      }">
                        ${
                          isCorrect
                            ? "✓ Correct"
                            : isPartial
                            ? "~ Partial"
                            : "✗ Incorrect"
                        }
                      </div>
                    </div>
                  </div>
                </div>
                `;
                })
                .join("")}
            </div>
            `
                : ""
            }
            
            <div style="text-align: center; margin-top: 40px; padding: 20px; background: #fef3c7; border-radius: 12px;">
              <p style="margin: 0; font-size: 16px; color: #92400e;">
                <strong>🙏 Thank you for your participation!</strong><br>
                If you have any questions about your results, please contact the form administrator.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Graduate Tracer System</strong></p>
            <p>This email was automatically generated. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: [data.to],
      subject: `🎯 Results for: ${this.convertTitleToString(data.formTitle)}`,
      html,
    });
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private convertTitleToString(title: string | ContentTitle): string {
    if (typeof title === "string") {
      return title;
    }
    return contentTitleToString(title);
  }

  private formatAnswer(answer: any): string {
    if (answer === null || answer === undefined) {
      return "<em>No answer provided</em>";
    }

    if (Array.isArray(answer)) {
      return answer.length > 0
        ? answer.join(", ")
        : "<em>No selections made</em>";
    }

    if (typeof answer === "object") {
      return JSON.stringify(answer, null, 2);
    }

    return String(answer);
  }
}

export default EmailService;
