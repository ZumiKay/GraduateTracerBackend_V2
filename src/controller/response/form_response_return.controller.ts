import { Response } from "express";
import { CustomRequest } from "../../types/customType";
import { FormResponseController } from "./form_response.controller";
import FormResponse, {
  ResponseAnswerReturnType,
  ResponseAnswerType,
} from "../../model/Response.model";
import Form, { createFormValidate, TypeForm } from "../../model/Form.model";
import Content, {
  AnswerKey,
  ChoiceQuestionType,
  ContentType,
  QuestionType,
} from "../../model/Content.model";
import EmailService from "../../services/EmailService";
import { ResponseQueryService } from "../../services/ResponseQueryService";
import {
  AddQuestionNumbering,
  ReturnCode,
  convertResponseToString,
  formatDateToDDMMYYYY,
} from "../../utilities/helper";
import { hasFormAccess } from "../../utilities/formHelpers";
import { Types } from "mongoose";

interface ReturnResponseRequestBody {
  responseId: string;
  html: string;
  reason?: string;
  feedback?: string;
  includeQuestionsAndResponses?: boolean;
}

// Style constants for email rendering
const EMAIL_STYLES = {
  range: {
    container:
      "background-color: #e0f2fe; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 8px 0;",
    label:
      "font-size: 11px; color: #0369a1; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;",
    value: "font-size: 16px; color: #0c4a6e; font-weight: bold;",
    arrow:
      "text-align: center; color: #0ea5e9; font-size: 20px; font-weight: bold;",
  },
  date: {
    container:
      "background-color: #dcfce7; border-radius: 6px; border-left: 4px solid #22c55e; margin: 8px 0;",
    text: "font-size: 15px; color: #166534; font-weight: bold; margin-left: 8px;",
  },
  option: {
    selected: {
      bg: "#d1fae5",
      text: "#10b981",
      weight: "bold",
      border: "2px solid #10b981",
      icon: "✅",
    },
    unselected: {
      bg: "#f9fafb",
      text: "#6b7280",
      weight: "normal",
      border: "1px solid #e5e7eb",
      icon: "⬜",
    },
    cell: "padding: 10px 14px; border-radius: 6px; margin-bottom: 4px;",
  },
} as const;

/**
 * Render range response (date or number)
 */
const renderRangeResponse = (
  response: { start: any; end: any },
  isDate: boolean
): string => {
  const startValue =
    isDate && typeof response.start === "string"
      ? formatDateToDDMMYYYY(response.start)
      : response.start;
  const endValue =
    isDate && typeof response.end === "string"
      ? formatDateToDDMMYYYY(response.end)
      : response.end;

  return `<table width="100%" cellpadding="12" cellspacing="0" style="${EMAIL_STYLES.range.container}">
    <tr>
      <td width="45%" style="text-align: center; padding: 12px;">
        <div style="${EMAIL_STYLES.range.label}">START</div>
        <div style="${EMAIL_STYLES.range.value}">${startValue}</div>
      </td>
      <td width="10%" style="${EMAIL_STYLES.range.arrow}">→</td>
      <td width="45%" style="text-align: center; padding: 12px;">
        <div style="${EMAIL_STYLES.range.label}">END</div>
        <div style="${EMAIL_STYLES.range.value}">${endValue}</div>
      </td>
    </tr>
  </table>`;
};

/**
 * Render date response
 */
const renderDateResponse = (date: string): string => {
  const formattedDate = formatDateToDDMMYYYY(date);
  return `<table cellpadding="10" cellspacing="0" style="${EMAIL_STYLES.date.container}">
    <tr>
      <td style="padding: 10px 16px;">
        <span style="font-size: 18px;">📅</span>
        <span style="${EMAIL_STYLES.date.text}">${formattedDate}</span>
      </td>
    </tr>
  </table>`;
};

/**
 * Extract selected indices from response
 */
const extractSelectedIndices = (
  response: ResponseAnswerType | ResponseAnswerReturnType
) => {
  if (!response) return [];

  if (typeof response === "object" && response !== null && "key" in response) {
    const key = response.key;
    return Array.isArray(key) ? key : [key];
  }

  if (typeof response === "number") {
    return [response];
  }

  if (Array.isArray(response)) {
    return response.filter((r) => typeof r === "number");
  }
};

/**
 * Render choice options (checkbox, multiple, selection)
 */
