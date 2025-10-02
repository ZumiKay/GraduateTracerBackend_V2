"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResponseEmailData = createResponseEmailData;
exports.createFormLinkEmailData = createFormLinkEmailData;
exports.previewEmailContent = previewEmailContent;
exports.validateEmailContentTitle = validateEmailContentTitle;
const helper_1 = require("../utilities/helper");
/**
 * Utility functions for working with EmailService and ContentTitle
 */
/**
 * Create a ResponseEmailData object with ContentTitle support
 */
function createResponseEmailData(recipient, formTitle, responseData) {
    return Object.assign({ to: recipient, formTitle }, responseData);
}
/**
 * Create a FormLinkEmailData object with ContentTitle support
 */
function createFormLinkEmailData(formId, formTitle, formOwner, recipientEmails, message) {
    return {
        formId,
        formTitle,
        formOwner,
        recipientEmails,
        message,
    };
}
/**
 * Preview email content by converting ContentTitle to string
 */
function previewEmailContent(emailData) {
    const formTitle = typeof emailData.formTitle === "string"
        ? emailData.formTitle
        : (0, helper_1.contentTitleToString)(emailData.formTitle);
    let questionTitles;
    if ("questions" in emailData && emailData.questions) {
        questionTitles = emailData.questions.map((q) => typeof q.title === "string" ? q.title : (0, helper_1.contentTitleToString)(q.title));
    }
    return {
        formTitle,
        questionTitles,
    };
}
/**
 * Validate ContentTitle content before sending email
 */
function validateEmailContentTitle(contentTitle) {
    if (typeof contentTitle === "string") {
        return contentTitle.trim().length > 0;
    }
    const converted = (0, helper_1.contentTitleToString)(contentTitle);
    return converted.trim().length > 0;
}
exports.default = {
    createResponseEmailData,
    createFormLinkEmailData,
    previewEmailContent,
    validateEmailContentTitle,
};
