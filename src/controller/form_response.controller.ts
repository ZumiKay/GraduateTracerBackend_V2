import { Response } from "express";
import { contentTitleToString, ReturnCode } from "../utilities/helper";
import { MongoErrorHandler } from "../utilities/MongoErrorHandler";
import Zod from "zod";
import { Types } from "mongoose";
import { CustomRequest } from "../types/customType";
import SolutionValidationService from "../services/SolutionValidationService";
import EmailService from "../services/EmailService";
import FormLinkService from "../services/FormLinkService";
import User from "../model/User.model";
import { ResponseValidationService } from "../services/ResponseValidationService";
import { ResponseQueryService } from "../services/ResponseQueryService";
import { ResponseProcessingService } from "../services/ResponseProcessingService";
import { ResponseAnalyticsService } from "../services/ResponseAnalyticsService";
import { RespondentTrackingService } from "../services/RespondentTrackingService";
import { getResponseDisplayName } from "../utilities/respondentUtils";
import Form, {
  CollaboratorType,
  FormType,
  TypeForm,
} from "../model/Form.model";
import Content, { ContentType, QuestionType } from "../model/Content.model";
import FormResponse, { ResponseAnswerType } from "../model/Response.model";
import {
  ResponseSetType,
  SubmitionProcessionReturnType,
} from "../model/Response.model";
import { hasFormAccess, verifyRole } from "../utilities/formHelpers";
import Formsession from "../model/Formsession.model";
import {
  GetPublicFormDataType,
  GetPublicFormDataTyEnum,
} from "../middleware/User.middleware";

interface SubmitResponseBodyType {
  formInfo?: Pick<FormType, "_id" | "type">;
  responseSet?: Array<ResponseSetType>;
  respondentEmail?: string;
  respondentName?: string;
}

