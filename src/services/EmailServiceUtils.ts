import EmailService, {
  ResponseEmailData,
  FormLinkEmailData,
} from "./EmailService";
import { ContentTitle } from "../model/Content.model";
import { contentTitleToString } from "../utilities/helper";

/**
 * Utility functions for working with EmailService and ContentTitle
 */

/**
 * Create a ResponseEmailData object with ContentTitle support
 */
export function createResponseEmailData(
  recipient: string,
  formTitle: string | ContentTitle,
  responseData: {
    totalScore: number;
    maxScore: number;
    responseId: string;
    isAutoScored: boolean;
    questions?: Array<{
      title: string | ContentTitle;
      type: string;
      answer: any;
      userResponse: any;
      score: number;
      maxScore: number;
      isCorrect?: boolean;
    }>;
    respondentName?: string;
    submittedAt?: Date;
  }
): ResponseEmailData {
  return {
    to: recipient,
    formTitle,
    ...responseData,
  };
}

/**
 * Create a FormLinkEmailData object with ContentTitle support
 */
export function createFormLinkEmailData(
  formId: string,
  formTitle: string | ContentTitle,
  formOwner: string,
  recipientEmails: string[],
  message?: string
): FormLinkEmailData {
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
export function previewEmailContent(
  emailData: ResponseEmailData | FormLinkEmailData
): {
  formTitle: string;
  questionTitles?: string[];
} {
  const formTitle =
    typeof emailData.formTitle === "string"
      ? emailData.formTitle
      : contentTitleToString(emailData.formTitle);

  let questionTitles: string[] | undefined;
  if ("questions" in emailData && emailData.questions) {
    questionTitles = emailData.questions.map((q: any) =>
      typeof q.title === "string" ? q.title : contentTitleToString(q.title)
    );
  }

  return {
    formTitle,
    questionTitles,
  };
}

/**
 * Validate ContentTitle content before sending email
 */
export function validateEmailContentTitle(
  contentTitle: ContentTitle | string
): boolean {
  if (typeof contentTitle === "string") {
    return contentTitle.trim().length > 0;
  }

  const converted = contentTitleToString(contentTitle);
  return converted.trim().length > 0;
}

export default {
  createResponseEmailData,
  createFormLinkEmailData,
  previewEmailContent,
  validateEmailContentTitle,
};
