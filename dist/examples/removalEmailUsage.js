"use strict";
/**
 * Example usage of the removal email functionality
 *
 * This file shows how to use the sendRemovalLinkEmail function
 * in different scenarios throughout your application.
 */
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
exports.removalEmailRouteExample = exports.manualRemovalTrigger = exports.handleDuplicateSession = exports.sendBulkRemovalExample = exports.sendSingleRemovalExample = void 0;
const formsession_controller_1 = __importDefault(require("../controller/form/formsession.controller"));
const removalEmail_1 = require("../utilities/removalEmail");
// Example 1: Send single removal email
const sendSingleRemovalExample = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield (0, removalEmail_1.sendRemovalLinkEmail)("user@example.com", "123456", "Customer Satisfaction Survey");
        if (result.success) {
            console.log("✅ Removal email sent successfully");
        }
        else {
            console.error("❌ Failed to send removal email:", result.message);
        }
    }
    catch (error) {
        console.error("Error:", error);
    }
});
exports.sendSingleRemovalExample = sendSingleRemovalExample;
// Example 2: Send bulk removal emails
const sendBulkRemovalExample = () => __awaiter(void 0, void 0, void 0, function* () {
    const recipients = [
        { email: "user1@example.com", removeCode: "123456" },
        { email: "user2@example.com", removeCode: "789012" },
        { email: "user3@example.com", removeCode: "345678" },
    ];
    try {
        const results = yield (0, removalEmail_1.sendBulkRemovalEmails)(recipients, "Employee Survey 2024");
        results.forEach((result) => {
            if (result.success) {
                console.log(`✅ Sent removal email to: ${result.email}`);
            }
            else {
                console.log(`❌ Failed to send to ${result.email}: ${result.message}`);
            }
        });
    }
    catch (error) {
        console.error("Bulk email error:", error);
    }
});
exports.sendBulkRemovalExample = sendBulkRemovalExample;
// Example 3: Integration with form session logic
const handleDuplicateSession = (respondentEmail, formId, removeCode) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // This is how it's used in FormsessionService.RespondentLogin
        const emailResult = yield (0, removalEmail_1.sendRemovalLinkEmail)(respondentEmail, removeCode, formId, process.env.FRONTEND_URL);
        if (emailResult.success) {
            console.log(`Removal instructions sent to ${respondentEmail}`);
            return {
                success: true,
                message: "Removal instructions sent to your email",
            };
        }
        else {
            console.error(`Failed to send removal email: ${emailResult.message}`);
            return {
                success: false,
                message: "Failed to send removal instructions",
            };
        }
    }
    catch (error) {
        console.error("handleDuplicateSession error:", error);
        return {
            success: false,
            message: "An error occurred while sending removal instructions",
        };
    }
});
exports.handleDuplicateSession = handleDuplicateSession;
// Example 4: Manual trigger (for admin dashboard or support)
const manualRemovalTrigger = (sessionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // This would be called from an admin endpoint
        // You could add this to your FormsessionService
        // First, find the session and generate removal code
        // Then send the email
        console.log("Manual removal trigger for session:", sessionId);
        // Implementation would be similar to the existing logic
    }
    catch (error) {
        console.error("Manual removal trigger error:", error);
    }
});
exports.manualRemovalTrigger = manualRemovalTrigger;
/**
 * Route handler example for manual email sending
 * You can add this route to your router if needed
 */
exports.removalEmailRouteExample = {
    // POST /formsession/send-removal-email
    endpoint: "/formsession/send-removal-email",
    method: "POST",
    handler: formsession_controller_1.default.SendRemovalEmailEndpoint,
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
exports.default = {
    sendSingleRemovalExample: exports.sendSingleRemovalExample,
    sendBulkRemovalExample: exports.sendBulkRemovalExample,
    handleDuplicateSession: exports.handleDuplicateSession,
    manualRemovalTrigger: exports.manualRemovalTrigger,
    removalEmailRouteExample: exports.removalEmailRouteExample,
};
