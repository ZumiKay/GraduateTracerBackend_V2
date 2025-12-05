import { CollaboratorType } from "../../model/Form.model";

interface CollaboratorInviteEmailParams {
  inviterEmail: string;
  formTitle: string;
  role: CollaboratorType;
  inviteUrl: string;
  expiresInHours: number;
}

interface OwnershipTransferEmailParams {
  currentOwnerEmail: string;
  formTitle: string;
  inviteUrl: string;
  expiresInHours: number;
}

interface CollaboratorReminderEmailParams {
  inviterEmail: string;
  formTitle: string;
  role: CollaboratorType;
  inviteUrl: string;
  expiresInHours: number;
}

/**
 * Generate HTML email template for collaborator invitation
 */
export function generateCollaboratorInviteEmail(
  params: CollaboratorInviteEmailParams
): string {
  const { inviterEmail, formTitle, role, inviteUrl, expiresInHours } = params;

  const roleBadgeColor =
    role === CollaboratorType.owner ? "#059669" : "#3b82f6";

  return `
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
          color: blue; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          margin: 20px 0; 
          font-weight: bold;
        }
        .role-badge {
          display: inline-block;
          background-color: ${roleBadgeColor};
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤝 Collaboration Invitation</h1>
        </div>
        <div class="content">
          <h2>You've Been Invited!</h2>
          <p>Hello!</p>
          <p><strong>${inviterEmail}</strong> has invited you to collaborate on the form:</p>
          <h3 style="color: #4f46e5;">${formTitle}</h3>
          <p>Your role: <span class="role-badge">${role}</span></p>
          <p>Click the button below to accept the invitation:</p>
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;"><a href="${inviteUrl}">${inviteUrl}</a></p>
          <div class="warning">
            <strong>⏰ This invitation expires in ${expiresInHours} hours.</strong>
          </div>
        </div>
        <div class="footer">
          <p>This email was sent from Graduate Tracer System</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for ownership transfer request
 */
export function generateOwnershipTransferEmail(
  params: OwnershipTransferEmailParams
): string {
  const { currentOwnerEmail, formTitle, inviteUrl, expiresInHours } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { 
          display: inline-block;  
          color: blue; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          margin: 20px 0; 
          font-weight: bold;
        }
        .role-badge {
          display: inline-block;
          background-color: #7c3aed;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
        .info { background-color: #dbeafe; border: 1px solid #3b82f6; padding: 12px; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👑 Ownership Transfer Request</h1>
        </div>
        <div class="content">
          <h2>You've Been Selected as the New Owner!</h2>
          <p>Hello!</p>
          <p><strong>${currentOwnerEmail}</strong> wants to transfer ownership of the following form to you:</p>
          <h3 style="color: #7c3aed;">${formTitle}</h3>
          <p>Your new role: <span class="role-badge">CREATOR (Primary Owner)</span></p>
          <div class="info">
            <strong>📋 What happens when you accept:</strong>
            <ul>
              <li>You will become the primary owner (creator) of this form</li>
              <li>The current owner will be moved to the owners list</li>
              <li>You will have full control over the form and its collaborators</li>
            </ul>
          </div>
          <p>Click the button below to accept the ownership transfer:</p>
          <a href="${inviteUrl}" class="button">Accept Ownership Transfer</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;"><a href="${inviteUrl}">${inviteUrl}</a></p>
          <div class="warning">
            <strong>⏰ This invitation expires in ${expiresInHours} hours.</strong>
          </div>
        </div>
        <div class="footer">
          <p>This email was sent from Graduate Tracer System</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for collaborator invitation reminder
 */
export function generateCollaboratorReminderEmail(
  params: CollaboratorReminderEmailParams
): string {
  const { inviterEmail, formTitle, role, inviteUrl, expiresInHours } = params;

  return `
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
        .role-badge {
          display: inline-block;
          background-color: #059669;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 20px; }
        .reminder { background-color: #dbeafe; border: 1px solid #3b82f6; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Invitation Reminder</h1>
        </div>
        <div class="content">
          <div class="reminder">
            <strong>This is a reminder!</strong> You have a pending invitation to collaborate.
          </div>
          <h2>You've Been Invited!</h2>
          <p>Hello!</p>
          <p><strong>${inviterEmail}</strong> is reminding you about the invitation to collaborate on the form:</p>
          <h3 style="color: #4f46e5;">${formTitle}</h3>
          <p>Your role: <span class="role-badge">${role}</span></p>
          <p>Click the button below to accept the invitation:</p>
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;"><a href="${inviteUrl}">${inviteUrl}</a></p>
          <div class="warning">
            <strong>⏰ This invitation expires in ${expiresInHours} hours.</strong>
          </div>
        </div>
        <div class="footer">
          <p>This email was sent from Graduate Tracer System</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
