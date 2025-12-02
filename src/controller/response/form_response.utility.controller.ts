import { Response } from "express";
import { contentTitleToString, ReturnCode } from "../../utilities/helper";
import SolutionValidationService from "../../services/SolutionValidationService";
import EmailService from "../../services/EmailService";
import FormLinkService from "../../services/FormLinkService";
import User from "../../model/User.model";
import { Types } from "mongoose";
import Form, { CollaboratorType, TypeForm } from "../../model/Form.model";
import FormResponse, { ResponseAnswerType } from "../../model/Response.model";
import { ContentType, QuestionType } from "../../model/Content.model";
import { ResponseValidationService } from "../../services/ResponseValidationService";
import { verifyRole } from "../../utilities/formHelpers";
import { getResponseDisplayName } from "../../utilities/respondentUtils";
import { CustomRequest } from "../../types/customType";

export class FormResponseUtilityController {
  public ValidateFormForSubmission = async (
    req: CustomRequest,
    res: Response
  ) => {
    const { formId } = req.query;

    if (!formId || typeof formId !== "string") {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      const validationSummary = await SolutionValidationService.validateForm(
        formId
      );
      const errors = await SolutionValidationService.getFormValidationErrors(
        formId
      );

      res.status(200).json({
        ...ReturnCode(200),
        data: {
          ...validationSummary,
          errors,
          canSubmit: errors.length === 0,
        },
      });
    } catch (error) {
      console.error("Validate Form Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to validate form"));
    }
  };

  public SendFormLinks = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: true,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { formId, emails, message } = req.body;
      if (!formId || !emails || !Array.isArray(emails) || emails.length === 0) {
        return res
          .status(400)
          .json(ReturnCode(400, "Form ID and email list are required"));
      }

      const form = await Form.findById(formId);
      if (!form || !form.setting?.acceptResponses) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (form.user.toString() !== validation.user.sub) {
        return res.status(403).json(ReturnCode(403, "Unauthorized"));
      }

      const emailService = new EmailService();
      const userDetails = await User.findById(
        new Types.ObjectId(validation.user.sub)
      );

      const success = await emailService.sendFormLinks({
        formId,
        formTitle: form.title,
        formOwner: userDetails?.email || "Form Owner",
        recipientEmails: emails,
        message,
      });

      res
        .status(200)
        .json(
          ReturnCode(
            200,
            success
              ? "Form links sent successfully"
              : "Failed to send form links"
          )
        );
    } catch (error) {
      console.error("Send Form Links Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to send form links"));
    }
  };

  public GenerateFormLink = async (req: CustomRequest, res: Response) => {
    if (!req.user) return res.status(401).json(ReturnCode(401));
    try {
      const { formId } = req.body;
      if (!formId) {
        return res.status(400).json(ReturnCode(400, "Form ID is required"));
      }

      const form = await Form.findById(formId).select("_id user");
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (
        !verifyRole(
          CollaboratorType.creator,
          form,
          new Types.ObjectId(req.user.sub)
        ) &&
        !verifyRole(
          CollaboratorType.owner,
          form,
          new Types.ObjectId(req.user.sub)
        )
      ) {
        return res.status(403).json(ReturnCode(403, "No Access"));
      }

      const linkService = new FormLinkService();
      const link = await linkService.getValidatedFormLink(formId);

      return res.status(200).json({ ...ReturnCode(200), data: link });
    } catch (error) {
      const err = error as Error;
      console.error("Generate Form Link Error:", error);
      return res.status(500).json({
        ...ReturnCode(500, "Failed to generate form link"),
        error: err?.message,
      });
    }
  };

  public SendResponseCardEmail = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { responseId, recipientEmail } = req.body;
      if (!responseId || !recipientEmail) {
        return res
          .status(400)
          .json(
            ReturnCode(400, "Response ID and recipient email are required")
          );
      }

      const response = await FormResponse.findById(responseId)
        .populate("formId")
        .populate({
          path: "responseset.question",
        })
        .lean();

      if (!response) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      const form = response.formId as any;
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      const hasAccess = await ResponseValidationService.validateFormAccess(
        form._id.toString(),
        validation.user.sub,
        res
      );
      if (!hasAccess) return;

      const questions: Array<{
        title: string;
        type: string;
        answer: ResponseAnswerType | null;
        userResponse: ResponseAnswerType;
        score: number;
        maxScore: number;
        isCorrect?: boolean;
      }> = [];

      let totalScore = 0;
      let maxScore = 0;
      let hasNonAutoScorableQuestions = false;
      const nonAutoScorableWarnings = new Set<number>();

      for (const responseItem of response.responseset) {
        const question = responseItem.question as ContentType;
        if (!question) continue;

        const questionType = question.type as QuestionType;
        const hasAnswerKey =
          question.answer &&
          SolutionValidationService.isAnswerisempty(question.answer.answer);
        const questionScore = question.score || 0;
        maxScore += questionScore;

        if (!hasAnswerKey) {
          nonAutoScorableWarnings.add(question.qIdx);
        }

        questions.push({
          title: contentTitleToString(question.title),
          type: questionType,
          answer: hasAnswerKey
            ? (question.answer?.answer as ResponseAnswerType)
            : null,
          userResponse: responseItem.response as ResponseAnswerType,
          score: response.totalScore ?? 0,
          maxScore: questionScore,
          isCorrect: responseItem.score === question.score,
        });
      }

      const emailData = {
        to: recipientEmail,
        formTitle: form.title || "Untitled Form",
        totalScore: totalScore,
        maxScore: maxScore,
        responseId: responseId,
        isAutoScored: form.type === TypeForm.Quiz,
        questions: questions,
        respondentName: response.respondentName || "Anonymous",
        submittedAt: response.createdAt,
      };

      const emailService = new EmailService();
      const success = await emailService.sendResponseResults(emailData);

      if (success) {
        const message = hasNonAutoScorableQuestions
          ? `Email sent successfully. Warning: ${nonAutoScorableWarnings.size} question(s) could not be auto-scored and require manual review.`
          : "Email sent successfully";

        res.status(200).json({
          ...ReturnCode(200, message),
        });
      } else {
        res.status(500).json(ReturnCode(500, "Failed to send email"));
      }
    } catch (error) {
      console.error("Send Response Card Email Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to send response email"));
    }
  };

  public ExportResponsePDF = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { formId, responseId } = req.params;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.sub,
        res
      );
      if (!form) return;

      const response = await FormResponse.findOne({
        _id: new Types.ObjectId(responseId),
        formId: new Types.ObjectId(formId),
      }).populate({
        path: "responseset.questionId",
        model: "Content",
      });

      if (!response) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      const pdfBuffer = await this.generateResponsePDF(form, response);

      const respondentName = getResponseDisplayName(response) || "Response";
      const filename = `${respondentName}_${form.title}_Response.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Export Response PDF Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to export response as PDF"));
    }
  };

  private async generateResponsePDF(form: any, response: any): Promise<Buffer> {
    const puppeteer = require("puppeteer");

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();

      const htmlContent = this.generateResponseHTML(form, response);

      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20px",
          right: "20px",
          bottom: "20px",
          left: "20px",
        },
      });

      return pdfBuffer;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private generateResponseHTML(form: any, response: any): string {
    const respondentName = getResponseDisplayName(response);
    const submittedAt = response.submittedAt
      ? new Date(response.submittedAt).toLocaleDateString()
      : "N/A";

    let questionsHTML = "";

    if (response.responseset && Array.isArray(response.responseset)) {
      response.responseset.forEach((responseItem: any, index: number) => {
        const question = responseItem.questionId;
        if (!question) return;

        const questionTitle = question.title?.text || `Question ${index + 1}`;
        const questionType = question.type;
        let answerHTML = "";

        switch (questionType) {
          case "text":
          case "email":
          case "number":
            answerHTML = responseItem.answer || "No answer provided";
            break;
          case "multiple":
          case "selection":
            if (Array.isArray(responseItem.answer)) {
              answerHTML = responseItem.answer.join(", ");
            } else {
              answerHTML = responseItem.answer || "No selection made";
            }
            break;
          case "checkbox":
            if (Array.isArray(responseItem.answer)) {
              answerHTML = responseItem.answer.join(", ");
            } else {
              answerHTML = "No options selected";
            }
            break;
          case "rangedate":
            if (
              responseItem.answer &&
              Array.isArray(responseItem.answer) &&
              responseItem.answer.length === 2
            ) {
              const startDate = new Date(
                responseItem.answer[0]
              ).toLocaleDateString();
              const endDate = new Date(
                responseItem.answer[1]
              ).toLocaleDateString();
              answerHTML = `${startDate} - ${endDate}`;
            } else {
              answerHTML = "No date range provided";
            }
            break;
          case "rangenumber":
            if (
              responseItem.answer &&
              Array.isArray(responseItem.answer) &&
              responseItem.answer.length === 2
            ) {
              answerHTML = `${responseItem.answer[0]} - ${responseItem.answer[1]}`;
            } else {
              answerHTML = "No number range provided";
            }
            break;
          default:
            answerHTML =
              JSON.stringify(responseItem.answer) || "No answer provided";
        }

        const score =
          responseItem.score !== undefined ? responseItem.score : "Not scored";

        questionsHTML += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="color: #333; margin-bottom: 10px; font-size: 16px;">${questionTitle}</h3>
            <p style="margin-bottom: 8px;"><strong>Type:</strong> ${questionType}</p>
            <p style="margin-bottom: 8px;"><strong>Answer:</strong> ${answerHTML}</p>
            <p style="margin-bottom: 0;"><strong>Score:</strong> ${score}</p>
          </div>
        `;
      });
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Response Export - ${form.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .form-title {
            color: #007bff;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .response-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .response-info p {
            margin: 5px 0;
          }
          .questions-section {
            margin-top: 20px;
          }
          .section-title {
            color: #007bff;
            font-size: 20px;
            margin-bottom: 20px;
            border-bottom: 1px solid #007bff;
            padding-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="form-title">${form.title}</h1>
          <p>Response Export</p>
        </div>
        
        <div class="response-info">
          <h2>Response Information</h2>
          <p><strong>Respondent:</strong> ${respondentName}</p>
          <p><strong>Email:</strong> ${
            response.respondentEmail || response.guest?.email || "N/A"
          }</p>
          <p><strong>Total Score:</strong> ${response.totalScore || 0}/${
      form.totalscore || "N/A"
    }</p>
          <p><strong>Completion Status:</strong> ${
            response.completionStatus || "partial"
          }</p>
          <p><strong>Submitted:</strong> ${submittedAt}</p>
          <p><strong>Response ID:</strong> ${response._id}</p>
        </div>

        <div class="questions-section">
          <h2 class="section-title">Responses</h2>
          ${questionsHTML || "<p>No responses found.</p>"}
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `;
  }
}

export default new FormResponseUtilityController();
