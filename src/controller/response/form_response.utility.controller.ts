import { Response } from "express";
import { contentTitleToString, ReturnCode } from "../../utilities/helper";
import SolutionValidationService from "../../services/SolutionValidationService";
import EmailService from "../../services/EmailService";
import FormLinkService from "../../services/FormLinkService";
import User from "../../model/User.model";
import { Types } from "mongoose";
import Form, {
  CollaboratorType,
  FormType,
  TypeForm,
} from "../../model/Form.model";
import FormResponse, {
  FormResponseType,
  ResponseAnswerType,
} from "../../model/Response.model";
import { ContentType, QuestionType } from "../../model/Content.model";
import { ResponseValidationService } from "../../services/ResponseValidationService";
import { hasFormAccess, verifyRole } from "../../utilities/formHelpers";
import { getResponseDisplayName } from "../../utilities/respondentUtils";
import { CustomRequest } from "../../types/customType";
import { generateResponseHTML } from "../../utilities/EmailTemplate/SendResponseEmail";

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

      const form = await Form.findById(formId).select(
        "_id user owners editors"
      );
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }
      const hasAccess = hasFormAccess(form, new Types.ObjectId(req.user.sub));

      if (!hasFormAccess(form, new Types.ObjectId(req.user.sub))) {
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
      const { responseId, recipientEmail, includeAnswerKey = true } = req.body;
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

      const isQuizForm = form.type === TypeForm.Quiz;
      const questions: Array<{
        title: string;
        type: string;
        qIdx: number;
        answer: ResponseAnswerType | null;
        userResponse: ResponseAnswerType;
        score: number;
        maxScore: number;
        isCorrect?: boolean;
        choices?: Array<{ content: string; idx: number; isCorrect?: boolean }>;
      }> = [];

      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      let incorrectCount = 0;

      for (const responseItem of response.responseset) {
        const question = responseItem.question as ContentType;
        if (!question) continue;

        const questionType = question.type as QuestionType;
        const hasAnswerKey =
          question.answer &&
          SolutionValidationService.isAnswerisempty(question.answer.answer);
        const questionMaxScore = question.score || 0;
        const questionScore = responseItem.score || 0;

        maxScore += questionMaxScore;
        totalScore += questionScore;

        const isCorrect =
          questionScore === questionMaxScore && questionMaxScore > 0;
        if (isCorrect) correctCount++;
        else if (questionMaxScore > 0) incorrectCount++;

        // Extract choices for choice-type questions
        let choices:
          | Array<{ content: string; idx: number; isCorrect?: boolean }>
          | undefined;
        if (questionType === QuestionType.MultipleChoice && question.multiple) {
          choices = question.multiple.map((opt) => ({
            content: opt.content,
            idx: opt.idx,
            isCorrect:
              hasAnswerKey && Array.isArray(question.answer?.answer)
                ? (question.answer.answer as number[]).includes(opt.idx)
                : question.answer?.answer === opt.idx,
          }));
        } else if (
          questionType === QuestionType.CheckBox &&
          question.checkbox
        ) {
          choices = question.checkbox.map((opt) => ({
            content: opt.content,
            idx: opt.idx,
            isCorrect:
              hasAnswerKey && Array.isArray(question.answer?.answer)
                ? (question.answer.answer as number[]).includes(opt.idx)
                : false,
          }));
        } else if (
          questionType === QuestionType.Selection &&
          question.selection
        ) {
          choices = question.selection.map((opt) => ({
            content: opt.content,
            idx: opt.idx,
            isCorrect: hasAnswerKey && question.answer?.answer === opt.idx,
          }));
        }

        questions.push({
          title: contentTitleToString(question.title),
          type: questionType,
          qIdx: question.qIdx,
          answer:
            hasAnswerKey && includeAnswerKey
              ? (question.answer?.answer as ResponseAnswerType)
              : null,
          userResponse: responseItem.response as ResponseAnswerType,
          score: questionScore,
          maxScore: questionMaxScore,
          isCorrect,
          choices,
        });
      }

      const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      // Only count questions that have a score (maxScore > 0) for totalQuestions
      const scorableQuestionsCount = questions.filter(
        (q) => q.maxScore > 0
      ).length;

      const emailData = {
        to: recipientEmail,
        formTitle: form.title || "Untitled Form",
        formDescription: form.description
          ? contentTitleToString(form.description)
          : undefined,
        totalScore,
        maxScore,
        scorePercentage,
        correctCount,
        incorrectCount,
        totalQuestions: scorableQuestionsCount,
        responseId,
        isQuizForm,
        includeAnswerKey,
        questions,
        respondentName: response.respondentName || "Anonymous",
        respondentEmail: response.respondentEmail,
        submittedAt: response.createdAt,
        completionStatus: response.completionStatus,
      };

      const emailService = new EmailService();
      const success = await emailService.sendResponseCardEmail(emailData);

      if (success) {
        return res.status(200).json({
          ...ReturnCode(200, "Response card email sent successfully"),
          data: {
            sentTo: recipientEmail,
            totalScore,
            maxScore,
            scorePercentage: scorePercentage.toFixed(1),
          },
        });
      } else {
        return res.status(500).json(ReturnCode(500, "Failed to send email"));
      }
    } catch (error) {
      console.error("Send Response Card Email Error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Failed to send response email"));
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

  private async generateResponsePDF(
    form: FormType,
    response: FormResponseType
  ): Promise<Buffer> {
    const puppeteer = require("puppeteer");

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();

      const htmlContent = generateResponseHTML(form, response);

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
}

export default new FormResponseUtilityController();
