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

export const getRespondentDisplayName = (
  respondentName?: string,
  respondentEmail?: string,
  guestName?: string,
  guestEmail?: string,
): string => {
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
    response.guest?.email,
  );
};
