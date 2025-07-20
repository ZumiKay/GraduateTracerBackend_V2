import { Response } from "express";
import { ReturnCode } from "../utilities/helper";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
} from "../model/Response.model";
import Zod from "zod";
import { CustomRequest } from "../types/customType";
import Content from "../model/Content.model";
import { Types } from "mongoose";
import { returnscore } from "../model/Form.model";
import SolutionValidationService from "../services/SolutionValidationService";
import EmailService from "../services/EmailService";
import FormLinkService from "../services/FormLinkService";
import Form from "../model/Form.model";
import User from "../model/User.model";
import { hasFormAccess } from "./form.controller";

class FormResponseController {
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 5;

  static responseValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      responseset: Zod.array(
        Zod.object({
          questionId: Zod.string().min(1, "Question is required"),
          response: Zod.any(),
        })
      ).nonempty("Responseset cannot be empty"),
    }),
  });

  // Public form submission validation
  static publicSubmitValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      responses: Zod.array(
        Zod.object({
          questionId: Zod.string().min(1, "Question is required"),
          response: Zod.any(),
        })
      ).nonempty("Responses cannot be empty"),
      respondentEmail: Zod.string().email().optional(),
      respondentName: Zod.string().optional(),
    }),
  });

  public SubmitResponse = async (req: CustomRequest, res: Response) => {
    const submitdata = req.body as FormResponseType;

    try {
      // Validate form exists and accepts responses
      const form = await Form.findById(submitdata.formId);
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (form.setting?.acceptResponses === false) {
        return res
          .status(403)
          .json(ReturnCode(403, "Form is no longer accepting responses"));
      }

      let scoredResponses = submitdata.responseset;

      if (submitdata.returnscore === returnscore.partial) {
        scoredResponses = await Promise.all(
          submitdata.responseset.map(async (response) => {
            return await this.AddScore(
              new Types.ObjectId(response.questionId),
              response
            );
          })
        );
      }

      await FormResponse.create({
        ...submitdata,
        responseset: scoredResponses,
        userId: req.user?.id,
      });

      res.status(200).json(ReturnCode(200, "Form Submitted"));
    } catch (error) {
      console.error("Submit Response Error:", { error, body: req.body });
      res.status(500).json(ReturnCode(500, "Failed to submit the form"));
    }
  };
  public SubmitPublicResponse = async (req: CustomRequest, res: Response) => {
    const { formId, responses, respondentEmail, respondentName } = req.body;

    try {
      // Validate form exists
      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if form accepts responses
      if (form.setting?.acceptResponses === false) {
        return res
          .status(403)
          .json(ReturnCode(403, "Form is no longer accepting responses"));
      }

      // Get form questions to validate responses
      const questions = await Content.find({
        formId: new Types.ObjectId(formId),
      });

      // Validate required questions are answered
      const requiredQuestions = questions.filter((q) => q.require);
      const missingResponses = requiredQuestions.filter((q) => {
        const response = responses.find(
          (r: any) => r.questionId === q._id?.toString()
        );
        return !response || !response.response || response.response === "";
      });

      if (missingResponses.length > 0) {
        return res
          .status(400)
          .json(ReturnCode(400, "Please complete all required fields"));
      }

      // Score responses if form has scoring
      let scoredResponses = responses;
      let totalScore = 0;

      if (
        form.setting?.returnscore &&
        form.setting.returnscore !== returnscore.manual
      ) {
        scoredResponses = await Promise.all(
          responses.map(async (response: any) => {
            const scored = await this.AddScore(
              new Types.ObjectId(response.questionId),
              response
            );
            if (scored.score) {
              totalScore += scored.score;
            }
            return scored;
          })
        );
      }

      // Create response record
      const formResponse = await FormResponse.create({
        formId: new Types.ObjectId(formId),
        responseset: scoredResponses,
        totalScore,
        returnscore: form.setting?.returnscore || returnscore.manual,
        completionStatus: "completed",
        respondentEmail,
        respondentName,
        submittedAt: new Date(),
      });

      // Send email with results if it's a quiz and email is provided
      if (
        form.setting?.returnscore === returnscore.partial &&
        respondentEmail
      ) {
        try {
          // TODO: Implement email service for sending quiz results
          console.log("Would send quiz results to:", respondentEmail);
        } catch (emailError) {
          console.error("Failed to send results email:", emailError);
          // Don't fail the submission if email fails
        }
      }

      res.status(200).json(ReturnCode(200, "Form submitted successfully"));
    } catch (error) {
      console.error("Submit Public Response Error:", { error, body: req.body });
      res.status(500).json(ReturnCode(500, "Failed to submit the form"));
    }
  };

  public GetResponseByFormId = async (req: CustomRequest, res: Response) => {
    const id = req.query.id as string;
    const page = Number(req.query.p) || FormResponseController.DEFAULT_PAGE;
    const limit = Number(req.query.lt) || FormResponseController.DEFAULT_LIMIT;
    const user = req.user;

    // Check if user is authenticated
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    if (!id) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Verify form access
      const form = await Form.findById(id)
        .populate({ path: "user", select: "email" })
        .lean();

      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (!hasFormAccess(form, user.id.toString())) {
        return res.status(403).json(ReturnCode(403, "Access denied"));
      }

      const responses = await FormResponse.find({ formId: id })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).json({ ...ReturnCode(200), data: responses });
    } catch (error) {
      console.error("Get Response By FormId Error:", {
        error,
        query: req.query,
      });
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  public GetResponseByUserId = async (req: CustomRequest, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json(ReturnCode(400, "User ID is required"));
    }

    try {
      const response = await FormResponse.findOne({ userId });
      res.status(200).json({ ...ReturnCode(200), data: response });
    } catch (error) {
      console.error("Get Response By UserId Error:", {
        error,
        query: req.query,
      });
      res.status(500).json(ReturnCode(500, "Failed to retrieve response"));
    }
  };
  public GetGuestResponse = async (req: CustomRequest, res: Response) => {
    const { formId } = req.query;
    try {
      const response = await FormResponse.find({
        $and: [{ formId }, { userId: null }],
      });
      return res.status(200).json({ ...ReturnCode(200), data: response });
    } catch (error) {
      console.log("Get Guest Response", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

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

  //Add Score for the response
  public AddScore = async (qid: Types.ObjectId, response: ResponseSetType) => {
    try {
      const content = await Content.findById(qid)
        .select("answer score type")
        .lean()
        .exec();

      if (!content?.answer || !content.score) return { ...response, score: 0 };

      const calculatedScore = SolutionValidationService.calculateResponseScore(
        response.response,
        content.answer.answer,
        content.type,
        content.score
      );

      return { ...response, score: calculatedScore };
    } catch (error) {
      console.error("AddScore Error:", error);
      return { ...response, score: 0 };
    }
  };

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || !a || !b)
      return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        this.deepEqual(a[key], b[key])
    );
  }

  // Send form links via email
  public SendFormLinks = async (req: CustomRequest, res: Response) => {
    const { formId, emails, message } = req.body;
    const user = req.user;

    if (!formId || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res
        .status(400)
        .json(ReturnCode(400, "Form ID and email list are required"));
    }

    try {
      // Get form details
      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if user owns the form
      if (form.user.toString() !== user?.id?.toString()) {
        return res.status(403).json(ReturnCode(403, "Unauthorized"));
      }

      const emailService = new EmailService();
      const userDetails = await User.findById(user.id);

      const success = await emailService.sendFormLinks({
        formId,
        formTitle: form.title,
        formOwner: userDetails?.email || "Form Owner",
        recipientEmails: emails,
        message,
      });

      if (success) {
        res.status(200).json(ReturnCode(200, "Form links sent successfully"));
      } else {
        res.status(500).json(ReturnCode(500, "Failed to send form links"));
      }
    } catch (error) {
      console.error("Send Form Links Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to send form links"));
    }
  };

  // Generate form link
  public GenerateFormLink = async (req: CustomRequest, res: Response) => {
    const { formId, secure } = req.body;
    const user = req.user;

    if (!formId) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Get form details
      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if user owns the form
      if (form.user.toString() !== user?.id?.toString()) {
        return res.status(403).json(ReturnCode(403, "Unauthorized"));
      }

      const linkService = new FormLinkService();
      const link = await linkService.getValidatedFormLink(formId, secure);

      if (link) {
        res.status(200).json({ ...ReturnCode(200), data: link });
      } else {
        res.status(500).json(ReturnCode(500, "Failed to generate form link"));
      }
    } catch (error) {
      console.error("Generate Form Link Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to generate form link"));
    }
  };

  // Get form for respondent (public access)
  public GetFormForRespondent = async (req: CustomRequest, res: Response) => {
    const { formId } = req.params;
    const { token } = req.query;

    if (!formId) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Get form with contents
      const form = await Form.findById(formId).populate("contentIds");
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // If token is provided, validate it
      if (token && typeof token === "string") {
        const linkService = new FormLinkService();
        const isValidToken = await linkService.validateAccessToken(
          formId,
          token
        );
        if (!isValidToken) {
          return res.status(401).json(ReturnCode(401, "Invalid access token"));
        }
      }

      // Return form data (without answers for security)
      const formData = {
        ...form.toObject(),
        contentIds: form.contentIds?.map((content: any) => ({
          ...content.toObject(),
          answer: undefined, // Remove answer key for security
        })),
      };

      res.status(200).json({ ...ReturnCode(200), data: formData });
    } catch (error) {
      console.error("Get Form For Respondent Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve form"));
    }
  };

  // Submit form response (for respondents)
  public SubmitFormResponse = async (req: CustomRequest, res: Response) => {
    const { formId, responseset, guestEmail, guestName } = req.body;
    const user = req.user;

    if (
      !formId ||
      !responseset ||
      !Array.isArray(responseset) ||
      responseset.length === 0
    ) {
      return res
        .status(400)
        .json(ReturnCode(400, "Form ID and responses are required"));
    }

    try {
      // Get form details
      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if email is required
      if (form.requiredemail && !user && !guestEmail) {
        return res
          .status(400)
          .json(ReturnCode(400, "Email is required for this form"));
      }

      // Score responses if returnscore is partial
      let scoredResponses = responseset;
      let totalScore = 0;
      let isAutoScored = false;

      if (form.setting?.returnscore === returnscore.partial) {
        scoredResponses = await Promise.all(
          responseset.map(async (response: ResponseSetType) => {
            return await this.AddScore(
              new Types.ObjectId(response.questionId),
              response
            );
          })
        );
        isAutoScored = true;
      }

      // Calculate total score
      totalScore = scoredResponses.reduce(
        (sum: number, response: ResponseSetType) => {
          return sum + (response.score || 0);
        },
        0
      );

      // Create response
      const responseData: Partial<FormResponseType> = {
        formId: new Types.ObjectId(formId),
        responseset: scoredResponses,
        totalScore,
        isCompleted: true,
        submittedAt: new Date(),
        isAutoScored,
        returnscore: form.setting?.returnscore,
      };

      if (user) {
        responseData.userId = new Types.ObjectId(user.id);
      } else if (guestEmail) {
        responseData.guest = { email: guestEmail, name: guestName };
      }

      const savedResponse = await FormResponse.create(responseData);

      // Send results email if auto-scored
      if (isAutoScored && (user || guestEmail)) {
        const emailService = new EmailService();
        const email = guestEmail; // Use guestEmail for guest users
        if (email) {
          await emailService.sendResponseResults({
            to: email,
            formTitle: form.title,
            totalScore,
            maxScore: form.totalscore || 0,
            responseId: savedResponse._id.toString(),
            isAutoScored: true,
          });
        }
      }

      res.status(200).json({
        ...ReturnCode(200, "Form submitted successfully"),
        data: {
          responseId: savedResponse._id,
          totalScore,
          maxScore: form.totalscore || 0,
          isAutoScored,
        },
      });
    } catch (error) {
      console.error("Submit Form Response Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to submit form"));
    }
  };

  // Get responses with filtering and pagination
  public GetResponsesWithFilters = async (
    req: CustomRequest,
    res: Response
  ) => {
    const {
      formId,
      email,
      startDate,
      endDate,
      minScore,
      maxScore,
      sortBy,
      sortOrder,
    } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const user = req.user;

    // Check if user is authenticated
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    if (!formId) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Verify form access (including collaborators)
      const form = await Form.findById(formId)
        .populate({ path: "user", select: "email" })
        .lean();

      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (!hasFormAccess(form, user.id.toString())) {
        return res.status(403).json(ReturnCode(403, "Access denied"));
      }

      // Build query
      const query: any = { formId };

      // Filter by email
      if (email) {
        query.$or = [
          { "guest.email": { $regex: email, $options: "i" } },
          { userId: { $exists: true } }, // Will need to populate user data
        ];
      }

      // Filter by date range
      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) query.submittedAt.$gte = new Date(startDate as string);
        if (endDate) query.submittedAt.$lte = new Date(endDate as string);
      }

      // Filter by score range
      if (minScore !== undefined || maxScore !== undefined) {
        query.totalScore = {};
        if (minScore !== undefined) query.totalScore.$gte = Number(minScore);
        if (maxScore !== undefined) query.totalScore.$lte = Number(maxScore);
      }

      // Build sort options
      const sortOptions: any = {};
      if (sortBy) {
        sortOptions[sortBy as string] = sortOrder === "desc" ? -1 : 1;
      } else {
        sortOptions.submittedAt = -1; // Default sort by newest
      }

      // Execute query
      const responses = await FormResponse.find(query)
        .populate("userId", "name email")
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit);

      const totalCount = await FormResponse.countDocuments(query);

      res.status(200).json({
        ...ReturnCode(200),
        data: {
          responses,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get Responses With Filters Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  // Manual scoring for responses
  public UpdateResponseScore = async (req: CustomRequest, res: Response) => {
    const { responseId, scores, sendEmail } = req.body;
    const user = req.user;

    if (!responseId || !scores || !Array.isArray(scores)) {
      return res
        .status(400)
        .json(ReturnCode(400, "Response ID and scores are required"));
    }

    try {
      // Get response
      const response = await FormResponse.findById(responseId).populate(
        "formId"
      );
      if (!response) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      // Check form ownership
      const form = response.formId as any;
      if (form.user.toString() !== user?.id?.toString()) {
        return res.status(403).json(ReturnCode(403, "Unauthorized"));
      }

      // Update scores
      const updatedResponseSet = response.responseset.map((responseItem) => {
        const scoreUpdate = scores.find(
          (s: any) => s.questionId === responseItem.questionId.toString()
        );
        if (scoreUpdate) {
          return {
            ...responseItem,
            score: scoreUpdate.score,
            isManuallyScored: true,
          };
        }
        return responseItem;
      });

      // Calculate new total score
      const totalScore = updatedResponseSet.reduce(
        (sum, item) => sum + (item.score || 0),
        0
      );

      // Update response
      await FormResponse.findByIdAndUpdate(responseId, {
        responseset: updatedResponseSet,
        totalScore,
        isAutoScored: false,
      });

      // Send email if requested
      if (sendEmail) {
        const emailService = new EmailService();
        let recipientEmail = "";

        if (response.userId) {
          const userDetails = await User.findById(response.userId);
          recipientEmail = userDetails?.email || "";
        } else if (response.guest?.email) {
          recipientEmail = response.guest.email;
        }

        if (recipientEmail) {
          await emailService.sendResponseResults({
            to: recipientEmail,
            formTitle: form.title,
            totalScore,
            maxScore: form.totalscore || 0,
            responseId: responseId,
            isAutoScored: false,
          });
        }
      }

      res.status(200).json(ReturnCode(200, "Scores updated successfully"));
    } catch (error) {
      console.error("Update Response Score Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to update scores"));
    }
  };

  // Get response analytics for charts
  public GetResponseAnalytics = async (req: CustomRequest, res: Response) => {
    const { formId } = req.query;
    const user = req.user;

    // Check if user is authenticated
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    if (!formId) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Verify form access (including collaborators)
      const form = await Form.findById(formId)
        .populate("contentIds")
        .populate({ path: "user", select: "email" })
        .lean();

      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      if (!hasFormAccess(form, user.id.toString())) {
        return res.status(403).json(ReturnCode(403, "Access denied"));
      }

      // Get all responses
      const responses = await FormResponse.find({ formId });

      // Analyze each question
      const analytics: any = {};

      if (form.contentIds && Array.isArray(form.contentIds)) {
        for (const content of form.contentIds) {
          const contentObj = content as any;
          const questionId = contentObj._id.toString();

          // Get all responses for this question
          const questionResponses = responses
            .map((response) =>
              response.responseset.find(
                (r) => r.questionId.toString() === questionId
              )
            )
            .filter(Boolean);

          // Analyze based on question type
          if (["multiple", "checkbox", "selection"].includes(contentObj.type)) {
            // For multiple choice, checkbox, and selection questions
            const answerCounts: { [key: string]: number } = {};

            questionResponses.forEach((response) => {
              if (response) {
                if (Array.isArray(response.response)) {
                  response.response.forEach((answer: any) => {
                    const key = answer.toString();
                    answerCounts[key] = (answerCounts[key] || 0) + 1;
                  });
                } else {
                  const key = response.response.toString();
                  answerCounts[key] = (answerCounts[key] || 0) + 1;
                }
              }
            });

            analytics[questionId] = {
              type: contentObj.type,
              title: contentObj.title,
              totalResponses: questionResponses.length,
              answerCounts,
              chartData: Object.entries(answerCounts).map(
                ([answer, count]) => ({
                  answer,
                  count,
                  percentage: (
                    ((count as number) / questionResponses.length) *
                    100
                  ).toFixed(1),
                })
              ),
            };
          } else if (["rangedate", "rangenumber"].includes(contentObj.type)) {
            // For range questions
            const ranges = questionResponses
              .map((response) => response?.response)
              .filter(Boolean);
            analytics[questionId] = {
              type: contentObj.type,
              title: contentObj.title,
              totalResponses: questionResponses.length,
              ranges,
              // Could add more range-specific analytics here
            };
          }
        }
      }

      res.status(200).json({ ...ReturnCode(200), data: analytics });
    } catch (error) {
      console.error("Get Response Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  // Get public form data (for displaying form to respondents)
  public GetPublicFormData = async (req: CustomRequest, res: Response) => {
    const { formId } = req.params;
    const { token } = req.query;

    if (!formId) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      // Get form with contents
      const form = await Form.findById(formId).populate("contentIds");
      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // If token is provided, validate it
      if (token && typeof token === "string") {
        const linkService = new FormLinkService();
        const isValidToken = await linkService.validateAccessToken(
          formId,
          token
        );
        if (!isValidToken) {
          return res.status(401).json(ReturnCode(401, "Invalid access token"));
        }
      }

      // Return form data (without answers for security)
      const formData = {
        ...form.toObject(),
        contentIds: form.contentIds?.map((content: any) => ({
          ...content.toObject(),
          answer: undefined, // Remove answer key for security
        })),
      };

      res.status(200).json({ ...ReturnCode(200), data: formData });
    } catch (error) {
      console.error("Get Public Form Data Error:", {
        error,
        params: req.params,
      });
      res.status(500).json(ReturnCode(500, "Failed to retrieve form data"));
    }
  };

  // Get analytics data for a form
  public GetFormAnalytics = async (req: CustomRequest, res: Response) => {
    const { formId } = req.params;
    const { period = "7d" } = req.query;
    const user = req.user;

    // Check if user is authenticated
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    try {
      const form = await Form.findById(formId)
        .populate({ path: "user", select: "email" })
        .lean();

      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if user has access to this form
      if (!hasFormAccess(form, user.id.toString())) {
        return res.status(403).json(ReturnCode(403, "Access denied"));
      }

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      // Get responses within the date range
      const responses = await FormResponse.find({
        formId: new Types.ObjectId(formId),
        createdAt: { $gte: startDate },
      }).sort({ createdAt: -1 });

      // Get form questions
      const questions = await Content.find({
        formId: new Types.ObjectId(formId),
      });

      // Calculate basic metrics
      const totalResponses = responses.length;
      const completedResponses = responses.filter(
        (r) => r.completionStatus === "completed"
      ).length;
      const averageScore =
        responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
          totalResponses || 0;
      const responseRate =
        totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;

      // Calculate average completion time (mock data for now)
      const averageCompletionTime = 8; // minutes

      // Generate question analytics
      const questionAnalytics = await Promise.all(
        questions.map(async (question) => {
          const questionResponses = responses.filter((r) =>
            r.responseset.some(
              (rs) => rs.questionId.toString() === question._id?.toString()
            )
          );

          const questionResponsesData = questionResponses
            .map((r) =>
              r.responseset.find(
                (rs) => rs.questionId.toString() === question._id?.toString()
              )
            )
            .filter(Boolean);

          const correctResponses = questionResponsesData.filter(
            (r) => r?.score && r.score > 0
          ).length;
          const accuracy =
            questionResponsesData.length > 0
              ? (correctResponses / questionResponsesData.length) * 100
              : 0;
          const avgScore =
            questionResponsesData.reduce((sum, r) => sum + (r?.score || 0), 0) /
              questionResponsesData.length || 0;

          // Generate response distribution
          const responseDistribution = this.generateResponseDistribution(
            questionResponsesData,
            question
          );

          return {
            questionId: question._id?.toString() || "",
            questionTitle:
              typeof question.title === "string" ? question.title : "Question",
            questionType: question.type,
            totalResponses: questionResponsesData.length,
            correctResponses,
            accuracy,
            averageScore: avgScore,
            responseDistribution,
            commonAnswers: responseDistribution
              .map((r: any) => r.option)
              .slice(0, 5),
          };
        })
      );

      // Generate score distribution
      const scoreDistribution = this.generateScoreDistribution(
        responses,
        form.totalscore || 100
      );

      // Generate time series data
      const timeSeriesData = this.generateTimeSeriesData(
        responses,
        startDate,
        now
      );

      // Generate performance metrics
      const performanceMetrics = this.generatePerformanceMetrics(
        responses,
        questions
      );

      const analyticsData = {
        totalResponses,
        completedResponses,
        averageScore,
        averageCompletionTime,
        responseRate,
        questionAnalytics,
        scoreDistribution,
        timeSeriesData,
        performanceMetrics,
      };

      res.status(200).json({
        ...ReturnCode(200),
        data: analyticsData,
      });
    } catch (error) {
      console.error("Get Form Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  // Export analytics as PDF or CSV
  public ExportAnalytics = async (req: CustomRequest, res: Response) => {
    const { formId } = req.params;
    const { format = "pdf" } = req.query;
    const user = req.user;

    // Check if user is authenticated
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    try {
      const form = await Form.findById(formId)
        .populate({ path: "user", select: "email" })
        .lean();

      if (!form) {
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      // Check if user has access to this form
      if (!hasFormAccess(form, user.id.toString())) {
        return res.status(403).json(ReturnCode(403, "Access denied"));
      }

      // Get analytics data (reuse the analytics logic)
      const responses = await FormResponse.find({
        formId: new Types.ObjectId(formId),
      });
      const questions = await Content.find({
        formId: new Types.ObjectId(formId),
      });

      const analyticsData = {
        totalResponses: responses.length,
        completedResponses: responses.filter(
          (r) => r.completionStatus === "completed"
        ).length,
        averageScore:
          responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
            responses.length || 0,
        responseRate:
          responses.length > 0
            ? (responses.filter((r) => r.completionStatus === "completed")
                .length /
                responses.length) *
              100
            : 0,
        questionAnalytics: await Promise.all(
          questions.map(async (question) => {
            const questionResponses = responses.filter((r) =>
              r.responseset.some(
                (rs) => rs.questionId.toString() === question._id?.toString()
              )
            );
            const questionResponsesData = questionResponses
              .map((r) =>
                r.responseset.find(
                  (rs) => rs.questionId.toString() === question._id?.toString()
                )
              )
              .filter(Boolean);
            const correctResponses = questionResponsesData.filter(
              (r) => r?.score && r.score > 0
            ).length;
            const accuracy =
              questionResponsesData.length > 0
                ? (correctResponses / questionResponsesData.length) * 100
                : 0;
            const avgScore =
              questionResponsesData.reduce(
                (sum, r) => sum + (r?.score || 0),
                0
              ) / questionResponsesData.length || 0;

            return {
              questionTitle:
                typeof question.title === "string"
                  ? question.title
                  : "Question",
              questionType: question.type,
              totalResponses: questionResponsesData.length,
              accuracy,
              averageScore: avgScore,
            };
          })
        ),
        scoreDistribution: this.generateScoreDistribution(
          responses,
          form.totalscore || 100
        ),
        performanceMetrics: this.generatePerformanceMetrics(
          responses,
          questions
        ),
      };

      if (format === "pdf") {
        const PDFExportService =
          require("../services/PDFExportService").default;
        const pdfBuffer = await PDFExportService.generateAnalyticsPDF(
          analyticsData,
          form.title
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${form.title}-analytics.pdf"`
        );
        res.send(pdfBuffer);
      } else if (format === "csv") {
        const csvData = this.generateCSVData(analyticsData, responses);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${form.title}-analytics.csv"`
        );
        res.send(csvData);
      } else {
        res.status(400).json(ReturnCode(400, "Invalid export format"));
      }
    } catch (error) {
      console.error("Export Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to export analytics"));
    }
  };

  // Helper method to generate CSV data
  private generateCSVData(analyticsData: any, responses: any[]): string {
    const headers = [
      "Response ID",
      "Respondent Name",
      "Respondent Email",
      "Total Score",
      "Completion Status",
      "Submitted At",
    ];
    const csvRows = [headers.join(",")];

    responses.forEach((response) => {
      const row = [
        response._id,
        response.respondentName || "N/A",
        response.respondentEmail || "N/A",
        response.totalScore || 0,
        response.completionStatus || "partial",
        response.submittedAt
          ? new Date(response.submittedAt).toISOString()
          : "N/A",
      ];
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }

  // Helper method to generate response distribution
  private generateResponseDistribution(responses: any[], question: any) {
    const distribution: { [key: string]: number } = {};

    responses.forEach((response) => {
      if (response?.response) {
        const answer = Array.isArray(response.response)
          ? response.response.join(", ")
          : response.response.toString();
        distribution[answer] = (distribution[answer] || 0) + 1;
      }
    });

    return Object.entries(distribution)
      .map(([option, count]) => ({
        option,
        count,
        percentage: (count / responses.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Helper method to generate score distribution
  private generateScoreDistribution(responses: any[], maxScore: number) {
    const ranges = [
      { min: 0, max: 0.2 * maxScore, label: "0-20%" },
      { min: 0.2 * maxScore, max: 0.4 * maxScore, label: "21-40%" },
      { min: 0.4 * maxScore, max: 0.6 * maxScore, label: "41-60%" },
      { min: 0.6 * maxScore, max: 0.8 * maxScore, label: "61-80%" },
      { min: 0.8 * maxScore, max: maxScore, label: "81-100%" },
    ];

    return ranges.map((range) => {
      const count = responses.filter(
        (r) =>
          (r.totalScore || 0) >= range.min && (r.totalScore || 0) <= range.max
      ).length;

      return {
        scoreRange: range.label,
        count,
        percentage: responses.length > 0 ? (count / responses.length) * 100 : 0,
      };
    });
  }

  // Helper method to generate time series data
  private generateTimeSeriesData(
    responses: any[],
    startDate: Date,
    endDate: Date
  ) {
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const data = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      );

      const dayResponses = responses.filter(
        (r) => r.createdAt >= dayStart && r.createdAt < dayEnd
      );

      const avgScore =
        dayResponses.length > 0
          ? dayResponses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
            dayResponses.length
          : 0;

      data.push({
        date: date.toISOString().split("T")[0],
        responses: dayResponses.length,
        averageScore: avgScore,
      });
    }

    return data;
  }

  // Helper method to generate performance metrics
  private generatePerformanceMetrics(responses: any[], questions: any[]) {
    // Top performers
    const topPerformers = responses
      .filter((r) => r.respondentName && r.respondentEmail)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 5)
      .map((r) => ({
        name: r.respondentName,
        email: r.respondentEmail,
        score: r.totalScore || 0,
        completionTime: 8, // Mock completion time
      }));

    // Difficult questions (lowest accuracy)
    const difficultQuestions = questions
      .map((q) => {
        const questionResponses = responses.filter((r) =>
          r.responseset.some(
            (rs: any) => rs.questionId.toString() === q._id?.toString()
          )
        );

        const correctCount = questionResponses.filter((r) => {
          const questionResponse = r.responseset.find(
            (rs: any) => rs.questionId.toString() === q._id?.toString()
          );
          return (
            questionResponse &&
            questionResponse.score &&
            questionResponse.score > 0
          );
        }).length;

        const accuracy =
          questionResponses.length > 0
            ? (correctCount / questionResponses.length) * 100
            : 0;
        const avgScore =
          questionResponses.reduce((sum, r) => {
            const questionResponse = r.responseset.find(
              (rs: any) => rs.questionId.toString() === q._id?.toString()
            );
            return sum + (questionResponse?.score || 0);
          }, 0) / questionResponses.length || 0;

        return {
          questionId: q._id?.toString() || "",
          title: typeof q.title === "string" ? q.title : "Question",
          accuracy,
          averageScore: avgScore,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return {
      topPerformers,
      difficultQuestions,
    };
  }

  // Get all responses by current user
  public GetUserResponses = async (req: CustomRequest, res: Response) => {
    const user = req.user;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (!user) {
      return res.status(401).json(ReturnCode(401, "User not authenticated"));
    }

    try {
      const skip = (page - 1) * limit;

      // Get all responses by the user with form details
      const responses = await FormResponse.find({
        userId: new Types.ObjectId(user.id),
      })
        .populate({
          path: "formId",
          select: "title type setting user createdAt",
        })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalCount = await FormResponse.countDocuments({
        userId: new Types.ObjectId(user.id),
      });

      const formattedResponses = responses.map((response) => {
        const form = response.formId as any;
        return {
          _id: response._id,
          formId: form?._id || response.formId,
          formTitle: form?.title || "Unknown Form",
          formType: form?.type || "Unknown",
          totalScore: response.totalScore,
          maxScore: form?.totalscore || 0,
          isCompleted: response.isCompleted,
          submittedAt: response.submittedAt,
          createdAt: response.createdAt,
          responseCount: response.responseset?.length || 0,
          isAutoScored: response.isAutoScored,
          formCreatedAt: form?.createdAt,
        };
      });

      res.status(200).json({
        ...ReturnCode(200),
        data: {
          responses: formattedResponses,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Get User Responses Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve user responses"));
    }
  };
}

export default new FormResponseController();
export { FormResponseController };
