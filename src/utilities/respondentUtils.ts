/**
 * Utility functions for handling respondent data in backend
 */

/**
 * Extracts the name from an email address (part before @)
 * @param email - The email address
 * @returns The part before @ symbol, or empty string if invalid
 */
export const getNameFromEmail = (email: string): string => {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  return parts[0] || "";
};

/**
 * Gets the display name for a respondent, falling back to email name if no name provided
 * @param respondentName - The respondent's name (optional)
 * @param respondentEmail - The respondent's email (optional)
 * @param guestName - Guest name (optional)
 * @param guestEmail - Guest email (optional)
 * @returns The best available name or "Anonymous"
 */
export const getRespondentDisplayName = (
  respondentName?: string,
  respondentEmail?: string,
  guestName?: string,
  guestEmail?: string
): string => {
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
    const nameFromEmail = getNameFromEmail(respondentEmail);
    if (nameFromEmail) {
      return nameFromEmail;
    }
  }

  if (guestEmail) {
    const nameFromEmail = getNameFromEmail(guestEmail);
    if (nameFromEmail) {
      return nameFromEmail;
    }
  }

  return "Anonymous";
};

/**
 * Gets display name for a response object
 * @param response - Response object with respondent data
 * @returns The best available name or "Anonymous"
 */
export const getResponseDisplayName = (response: {
  respondentName?: string;
  respondentEmail?: string;
  guest?: {
    name?: string;
    email?: string;
  };
}): string => {
  return getRespondentDisplayName(
    response.respondentName,
    response.respondentEmail,
    response.guest?.name,
    response.guest?.email
  );
};
