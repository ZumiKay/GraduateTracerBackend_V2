import HandleEmail from "./email";

/**
 * Send removal link email to respondent
 * @param respondentEmail - Email address of the respondent
 * @param removeCode - Unique removal code
 * @param formTitle - Title of the form (optional, for better user experience)
 * @param baseUrl - Base URL of your application (defaults to FRONTEND_URL env var)
 * @returns Promise with success status
 */
export const sendRemovalLinkEmail = async (
  respondentEmail: string,
  removeCode: string,
  formTitle?: string,
  baseUrl?: string
): Promise<{ success: boolean; message: string }> => {
  const frontendUrl =
    baseUrl || process.env.FRONTEND_URL || "http://localhost:3000";
  const removalUrl = `${frontendUrl}/response/session/replace?code=${removeCode}`;

  const subject = "Remove Your Form Response - Action Required";

  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Remove Form Response</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
        }
        
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 24px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        
        .header p {
          font-size: 16px;
          opacity: 0.9;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .greeting {
          font-size: 18px;
          color: #333;
          margin-bottom: 20px;
        }
        
        .message {
          font-size: 16px;
          color: #555;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        
        .form-info {
          background-color: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 15px 20px;
          margin: 25px 0;
          border-radius: 4px;
        }
        
        .form-info strong {
          color: #667eea;
        }
        
        .button-container {
          text-align: center;
          margin: 35px 0;
        }
        
        .removal-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .removal-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }
        
        .warning-box {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        
        .warning-icon {
          font-size: 24px;
          color: #e17055;
          margin-bottom: 10px;
        }
        
        .warning-text {
          color: #856404;
          font-size: 14px;
          font-weight: 500;
        }
        
        .alternative-link {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          margin: 25px 0;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        
        .alternative-link code {
          background-color: #e9ecef;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          word-break: break-all;
        }
        
        .footer {
          background-color: #f8f9fa;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        
        .footer p {
          color: #666;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        .footer .support {
          color: #667eea;
          font-weight: 500;
        }
        
        .security-notice {
          font-size: 12px;
          color: #999;
          margin-top: 20px;
          padding: 15px;
          background-color: #f1f3f4;
          border-radius: 6px;
        }
        
        @media (max-width: 600px) {
          .email-container {
            margin: 10px;
            border-radius: 8px;
          }
          
          .header,
          .content,
          .footer {
            padding: 25px 20px;
          }
          
          .removal-button {
            padding: 14px 28px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🗑️ Remove Your Response</h1>
          <p>Form Response Removal Request</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello,
          </div>
          
          <div class="message">
            You have requested to remove your response from our system. This action will permanently delete your submitted form data.
          </div>
          
          ${
            formTitle
              ? `
          <div class="form-info">
            <strong>Form:</strong> ${formTitle}
          </div>
          `
              : ""
          }
          
          <div class="warning-box">
            <div class="warning-icon">⚠️</div>
            <div class="warning-text">
              <strong>Important:</strong> This action cannot be undone. Once you click the button below, your response will be permanently removed from our system.
            </div>
          </div>
          
          <div class="button-container">
            <a href="${removalUrl}" class="removal-button">
              Remove My Response
            </a>
          </div>
          
          <div class="alternative-link">
            <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
            <code>${removalUrl}</code>
          </div>
          
          <div class="message">
            If you did not request this removal or believe this email was sent in error, please ignore this message and contact our support team immediately.
          </div>
        </div>
        
        <div class="footer">
          <p>This removal link will expire after use or when your session expires.</p>
          <p class="support">Need help? Contact our support team</p>
          
          <div class="security-notice">
            <strong>Security Notice:</strong> This email contains a secure removal link. Do not forward this email to anyone else. If you suspect unauthorized access to your account, please contact us immediately.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await HandleEmail(respondentEmail, subject, htmlTemplate);

    return result;
  } catch (error: any) {
    console.error("Error sending removal link email:", error);
    return {
      success: false,
      message: `Failed to send removal email: ${error.message}`,
    };
  }
};

/**
 * Send bulk removal link emails to multiple respondents
 * @param recipients - Array of recipient objects with email and removeCode
 * @param formTitle - Title of the form (optional)
 * @param baseUrl - Base URL of your application
 * @returns Promise with results for each email sent
 */
export const sendBulkRemovalEmails = async (
  recipients: Array<{ email: string; removeCode: string }>,
  formTitle?: string,
  baseUrl?: string
): Promise<Array<{ email: string; success: boolean; message: string }>> => {
  const results: Array<{ email: string; success: boolean; message: string }> =
    [];

  for (const recipient of recipients) {
    try {
      const result = await sendRemovalLinkEmail(
        recipient.email,
        recipient.removeCode,
        formTitle,
        baseUrl
      );

      results.push({
        email: recipient.email,
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      results.push({
        email: recipient.email,
        success: false,
        message: `Failed to send email: ${error.message}`,
      });
    }
  }

  return results;
};

export default {
  sendRemovalLinkEmail,
  sendBulkRemovalEmails,
};
