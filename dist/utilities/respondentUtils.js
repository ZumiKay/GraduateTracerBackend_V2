"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResponseDisplayName = exports.getRespondentDisplayName = exports.getNameFromEmail = void 0;
/**
 * Extracts the name from an email address (part before @)
 * @param email - The email address
 * @returns The part before @ symbol, or empty string if invalid
 */
const getNameFromEmail = (email) => {
    if (!email || typeof email !== "string")
        return "";
    const parts = email.split("@");
    return parts[0] || "";
};
exports.getNameFromEmail = getNameFromEmail;
const getRespondentDisplayName = (respondentName, respondentEmail, guestName, guestEmail) => {
    if (respondentName && respondentName.trim()) {
        return respondentName.trim();
    }
    if (guestName && guestName.trim()) {
        return guestName.trim();
    }
    if (respondentEmail) {
        const nameFromEmail = (0, exports.getNameFromEmail)(respondentEmail);
        if (nameFromEmail) {
            return nameFromEmail;
        }
    }
    if (guestEmail) {
        const nameFromEmail = (0, exports.getNameFromEmail)(guestEmail);
        if (nameFromEmail) {
            return nameFromEmail;
        }
    }
    return "Anonymous";
};
exports.getRespondentDisplayName = getRespondentDisplayName;
/**
 * Gets display name for a response object
 * @param response - Response object with respondent data
 * @returns The best available name or "Anonymous"
 */
const getResponseDisplayName = (response) => {
    return (0, exports.getRespondentDisplayName)(response.respondentName, response.respondentEmail, response.guest?.name, response.guest?.email);
};
exports.getResponseDisplayName = getResponseDisplayName;
