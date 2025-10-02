/**
 * Example usage of the removal email functionality
 *
 * This file shows how to use the sendRemovalLinkEmail function
 * in different scenarios throughout your application.
 */

import {
  sendRemovalLinkEmail,
  sendBulkRemovalEmails,
} from "../utilities/removalEmail";
import FormsessionService from "../controller/formsession.controller";

// Example 1: Send single removal email
export const sendSingleRemovalExample = async () => {
  try {
    const result = await sendRemovalLinkEmail(
      "user@example.com",
      "123456",
      "Customer Satisfaction Survey"
    );

    if (result.success) {
      console.log("✅ Removal email sent successfully");
    } else {
      console.error("❌ Failed to send removal email:", result.message);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

// Example 2: Send bulk removal emails
export const sendBulkRemovalExample = async () => {
  const recipients = [
    { email: "user1@example.com", removeCode: "123456" },
    { email: "user2@example.com", removeCode: "789012" },
    { email: "user3@example.com", removeCode: "345678" },
  ];

  try {
    const results = await sendBulkRemovalEmails(
      recipients,
      "Employee Survey 2024"
    );

    results.forEach((result) => {
      if (result.success) {
        console.log(`✅ Sent removal email to: ${result.email}`);
      } else {
        console.log(`❌ Failed to send to ${result.email}: ${result.message}`);
      }
    });
  } catch (error) {
    console.error("Bulk email error:", error);
  }
};

// Example 3: Integration with form session logic
export const handleDuplicateSession = async (
  respondentEmail: string,
  formId: string,
  removeCode: string
) => {
  try {
    // This is how it's used in FormsessionService.RespondentLogin
    const emailResult = await sendRemovalLinkEmail(
      respondentEmail,
      removeCode,
      undefined, // Form title will be fetched using formId
      process.env.FRONTEND_URL
    );

    if (emailResult.success) {
      console.log(`Removal instructions sent to ${respondentEmail}`);
      return {
        success: true,
        message: "Removal instructions sent to your email",
      };
    } else {
      console.error(`Failed to send removal email: ${emailResult.message}`);
      return {
        success: false,
        message: "Failed to send removal instructions",
      };
    }
  } catch (error) {
    console.error("handleDuplicateSession error:", error);
    return {
      success: false,
      message: "An error occurred while sending removal instructions",
    };
  }
};

// Example 4: Manual trigger (for admin dashboard or support)
export const manualRemovalTrigger = async (sessionId: string) => {
  try {
    // This would be called from an admin endpoint
    // You could add this to your FormsessionService

    // First, find the session and generate removal code
    // Then send the email

    console.log("Manual removal trigger for session:", sessionId);
    // Implementation would be similar to the existing logic
  } catch (error) {
    console.error("Manual removal trigger error:", error);
  }
};

/**
 * Route handler example for manual email sending
 * You can add this route to your router if needed
 */
export const removalEmailRouteExample = {
  // POST /formsession/send-removal-email
  endpoint: "/formsession/send-removal-email",
  method: "POST",
  handler: FormsessionService.SendRemovalEmailEndpoint,

  // Example request body:
  exampleBody: {
    respondentEmail: "user@example.com",
    removeCode: "123456",
    formId: "507f1f77bcf86cd799439011", // optional
  },

  // Example response:
  exampleResponse: {
    success: true,
    status: 200,
    message: "Removal email sent successfully",
  },
};

export default {
  sendSingleRemovalExample,
  sendBulkRemovalExample,
  handleDuplicateSession,
  manualRemovalTrigger,
  removalEmailRouteExample,
};