class FormResponseController {
  // Public form submission validation
  static publicSubmitValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      respondentEmail: Zod.string().email().optional(),
      respondentName: Zod.string().optional(),
    }),
  });

  // Send response card email validation
  static sendResponseCardEmailValidate = Zod.object({
    body: Zod.object({
      responseId: Zod.string().min(1, "Response ID is required"),
      recipientEmail: Zod.string().email("Valid email is required"),
    }),
  });

  public GetResponseByFormId = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user.id,
        res
      );
      if (!form) return;

      const result = await ResponseQueryService.getResponsesByFormId(
        validation.formId!,
        validation.page!,
        validation.limit!
      );

      res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get Response By FormId Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  public GetResponseByUser = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid) return;

      const { respondentEmail, formId } = req.query;
      if (!respondentEmail || !formId) {
        return res.status(400).json(ReturnCode(400));
      }

      const form = await ResponseValidationService.validateFormAccess(
        formId as string,
        validation.user.id,
        res
      );
      if (!form) return;

      let populatedResponse = await FormResponse.findOne({
        $and: [
          {
            formId,
          },
          {
            respondentEmail,
          },
        ],
      })
        .select(
          "_id responseset totalScore isCompleted completionStatus respondentEmail respondentName respondentType submittedAt"
        )
        .lean();

      //Populate response set question
      const responseContent = await Content.find({
        _id: { $in: populatedResponse?.responseset.map((i) => i.question) },
      }).lean();

      populatedResponse = {
        ...populatedResponse,
        responseset: populatedResponse?.responseset.map((res) => {
          return {
            ...res,
            question: responseContent.find((q) => q._id === res.question),
          };
        }) as never,
      } as never;

      if (!populatedResponse) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      res.status(200).json({ ...ReturnCode(200), data: populatedResponse });
    } catch (error) {
      console.error("Get Response By UserId Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve response"));
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

  // Send form links via email
  public SendFormLinks = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: true,
      });
      if (!validation.isValid) return;

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

      if (form.user.toString() !== validation.user.id?.toString()) {
        return res.status(403).json(ReturnCode(403, "Unauthorized"));
      }

      const emailService = new EmailService();
      const userDetails = await User.findById(validation.user.id);

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

  // Generate form link
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
        !verifyRole(CollaboratorType.creator, form, req.user.id) &&
        !verifyRole(CollaboratorType.owner, form, req.user.id)
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

  public GetFormForRespondent = async (req: CustomRequest, res: Response) => {
    return this.GetPublicFormData(req, res);
  };

  // Submit respondent response
  public SubmitFormResponse = async (req: CustomRequest, res: Response) => {
    const submissionId = `submission_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    try {
      const validationResult = this.validateSubmissionInput(req.body);
      if (!validationResult.isValid) {
        console.warn(
          `[${submissionId}] Input validation failed:`,
          validationResult.errors
        );
        return res.status(400).json({
          ...ReturnCode(400, validationResult.message),
          validationErrors: validationResult.errors,
          submissionId,
        });
      }

      const { formInfo, responseSet, respondentEmail, respondentName } =
        req.body as SubmitResponseBodyType;

      let form;
      try {
        form = await Form.findById(formInfo!._id)
          .select("setting type title")
          .lean();
      } catch (dbError) {
        const errorHandled = MongoErrorHandler.handleMongoError(dbError, res, {
          operationId: submissionId,
          customMessage: "Failed to retrieve form information",
          includeErrorDetails: true,
        });

        if (errorHandled.handled) {
          return;
        }

        console.error(
          `[${submissionId}] Unexpected error retrieving form:`,
          dbError
        );
        return res.status(500).json({
          ...ReturnCode(500, "Database error occurred while retrieving form"),
          submissionId,
          formId: formInfo!._id,
        });
      }

      if (!form) {
        console.warn(`[${submissionId}] Form not found:`, formInfo!._id);
        return res.status(404).json(ReturnCode(404));
      }

      if (form.setting?.submitonce && form.type === TypeForm.Normal) {
        try {
          const trackingResult =
            await RespondentTrackingService.checkRespondentExists(
              formInfo!._id.toString(),
              req,
              FormResponse
            );

          if (trackingResult.hasResponded) {
            console.info(`[${submissionId}] Duplicate submission detected:`, {
              formId: formInfo!._id,
              trackingMethod: trackingResult.trackingMethod,
              responseId: trackingResult.responseId,
            });

            return res.status(409).json({
              code: 409,
              message: "Duplicate submission detected",
              details: `You have already submitted a response to this form`,
              trackingMethod: trackingResult.trackingMethod,
              previousResponseId: trackingResult.responseId,
              submissionId,
              formTitle: form.title,
            });
          }
        } catch (trackingError) {
          console.error(
            `[${submissionId}] Error during duplicate check:`,
            trackingError
          );
        }
      }

      let submissionDataWithTracking;
      try {
        const baseSubmissionData = {
          formId: formInfo!._id.toString(),
          responseset: responseSet,
          respondentEmail,
          respondentName,
        };

        submissionDataWithTracking =
          RespondentTrackingService.createSubmissionWithTracking(
            baseSubmissionData,
            req
          );
      } catch (trackingError) {
        console.error(
          `[${submissionId}] Error creating tracking data:`,
          trackingError
        );
        return res.status(500).json({
          ...ReturnCode(500, "Failed to prepare submission data"),
          submissionId,
          error:
            trackingError instanceof Error
              ? trackingError.message
              : "Unknown tracking error",
        });
      }

      //Form submittion process
      let result: Partial<SubmitionProcessionReturnType | undefined>;
      try {
        if (formInfo!.type === TypeForm.Quiz) {
          //Quiz type submission handler
          result = await ResponseProcessingService.processFormSubmission(
            submissionDataWithTracking
          );
        } else {
          //Normal type submission handler
          result = await ResponseProcessingService.processNormalFormSubmission(
            submissionDataWithTracking
          );
        }
      } catch (processingError) {
        console.error(
          `[${submissionId}] Error during form processing:`,
          processingError
        );

        if (processingError instanceof Error) {
          const errorResponse = this.handleProcessingError(
            processingError,
            submissionId
          );
          if (errorResponse) {
            return res.status(errorResponse.status).json(errorResponse.body);
          }
        }

        return res.status(500).json({
          ...ReturnCode(500, "Failed to process form submission"),
          submissionId,
          error:
            processingError instanceof Error
              ? processingError.message
              : "Unknown processing error",
        });
      }

      //Delete user session if form is single response
      if (form.setting?.submitonce && req.formsession) {
        await Formsession.deleteOne({ session_id: req.formsession });
      }

      return res.status(200).json({
        ...ReturnCode(200, "Form submitted successfully"),
        data: result,
        submissionId,
        meta: {
          formId: formInfo!._id,
          formType: formInfo!.type,
          submittedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        `[${submissionId}] Unexpected error in SubmitFormResponse:`,
        {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : error,
          requestBody: req.body,
          userAgent: req.headers["user-agent"],
          ip: req.ip,
        }
      );

      if (error instanceof Error) {
        // Handle MongoDB/Database errors first
        const mongoErrorHandled = MongoErrorHandler.handleMongoError(
          error,
          res,
          {
            operationId: submissionId,
            customMessage: "Database operation failed during form submission",
            includeErrorDetails: true,
          }
        );

        if (mongoErrorHandled.handled) {
          return;
        }

        // Handle validation errors
        if (error.name === "ValidationError" || error.name === "CastError") {
          return res.status(400).json({
            ...ReturnCode(400, "Invalid data provided"),
            submissionId,
            error: error.message,
          });
        }

        // Handle timeout errors
        if (
          error.message.includes("timeout") ||
          error.name === "TimeoutError"
        ) {
          return res.status(408).json({
            code: 408,
            message: "Request timeout - please try again",
            submissionId,
          });
        }
      }

      return res.status(500).json({
        ...ReturnCode(
          500,
          "An unexpected error occurred during form submission"
        ),
        submissionId,
        timestamp: new Date().toISOString(),
        supportMessage:
          "Please contact support with the submission ID if this problem persists",
      });
    }
  };

  private validateSubmissionInput(body: SubmitResponseBodyType): {
    isValid: boolean;
    message: string;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!body) {
      return {
        isValid: false,
        message: "Request body is required",
        errors: ["Request body is missing"],
      };
    }

    const { formInfo, responseSet, respondentEmail, respondentName } = body;

    if (!formInfo) {
      errors.push("Form information is required");
    } else {
      if (!formInfo._id) {
        errors.push("Form ID is required");
      }
      if (!formInfo.type) {
        errors.push("Form type is required");
      } else if (!Object.values(TypeForm).includes(formInfo.type)) {
        errors.push(
          `Invalid form type: ${formInfo.type}. Must be one of: ${Object.values(
            TypeForm
          ).join(", ")}`
        );
      }
    }

    if (!responseSet) {
      errors.push("Response set is required");
    } else if (!Array.isArray(responseSet)) {
      errors.push("Response set must be an array");
    } else if (responseSet.length === 0) {
      errors.push("At least one response is required");
    } else {
      responseSet.forEach((response, index) => {
        if (!response.question) {
          errors.push(`Response ${index + 1}: Question ID is required`);
        }
        if (response.response === undefined || response.response === null) {
          errors.push(`Response ${index + 1}: Answer is required`);
        }
      });
    }

    if (respondentEmail && typeof respondentEmail === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(respondentEmail)) {
        errors.push("Invalid email format");
      }
    }

    if (
      respondentName &&
      (typeof respondentName !== "string" || respondentName.trim().length === 0)
    ) {
      errors.push("Respondent name must be a non-empty string if provided");
    }

    return {
      isValid: errors.length === 0,
      message: errors.length > 0 ? "Validation failed" : "Validation passed",
      errors,
    };
  }

  private handleProcessingError(
    error: Error,
    submissionId: string
  ): {
    status: number;
    body: any;
  } | null {
    const errorMessage = error.message.toLowerCase();

    // Required field errors
    if (error.message === "Require" || errorMessage.includes("required")) {
      return {
        status: 400,
        body: {
          ...ReturnCode(400, "Missing required questions"),
          submissionId,
          error: "Please ensure all required questions are answered",
        },
      };
    }

    // Format errors
    if (
      error.message === "Format" ||
      errorMessage.includes("format") ||
      errorMessage.includes("invalid answer")
    ) {
      return {
        status: 400,
        body: {
          ...ReturnCode(400, "Invalid answer format"),
          submissionId,
          error: "One or more answers are in an invalid format",
        },
      };
    }

    // Question not found errors
    if (errorMessage.includes("question not found")) {
      return {
        status: 404,
        body: {
          ...ReturnCode(404, "Question not found"),
          submissionId,
          error: "One or more questions in your response could not be found",
        },
      };
    }

    // Form not found errors
    if (
      error.message === "Form not found" ||
      errorMessage.includes("form not found")
    ) {
      return {
        status: 404,
        body: {
          ...ReturnCode(404, "Form not found"),
          submissionId,
          error: error.message,
        },
      };
    }

    // Email requirement errors
    if (
      error.message === "Email is required for this form" ||
      errorMessage.includes("email is required")
    ) {
      return {
        status: 400,
        body: {
          ...ReturnCode(400, "Email is required"),
          submissionId,
          error: "This form requires an email address to submit",
        },
      };
    }

    // Duplicate submission errors
    if (
      error.message === "Form already exisited" ||
      errorMessage.includes("already submitted") ||
      errorMessage.includes("duplicate")
    ) {
      return {
        status: 409,
        body: {
          code: 409,
          message: "Duplicate submission",
          submissionId,
          error: "You have already submitted a response to this form",
        },
      };
    }

    // Form access errors
    if (
      errorMessage.includes("access denied") ||
      errorMessage.includes("unauthorized")
    ) {
      return {
        status: 403,
        body: {
          ...ReturnCode(403, "Access denied"),
          submissionId,
          error: "You don't have permission to submit to this form",
        },
      };
    }

    // Form closed/inactive errors
    if (
      errorMessage.includes("form is closed") ||
      errorMessage.includes("form is inactive")
    ) {
      return {
        status: 403,
        body: {
          ...ReturnCode(403, "Form is not available"),
          submissionId,
          error: "This form is no longer accepting responses",
        },
      };
    }

    return null; // Let the calling function handle unknown errors
  }

  //Get Respodnent Info
  public async GetResponsesInfo(req: CustomRequest, res: Response) {
    if (!req.user) return res.status(403).json(ReturnCode(403));
    const validation = await ResponseValidationService.validateRequest({
      req,
      res,
      requireFormId: true,
    });

    if (!validation.isValid) return res.status(400).json(ReturnCode(400));

    try {
      // Use aggregation pipeline to get unique respondent emails
      const form = await Form.findById(validation.formId).select(
        "_id owners editors user"
      );

      const hasAccess = hasFormAccess(form as FormType, req.user.id);

      if (!hasAccess) return res.status(403).json(ReturnCode(403));

      const respondents = await FormResponse.aggregate([
        {
          $match: {
            formId: validation.formId,
            respondentEmail: { $exists: true, $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$respondentEmail",
            respondentEmail: { $first: "$respondentEmail" },
            respondentName: { $first: "$respondentName" },
            respondentType: { $first: "$respondentType" },
            responseCount: { $sum: 1 },
            lastSubmitted: { $max: "$submittedAt" },
          },
        },
        {
          $project: {
            _id: 0,
            respondentEmail: 1,
            respondentName: 1,
            respondentType: 1,
            responseCount: 1,
            lastSubmitted: 1,
          },
        },
        {
          $sort: { lastSubmitted: -1 },
        },
      ]);

      return res.status(200).json({ ...ReturnCode(200), data: respondents });
    } catch (error) {
      console.log("Fetching respondentList", error);
      res.status(500).json(ReturnCode(500));
    }
  }

  // Get responses with filtering and pagination
  public GetResponsesWithFilters = async (
    req: CustomRequest,
    res: Response
  ) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: true,
      });
      if (!validation.isValid) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user.id,
        res
      );
      if (!form) return;

      // Extract filter parameters matching frontend implementation
      const filters = {
        formId: validation.formId!,
        searchTerm: req.query.q as string,
        completionStatus: req.query.status as string,
        startDate: req.query.startD as string,
        endDate: req.query.endD as string,
        minScore: req.query.startS as string,
        maxScore: req.query.endS as string,
        email: req.query.email as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
        page: validation.page!,
        limit: validation.limit!,
      };

      const result = await ResponseQueryService.getResponsesWithFilters(
        filters
      );
      res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get Responses With Filters Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  // Manual scoring for responses
  public UpdateResponseScore = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid) return;

      const { responseId, scores } = req.body;
      if (!responseId || !scores || !Array.isArray(scores)) {
        return res
          .status(400)
          .json(ReturnCode(400, "Response ID and scores are required"));
      }

      const { response, form } =
        await ResponseValidationService.validateResponseAccess(
          responseId,
          validation.user.id,
          res
        );
      if (!response || !form) return;

      await ResponseProcessingService.updateResponseScores(responseId, scores);
      res.status(200).json(ReturnCode(200, "Scores updated successfully"));
    } catch (error) {
      console.error("Update Response Score Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to update scores"));
    }
  };

  // Get response analytics for charts
  public GetResponseAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user.id,
        res
      );
      if (!form) return;

      const responses = await ResponseQueryService.getResponsesByFormId(
        validation.formId!,
        1,
        1000 // Get all responses for analytics
      );

      const analytics = await ResponseAnalyticsService.getResponseAnalytics(
        validation.formId!,
        responses.responses,
        form
      );

      res.status(200).json({ ...ReturnCode(200), data: analytics });
    } catch (error) {
      console.error("Get Response Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  public async GetInititalFormData(formId: string, res: Response) {
    if (!formId) return res.status(400).json(ReturnCode(400));

    try {
      const formdata = await Form.findById(formId)
        .select("_id setting.acceptResponses")
        .exec();

      if (!formdata) {
        return res.status(404).json(ReturnCode(404));
      }

      return res.status(200).json({ data: formdata });
    } catch (error) {
      console.log("Get Initial Formdata", error);
      return res.status(500).json(ReturnCode(500));
    }
  }

  public GetPublicFormData = async (req: CustomRequest, res: Response) => {
    try {
      // Optimize: Early environment validation
      if (
        !process.env.REFRESH_TOKEN_COOKIE ||
        !process.env.ACCESS_TOKEN_COOKIE ||
        !process.env.RESPONDENT_COOKIE
      ) {
        throw new Error("Missing important environment var");
      }

      const { formId } = req.params;
      let { p, ty } = req.query as GetPublicFormDataType;

      // Optimize: Early validation for performance
      if (!ty) return res.status(400).json(ReturnCode(400));
      if (!Types.ObjectId.isValid(formId)) {
        return res.status(400).json(ReturnCode(400, "Invalid form ID"));
      }

      const page = Number(p ?? "1");

      const isUserAlreadyAuthenticated = !!req.formsession?.sub;

      if (req.formsession) {
        //If user is authenticate fetch data
        ty = GetPublicFormDataTyEnum.data;
      }

      switch (ty) {
        case "initial": {
          const initialData = await Form.findById(formId)
            .select(
              "_id title type totalpage totalscore setting.email setting.acceptResponses setting.acceptGuest setting.submitonce"
            )
            .lean();

          if (!initialData || !initialData.setting?.acceptResponses) {
            return res
              .status(404)
              .json(
                ReturnCode(
                  404,
                  initialData ? "Form is closed" : "Form not found"
                )
              );
          }

          let isAuthenticated = false;

          //Verify user and auto logged in existed user
          if (initialData.setting?.email) {
            // Early return for already authenticated users with combined data
            if (isUserAlreadyAuthenticated) {
              try {
                const formData = await ResponseQueryService.getPublicFormData(
                  formId,
                  page,
                  req,
                  res
                );

                return res.status(200).json({
                  ...ReturnCode(200),
                  data: {
                    ...initialData,
                    isAuthenticated: true,
                    isLoggedin: true,
                    ...formData,
                  },
                });
              } catch (error) {
                console.warn(
                  "Failed to fetch form content for authenticated user:",
                  error
                );
                //Optional Error
                return res.status(200).json(ReturnCode(500));
              }
            }
            isAuthenticated = false;
          } else {
            //If the form is not require email state it as authenticate
            isAuthenticated = true;
          }

          return res.status(200).json({
            ...ReturnCode(200),
            data: { ...initialData, isAuthenticated },
          });
        }

        case "data": {
          if (!Types.ObjectId.isValid(formId)) {
            return res.status(400).json(ReturnCode(400, "Invalid form ID"));
          }

          const formData = await ResponseQueryService.getPublicFormData(
            formId,
            page,
            req,
            res
          );

          return res.status(200).json({
            ...ReturnCode(200),
            data: {
              ...formData,
              isAuthenticated: true,
              ...(req.formsession && { isLoggedIn: true }),
            },
          });
        }
        default:
          res.status(204).json(ReturnCode(204));
      }
    } catch (error) {
      console.error("Get Public Form Data Error:", error);
      if (error instanceof Error) {
        if (error.message === "Form not found") {
          return res.status(404).json(ReturnCode(404, error.message));
        }
        if (error.message === "Form is no longer accepting responses") {
          return res.status(403).json(ReturnCode(403, error.message));
        }
        if (error.message === "You already submitted this form") {
          return res.status(400).json(ReturnCode(400, error.message));
        }
      }
      res.status(500).json(ReturnCode(500, "Failed to retrieve form data"));
    }
  };

  // Get analytics data for a form
  public GetFormAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid) return;

      const { formId } = req.params;
      const { period = "7d" } = req.query;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.id,
        res
      );
      if (!form) return;

      const analyticsData = await ResponseAnalyticsService.getFormAnalytics(
        formId,
        period as string
      );

      res.status(200).json({ ...ReturnCode(200), data: analyticsData });
    } catch (error) {
      console.error("Get Form Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  // Export analytics as PDF or CSV
  public ExportAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid) return;

      const { formId } = req.params;
      const { format = "pdf" } = req.query;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.id,
        res
      );
      if (!form) return;

      const analyticsData = await ResponseAnalyticsService.getFormAnalytics(
        formId
      );

      if (format === "csv") {
        const responses = await ResponseQueryService.getResponsesByFormId(
          formId,
          1,
          1000
        );
        const csvData = ResponseAnalyticsService.generateCSVData(
          analyticsData,
          responses.responses
        );

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${form.title}-analytics.csv"`
        );
        res.send(csvData);
      } else {
        res
          .status(400)
          .json(ReturnCode(400, "Only CSV export is currently supported"));
      }
    } catch (error) {
      console.error("Export Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to export analytics"));
    }
  };

  // Export individual response as PDF
  public ExportResponsePDF = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid) return;

      const { formId, responseId } = req.params;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.id,
        res
      );
      if (!form) return;

      // Get the specific response with full data
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

      // Generate PDF using Puppeteer
      const pdfBuffer = await this.generateResponsePDF(form, response);

      // Get respondent name for filename
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

      // Generate HTML content for the response
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

    // Process each response in the responseset
    if (response.responseset && Array.isArray(response.responseset)) {
      response.responseset.forEach((responseItem: any, index: number) => {
        const question = responseItem.questionId;
        if (!question) return;

        const questionTitle = question.title?.text || `Question ${index + 1}`;
        const questionType = question.type;
        let answerHTML = "";

        // Format answer based on question type
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

  // Get all responses by current user
  public GetUserResponses = async (req: CustomRequest, res: Response) => {
    try {
      const { formId, page, uid, isValid } =
        await ResponseValidationService.validateRequest({
          req,
          res,
          requireUserInfo: true,
          requireFormId: true,
        });
      if (!isValid || !uid || !formId) return;

      const result = await ResponseQueryService.getUserResponses({
        page: page ?? 1,
        formId,
        user: uid,
        limit: 1, //Only one response
      });

      res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get User Responses Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve user responses"));
    }
  };

  // Delete a response by ID
  public DeleteResponse = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: true,
      });
      if (!validation.isValid) return;

      const { responseId } = req.params;
      if (!responseId) {
        return res.status(400).json(ReturnCode(400, "Response ID is required"));
      }

      const { response, form } =
        await ResponseValidationService.validateResponseAccess(
          responseId,
          validation.user.id,
          res
        );
      if (!response || !form) return;

      await ResponseQueryService.deleteResponse(responseId);
      res.status(200).json(ReturnCode(200, "Response deleted successfully"));
    } catch (error) {
      console.error("Delete Response Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to delete response"));
    }
  };

  public BulkDeleteResponses = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid) return;

      const { responseIds, formId } = req.body;
      if (
        !responseIds ||
        !Array.isArray(responseIds) ||
        responseIds.length === 0
      ) {
        return res
          .status(400)
          .json(ReturnCode(400, "Response IDs array is required"));
      }

      if (!formId) {
        return res.status(400).json(ReturnCode(400, "Form ID is required"));
      }

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.id,
        res
      );
      if (!form) return;

      const result = await ResponseQueryService.bulkDeleteResponses(
        responseIds,
        formId
      );
      res.status(200).json({
        ...ReturnCode(200, "Responses deleted successfully"),
        data: result,
      });
    } catch (error) {
      console.error("Bulk Delete Responses Error:", error);
      if (error instanceof Error && error.message.includes("don't exist")) {
        return res.status(400).json(ReturnCode(400, error.message));
      }
      res.status(500).json(ReturnCode(500, "Failed to delete responses"));
    }
  };

  // Send response as card email
  public SendResponseCardEmail = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid) return;

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

      // Check if user has access to this form
      const hasAccess = await ResponseValidationService.validateFormAccess(
        form._id.toString(),
        validation.user.id,
        res
      );
      if (!hasAccess) return;

      // Build questions array with scores and warnings
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

      // Process each response in the response set
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

      // Prepare email data
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

      // Send the email
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
}

export default new FormResponseController();
export { FormResponseController };