const renderChoiceOptions = (
  options: Array<ChoiceQuestionType>,
  response: ResponseAnswerType | ResponseAnswerReturnType
): string => {
  const selectedIndices = extractSelectedIndices(response);

  if (!selectedIndices) return "";
  const rows = options
    .map((option) => {
      const isSelected = selectedIndices.includes(option.idx);
      const style = isSelected
        ? EMAIL_STYLES.option.selected
        : EMAIL_STYLES.option.unselected;

      return `<tr>
      <td style="color: ${style.text}; font-weight: ${style.weight}; background-color: ${style.bg}; ${EMAIL_STYLES.option.cell} border: ${style.border};">
        <span style="font-size: 16px;">${style.icon}</span>
        <span style="margin-left: 8px;">${option.content}</span>
      </td>
    </tr>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">${rows}</table>`;
};

/**
 * Render response value with all options for choice questions
 * Optimized with separated concerns and reusable functions
 */
const renderResponseValue = (
  response: ResponseAnswerType | ResponseAnswerReturnType,
  question: ContentType
): string => {
  // Handle range types (RangeDate or RangeNumber)
  if (
    response &&
    typeof response === "object" &&
    "start" in response &&
    "end" in response
  ) {
    return renderRangeResponse(
      response,
      question.type === QuestionType.RangeDate
    );
  }

  // Handle single Date type
  if (question.type === QuestionType.Date && typeof response === "string") {
    return renderDateResponse(response);
  }

  // Handle choice questions (checkbox, multiple, selection)
  const options = question[
    question.type as keyof ContentType
  ] as Array<ChoiceQuestionType>;

  if (
    options?.length > 0 &&
    (question.checkbox || question.multiple || question.selection)
  ) {
    return renderChoiceOptions(options, response);
  }

  // Fallback for other question types
  return convertResponseToString(response);
};

class FormResponseReturnController extends FormResponseController {
  public ReturnResponse = async (req: CustomRequest, res: Response) => {
    const { responseId, html, reason, feedback, includeQuestionsAndResponses } =
      req.body as ReturnResponseRequestBody;
    const user = req.user;

    // Validate user authentication
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!responseId) {
      return res.status(400).json({ message: "Response ID is required" });
    }

    if (!html) {
      return res.status(400).json({ message: "HTML content is required" });
    }

    try {
      const formResponse = await FormResponse.findById(responseId)
        .select("responseset formId totalScore respondentEmail")
        .lean();
      if (!formResponse) {
        return res.status(404).json({ message: "Response not found" });
      }
      const form = await Form.findById(formResponse.formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      // Fetch content/questions to use with ResponsesetProcessQuestion
      const contents = await Content.find({
        formId: formResponse.formId,
      })
        .select(
          "_id title type require qIdx checkbox multiple selection score answer parentcontent conditional"
        )
        .lean();

      if (!contents || contents.length === 0) {
        return res.status(404).json({ message: "Form questions not found" });
      }

      if (!hasFormAccess(form, new Types.ObjectId(user.sub))) {
        return res.status(403).json({
          message:
            "You don't have permission to return responses for this form",
        });
      }

      //Verify the form response totalscore
      if (formResponse.totalScore === undefined) {
        return res.status(400).json({
          message: "Response has no score to return",
        });
      }

      const recipientEmail = formResponse.respondentEmail;

      if (!recipientEmail) {
        return res.status(400).json({
          message: "No email address found for this respondent",
        });
      }

      try {
        const emailService = new EmailService();

        // Generate questions and responses HTML if requested
        let questionsHtml = "";
        if (includeQuestionsAndResponses && formResponse.responseset) {
          // Use ResponseQueryService to process responses (same as GetResponseById)

          //Add number to question
          const numberedContent = AddQuestionNumbering({
            questions: contents,
          });
          const processedResponseSet =
            ResponseQueryService.ResponsesetProcessQuestion(
              numberedContent,
              formResponse.responseset,
              { filterHidden: true }
            );
          questionsHtml = `
            <div class="questions-section" style="margin: 30px 0;">
              <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Your Questions and Responses</h3>
              ${processedResponseSet
                .map((resp) => {
                  const question = resp.question as ContentType;
                  if (!question) return "";

                  const questionTitle = question.title;
                  const isTextType = question.type === QuestionType.Text;
                  const hasScore =
                    question.score !== undefined && question.score > 0;

                  return `
                    <div class="question-item" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
                      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">Q${
                          question.questionId
                        }</span>
                        <span style="background-color: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 4px; font-size: 11px;">${
                          question.type || "Unknown"
                        }</span>
                      </div>
                      <div style="margin: 12px 0;">
                        <strong style="color: #374151; font-size: 14px;">${questionTitle}</strong>
                      </div>
                      ${
                        isTextType
                          ? ""
                          : `
                      <div style="background-color: white; border-left: 3px solid #60a5fa; padding: 12px; margin-top: 10px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 5px;">YOUR ANSWER:</div>
                        <div style="color: #111827; font-size: 14px;">${renderResponseValue(
                          resp.response,
                          question
                        )}</div>
                      </div>`
                      }
                      ${
                        !isTextType &&
                        question.hasAnswer &&
                        question.answer &&
                        form.type === TypeForm.Quiz
                          ? `
                        <div style="background-color: #d1fae5; border-left: 3px solid #10b981; padding: 12px; margin-top: 10px; border-radius: 4px;">
                          <div style="font-size: 12px; color: #065f46; font-weight: 600; margin-bottom: 5px;">CORRECT ANSWER:</div>
                          <div style="color: #065f46; font-size: 14px;">${renderResponseValue(
                            typeof question.answer === "object" &&
                              "answer" in question.answer
                              ? question.answer.answer
                              : question.answer,
                            question
                          )}</div>
                        </div>
                      `
                          : ""
                      }
                      ${
                        hasScore && resp.score !== undefined
                          ? `<div style="text-align: right; margin-top: 10px; color: #7c3aed; font-weight: bold;">Score: ${
                              resp.score
                            } / ${question.score || 0}</div>`
                          : ""
                      }
                      ${
                        resp.comment
                          ? `
                        <div style="background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px; margin-top: 10px; border-radius: 4px;">
                          <div style="font-size: 12px; color: #92400e; font-weight: 600; margin-bottom: 5px;">INSTRUCTOR COMMENT:</div>
                          <div style="color: #78350f; font-size: 14px;">${resp.comment}</div>
                        </div>
                      `
                          : ""
                      }
                    </div>
                  `;
                })
                .filter(Boolean)
                .join("")}
            </div>
          `;
        }

        // Create email content with score and custom HTML
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
              <tr>
                <td align="center" style="padding: 20px;">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px;">
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #f59e0b; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 24px;">Your Form Response Has Been Returned</h1>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 30px 20px;">
                        <h2 style="color: #1f2937; margin-top: 0;">${
                          form.title
                        }</h2>
                        <p style="color: #4b5563;">Your response has been reviewed and returned with feedback.</p>
                        
                        <!-- Score Card -->
                        <table width="100%" cellpadding="20" cellspacing="0" style="background-color: white; border: 2px solid #f59e0b; border-radius: 8px; margin: 20px 0;">
                          <tr>
                            <td style="text-align: center;">
                              <div style="font-size: 36px; font-weight: bold; color: #f59e0b; margin-bottom: 10px;">${
                                formResponse.totalScore
                              }</div>
                              <p style="margin: 0; color: #4b5563;">Your Current Score</p>
                            </td>
                          </tr>
                        </table>
                
                        ${
                          reason
                            ? `
                        <!-- Reason Section -->
                        <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; margin: 20px 0;">
                          <tr>
                            <td>
                              <h3 style="margin-top: 0; color: #92400e;">Reason for Return:</h3>
                              <p style="margin-bottom: 0; color: #78350f;">${reason}</p>
                            </td>
                          </tr>
                        </table>
                        `
                            : ""
                        }
                        
                        ${
                          feedback
                            ? `
                        <!-- Feedback Section -->
                        <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; margin: 20px 0;">
                          <tr>
                            <td>
                              <h3 style="margin-top: 0; color: #92400e;">Feedback:</h3>
                              <p style="margin-bottom: 0; color: #78350f;">${feedback}</p>
                            </td>
                          </tr>
                        </table>
                        `
                            : ""
                        }
                        
                        <!-- Custom Content -->
                        <table width="100%" cellpadding="20" cellspacing="0" style="background-color: white; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
                          <tr>
                            <td>
                              <h3 style="margin-top: 0; color: #1f2937;">Additional Information:</h3>
                              ${html}
                            </td>
                          </tr>
                        </table>
                        
                        ${questionsHtml}
                        
                        <p style="color: #6b7280; font-size: 14px;">Response ID: ${
                          formResponse._id
                        }</p>
                        <p style="color: #4b5563;">Please review the feedback and make any necessary corrections before resubmitting.</p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px; text-align: center; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">This email was sent from Graduate Tracer System</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        const emailSuccess = await emailService.sendEmail({
          to: [recipientEmail],
          subject: `Response Returned: ${form.title}`,
          html: emailHtml,
        });

        if (!emailSuccess) {
          console.warn(
            "Failed to send return email, but continuing with response update"
          );
        }

        return res
          .status(200)
          .json({ ...ReturnCode(200), returnContent: questionsHtml });
      } catch (emailError) {
        console.error("Error sending return email:", emailError);
        return res.status(500).json({
          message: "Failed to send return email",
          error:
            emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error returning response:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

export default new FormResponseReturnController();
