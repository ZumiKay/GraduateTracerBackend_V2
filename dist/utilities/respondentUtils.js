"use strict";
/**
 * Utility functions for handling respondent data in backend
 */
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
/**
 * Gets the display name for a respondent, falling back to email name if no name provided
 * @param respondentName - The respondent's name (optional)
 * @param respondentEmail - The respondent's email (optional)
 * @param guestName - Guest name (optional)
 * @param guestEmail - Guest email (optional)
 * @returns The best available name or "Anonymous"
 */
const getRespondentDisplayName = (respondentName, respondentEmail, guestName, guestEmail) => {
    // Priority order:
    // 1. Respondent name
    // 2. Guest name
    // 3. Name from respondent email
    // 4. Name from guest email
    // 5. "Anonymous"
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
    var _a, _b;
    return (0, exports.getRespondentDisplayName)(response.respondentName, response.respondentEmail, (_a = response.guest) === null || _a === void 0 ? void 0 : _a.name, (_b = response.guest) === null || _b === void 0 ? void 0 : _b.email);
};
exports.getResponseDisplayName = getResponseDisplayName;
