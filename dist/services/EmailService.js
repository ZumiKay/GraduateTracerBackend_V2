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
const nodemailer_1 = __importDefault(require("nodemailer"));
const helper_1 = require("../utilities/helper");
class EmailService {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                user: process.env.ADMIN_EMAIL,
                pass: process.env.EMAIL_APP_PASSWORD,
            },
        });
    }
    // Generic email sending method
    sendEmail(emailData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const mailOptions = {
                    from: process.env.SMTP_USER,
                    to: emailData.to.join(","),
                    subject: emailData.subject,
                    html: emailData.html,
                };
                yield this.transporter.sendMail(mailOptions);
                return true;
            }
            catch (error) {
                console.error("Error sending email:", error);
                return false;
            }
        });
    }
    // Send form link to multiple recipients
    sendFormLinks(data) {
        return __awaiter(this, void 0, void 0, function* () {
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
            <h2>${this.escapeHtml(this.convertTitleToString(data.formTitle))}</h2>
            <p>Hello!</p>
            <p>You have been invited by <strong>${data.formOwner}</strong> to fill out a form.</p>
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
            return yield this.sendEmail({
                to: data.recipientEmails,
                subject: `Form Invitation: ${this.convertTitleToString(data.formTitle)}`,
                html,
            });
        });
    }
    // Send response results to respondent
    sendResponseResults(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const scorePercentage = data.totalScore === 0
                ? 0
                : ((data.totalScore / data.maxScore) * 100).toFixed(1);
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
              <div class="score-number">${data.totalScore}/${data.maxScore}</div>
              <div class="score-percentage">${scorePercentage}%</div>
              <p class="score-label">Overall Score</p>
            </div>
          </div>
          
          <div class="content">
            <!-- Summary Information -->
            <div class="summary">
              <h3 style="margin-top: 0; color: #1f2937;">📋 Summary</h3>
              <p><strong>Respondent:</strong> ${data.respondentName || "Anonymous"}</p>
              <p><strong>Submitted:</strong> ${submittedDate}</p>
              <p><strong>Response ID:</strong> ${data.responseId}</p>
              <p><strong>Scoring Method:</strong> ${data.isAutoScored
                ? "🤖 Automatically calculated"
                : "👨‍💼 Manually reviewed"}</p>
            </div>
            
            ${data.questions && data.questions.length > 0
                ? `
            <!-- Questions Section -->
            <div class="questions-section">
              <h2 class="questions-title">📝 Detailed Results</h2>
              
              ${data.questions
                    .map((question, index) => {
                    const isCorrect = question.score === question.maxScore;
                    const isPartial = question.score > 0 && question.score < question.maxScore;
                    return `
                <div class="question-card">
                  <div class="question-header">
                    <h4 class="question-title">Question ${index + 1}: ${this.escapeHtml(this.convertTitleToString(question.title))}</h4>
                    <span class="question-type">${question.type}</span>
                  </div>
                  
                  <div class="question-content">
                    <div class="answer-section">
                      <div class="answer-label">Your Answer:</div>
                      <div class="answer-value ${isCorrect ? "correct-answer" : "wrong-answer"}">
                        ${this.formatAnswer(question.userResponse)}
                      </div>
                    </div>
                    
                    ${question.answer
                        ? `
                    <div class="answer-section">
                      <div class="answer-label">Correct Answer:</div>
                      <div class="answer-value correct-answer">
                        ${this.formatAnswer(question.answer)}
                      </div>
                    </div>
                    `
                        : ""}
                    
                    <div class="score-section">
                      <div class="question-score ${isCorrect
                        ? "score-correct"
                        : isPartial
                            ? "score-partial"
                            : "score-incorrect"}">
                        ${question.score}/${question.maxScore} points
                      </div>
                      <div class="status-badge ${isCorrect
                        ? "badge-correct"
                        : isPartial
                            ? "badge-partial"
                            : "badge-incorrect"}">
                        ${isCorrect
                        ? "✓ Correct"
                        : isPartial
                            ? "~ Partial"
                            : "✗ Incorrect"}
                      </div>
                    </div>
                  </div>
                </div>
                `;
                })
                    .join("")}
            </div>
            `
                : ""}
            
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
            return yield this.sendEmail({
                to: [data.to],
                subject: `🎯 Results for: ${this.convertTitleToString(data.formTitle)}`,
                html,
            });
        });
    }
    // Enhanced Response Card Email with modern design
    sendResponseCardEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const submittedDate = data.submittedAt
                ? new Date(data.submittedAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                })
                : new Date().toLocaleDateString();
            const getScoreGrade = (percentage) => {
                if (percentage >= 90)
                    return {
                        grade: "Excellent",
                        color: "#059669",
                        bgColor: "#d1fae5",
                        emoji: "🏆",
                    };
                if (percentage >= 80)
                    return {
                        grade: "Very Good",
                        color: "#0891b2",
                        bgColor: "#cffafe",
                        emoji: "🌟",
                    };
                if (percentage >= 70)
                    return {
                        grade: "Good",
                        color: "#2563eb",
                        bgColor: "#dbeafe",
                        emoji: "👍",
                    };
                if (percentage >= 60)
                    return {
                        grade: "Satisfactory",
                        color: "#ca8a04",
                        bgColor: "#fef9c3",
                        emoji: "📝",
                    };
                if (percentage >= 50)
                    return {
                        grade: "Pass",
                        color: "#d97706",
                        bgColor: "#ffedd5",
                        emoji: "✓",
                    };
                return {
                    grade: "Needs Improvement",
                    color: "#dc2626",
                    bgColor: "#fee2e2",
                    emoji: "📚",
                };
            };
            const gradeInfo = getScoreGrade(data.scorePercentage);
            const formatUserResponse = (question) => {
                const response = question.userResponse;
                if (response === null || response === undefined || response === "") {
                    return '<span style="color: #9ca3af; font-style: italic;">No answer provided</span>';
                }
                // For choice questions, show selected option(s) with their content
                if (question.choices && question.choices.length > 0) {
                    if (typeof response === "number") {
                        const selected = question.choices.find((c) => c.idx === response);
                        return selected
                            ? this.escapeHtml(selected.content)
                            : String(response);
                    }
                    if (Array.isArray(response)) {
                        const selectedChoices = question.choices
                            .filter((c) => response.includes(c.idx))
                            .map((c) => this.escapeHtml(c.content));
                        return selectedChoices.length > 0
                            ? selectedChoices.map((s) => `• ${s}`).join("<br>")
                            : '<span style="color: #9ca3af; font-style: italic;">No selections made</span>';
                    }
                    // Handle object with key/val format
                    if (typeof response === "object" && "val" in response) {
                        const val = response.val;
                        if (Array.isArray(val)) {
                            return val
                                .map((v) => `• ${this.escapeHtml(v)}`)
                                .join("<br>");
                        }
                        return this.escapeHtml(String(val));
                    }
                }
                // For other question types
                if (typeof response === "object") {
                    if ("start" in response && "end" in response) {
                        return `${response.start} → ${response.end}`;
                    }
                    return this.escapeHtml(JSON.stringify(response));
                }
                return this.escapeHtml(String(response));
            };
            const formatCorrectAnswer = (question) => {
                if (!question.answer)
                    return "";
                if (question.choices && question.choices.length > 0) {
                    const correctChoices = question.choices.filter((c) => c.isCorrect);
                    if (correctChoices.length > 0) {
                        return correctChoices
                            .map((c) => `✓ ${this.escapeHtml(c.content)}`)
                            .join("<br>");
                    }
                }
                if (Array.isArray(question.answer)) {
                    return question.answer
                        .map((a) => `✓ ${this.escapeHtml(String(a))}`)
                        .join("<br>");
                }
                if (typeof question.answer === "object" && "start" in question.answer) {
                    return `${question.answer.start} → ${question.answer.end}`;
                }
                return this.escapeHtml(String(question.answer));
            };
            const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Response Results - ${this.escapeHtml(this.convertTitleToString(data.formTitle))}</title>
        <!--[if mso]>
        <style type="text/css">
          table { border-collapse: collapse; }
          .score-circle { width: 140px !important; }
        </style>
        <![endif]-->
        <style>
          /* Reset and base styles */
          body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
          body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          
          /* Responsive wrapper */
          .email-wrapper { width: 100% !important; max-width: 700px !important; }
          
          /* Mobile styles */
          @media screen and (max-width: 600px) {
            .email-wrapper { width: 100% !important; }
            .hero { padding: 24px 16px !important; }
            .hero h1 { font-size: 20px !important; }
            .score-card { margin: -20px 12px 0 !important; padding: 20px !important; }
            .score-circle { width: 110px !important; height: 110px !important; padding-top: 25px !important; }
            .score-value { font-size: 24px !important; }
            .score-total { font-size: 12px !important; }
            .stats-table { width: 100% !important; }
            .stat-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; }
            .info-table { width: 100% !important; }
            .info-cell { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
            .question-header { padding: 12px 16px !important; }
            .question-body { padding: 16px !important; }
            .question-footer-table { width: 100% !important; }
            .footer-cell { display: block !important; width: 100% !important; text-align: center !important; padding: 4px 0 !important; }
            .thank-you-banner { margin: 0 12px 16px !important; padding: 16px !important; }
            .questions-section { padding: 16px !important; }
            .info-section { padding: 16px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" class="email-wrapper" cellpadding="0" cellspacing="0" width="700" style="max-width: 700px; background: #ffffff; border-radius: 8px; overflow: hidden;">
                
                <!-- Hero Section -->
                <tr>
                  <td class="hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 24px; text-align: center;">
                    <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 50%; display: inline-block; text-align: center; line-height: 70px; font-size: 36px; margin-bottom: 16px;">${gradeInfo.emoji}</div>
                    <h1 style="color: white; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">${this.escapeHtml(this.convertTitleToString(data.formTitle))}</h1>
                    <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 0;">Your Response Results Are Ready</p>
                  </td>
                </tr>
                
                <!-- Score Card -->
                <tr>
                  <td style="padding: 0 20px;">
                    <table role="presentation" class="score-card" cellpadding="0" cellspacing="0" width="100%" style="background: #ffffff; margin-top: -24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); position: relative;">
                      <tr>
                        <td style="padding: 28px 20px; text-align: center; border-bottom: 2px dashed #e5e7eb;">
                          <div class="score-circle" style="width: 130px; height: 130px; border-radius: 50%; background: ${gradeInfo.bgColor}; border: 5px solid ${gradeInfo.color}; display: inline-block; text-align: center; padding-top: 32px; box-sizing: border-box; margin-bottom: 12px;">
                            <span class="score-value" style="display: block; font-size: 32px; font-weight: 800; color: ${gradeInfo.color};">${data.scorePercentage.toFixed(0)}%</span>
                            <span class="score-total" style="display: block; font-size: 13px; color: #6b7280;">${data.totalScore}/${data.maxScore}</span>
                          </div>
                          <div style="display: inline-block; background: ${gradeInfo.bgColor}; color: ${gradeInfo.color}; padding: 8px 18px; border-radius: 20px; font-weight: 600; font-size: 15px;">${gradeInfo.emoji} ${gradeInfo.grade}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" class="stats-table" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td class="stat-cell" style="text-align: center; padding: 0 8px; width: 33.33%;">
                                <div style="font-size: 26px; font-weight: 700; color: #1f2937;">${data.totalQuestions}</div>
                                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total Questions</div>
                              </td>
                              <td class="stat-cell" style="text-align: center; padding: 0 8px; width: 33.33%;">
                                <div style="font-size: 26px; font-weight: 700; color: #059669;">${data.correctCount}</div>
                                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Correct</div>
                              </td>
                              <td class="stat-cell" style="text-align: center; padding: 0 8px; width: 33.33%;">
                                <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${data.incorrectCount}</div>
                                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Incorrect</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Info Section -->
                <tr>
                  <td class="info-section" style="padding: 20px; background: #f8fafc;">
                    <table role="presentation" class="info-table" cellpadding="0" cellspacing="8" width="100%">
                      <tr>
                        <td class="info-cell" style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e5e7eb; width: 50%; vertical-align: top;">
                          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">👤 Respondent</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1f2937; word-break: break-word;">${this.escapeHtml(data.respondentName || "Anonymous")}</div>
                        </td>
                        <td class="info-cell" style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e5e7eb; width: 50%; vertical-align: top;">
                          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">📅 Submitted</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${submittedDate}</div>
                        </td>
                      </tr>
                      <tr>
                        <td class="info-cell" style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e5e7eb; width: 50%; vertical-align: top;">
                          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">${data.respondentEmail ? "✉️ Email" : "📊 Status"}</div>
                          <div style="font-size: 14px; font-weight: 600; color: #1f2937; word-break: break-word;">${data.respondentEmail
                ? this.escapeHtml(data.respondentEmail)
                : data.completionStatus || "Completed"}</div>
                        </td>
                        <td class="info-cell" style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e5e7eb; width: 50%; vertical-align: top;">
                          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">🔖 Response ID</div>
                          <div style="font-size: 12px; font-weight: 600; color: #1f2937; word-break: break-all;">${data.responseId}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Questions Section -->
                ${data.questions.length > 0
                ? `
                <tr>
                  <td class="questions-section" style="padding: 20px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0 0 16px 0;">📋 Detailed Results</h2>
                    
                    ${data.questions
                    .map((question, index) => {
                    const isCorrect = question.isCorrect;
                    const isNoScore = question.maxScore === 0;
                    const isPartial = question.score > 0 &&
                        question.score < question.maxScore;
                    const statusBgColor = isNoScore
                        ? ""
                        : isCorrect
                            ? "#d1fae5"
                            : isPartial
                                ? "#fef3c7"
                                : "#fee2e2";
                    const statusTextColor = isNoScore
                        ? ""
                        : isCorrect
                            ? "#065f46"
                            : isPartial
                                ? "#92400e"
                                : "#991b1b";
                    const statusText = isNoScore
                        ? ""
                        : isCorrect
                            ? "✓ Correct"
                            : isPartial
                                ? "~ Partial"
                                : "✗ Incorrect";
                    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 12px; overflow: hidden;">
                      <tr>
                        <td class="question-header" style="padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                          <span style="background: #667eea; color: white; width: 28px; height: 28px; border-radius: 6px; display: inline-block; text-align: center; line-height: 28px; font-weight: 700; font-size: 13px; vertical-align: middle; margin-right: 10px;">${index + 1}</span>
                          <span style="font-size: 15px; font-weight: 600; color: #1f2937; vertical-align: middle;">${this.escapeHtml(question.title)}</span>
                          <span style="float: right; font-size: 10px; padding: 3px 8px; background: #e5e7eb; color: #4b5563; border-radius: 10px; text-transform: uppercase; font-weight: 500;">${question.type}</span>
                        </td>
                      </tr>
                      <tr>
                        <td class="question-body" style="padding: 16px;">
                          <div style="padding: 14px; border-radius: 8px; margin-bottom: 10px; background: #f0f9ff; border-left: 4px solid #3b82f6;">
                            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: #1d4ed8;">👤 Your Answer</div>
                            <div style="font-size: 14px; line-height: 1.5; color: #1f2937;">${formatUserResponse(question)}</div>
                          </div>
                          
                          ${data.includeAnswerKey && question.answer !== null
                        ? `
                          <div style="padding: 14px; border-radius: 8px; background: #ecfdf5; border-left: 4px solid #10b981;">
                            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: #059669;">✓ Correct Answer</div>
                            <div style="font-size: 14px; line-height: 1.5; color: #1f2937;">${formatCorrectAnswer(question)}</div>
                          </div>
                          `
                        : ""}
                        </td>
                      </tr>
                      ${!isNoScore
                        ? `
                      <tr>
                        <td style="padding: 10px 16px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
                          <table role="presentation" class="question-footer-table" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td class="footer-cell" style="text-align: left; vertical-align: middle;">
                                <span style="padding: 5px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; background: ${statusBgColor}; color: ${statusTextColor};">${statusText}</span>
                              </td>
                              <td class="footer-cell" style="text-align: right; vertical-align: middle;">
                                <span style="font-size: 14px; font-weight: 600; color: #374151;">${question.score}/${question.maxScore} points</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>`
                        : ""}
                    </table>
                    `;
                })
                    .join("")}
                  </td>
                </tr>
                `
                : ""}
                
                <!-- Thank You Banner -->
                <tr>
                  <td style="padding: 0 20px 20px;">
                    <table role="presentation" class="thank-you-banner" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <p style="color: #92400e; font-size: 14px; margin: 0;">
                            <strong style="display: block; font-size: 16px; margin-bottom: 4px;">🙏 Thank you for your participation!</strong>
                            If you have any questions about your results, please contact the form administrator.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #1f2937; padding: 24px 20px; text-align: center;">
                    <div style="font-size: 16px; font-weight: 700; color: white; margin-bottom: 6px;">📚 Graduate Tracer System</div>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">
                      This email was automatically generated.<br>
                      Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
            return yield this.sendEmail({
                to: [data.to],
                subject: `${gradeInfo.emoji} Your Results: ${this.convertTitleToString(data.formTitle)} (${data.scorePercentage.toFixed(0)}%)`,
                html,
            });
        });
    }
    escapeHtml(text) {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    convertTitleToString(title) {
        if (typeof title === "string") {
            return title;
        }
        return (0, helper_1.contentTitleToString)(title);
    }
    formatAnswer(answer) {
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
exports.default = EmailService;
