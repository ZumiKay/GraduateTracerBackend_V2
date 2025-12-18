import { Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import { MongoErrorHandler } from "../../utilities/MongoErrorHandler";
import Zod from "zod";
import { Types } from "mongoose";
import Form, { TypeForm } from "../../model/Form.model";
import { ResponseProcessingService } from "../../services/ResponseProcessingService";
import { RespondentTrackingService } from "../../services/RespondentTrackingService";
import { ResponseQueryService } from "../../services/ResponseQueryService";
import Formsession from "../../model/Formsession.model";
import {
  ResponseSetType,
  SubmitionProcessionReturnType,
} from "../../model/Response.model";
import {
  GetPublicFormDataType,
  GetPublicFormDataTyEnum,
} from "../../middleware/User.middleware";
import { CustomRequest } from "../../types/customType";
import { NotificationController } from "../utils/notification.controller";

interface SubmitResponseBodyType {
  responseSet?: Array<ResponseSetType>;
  respondentEmail?: string;
  respondentName?: string;
}

export class FormResponseSubmissionController {
  static publicSubmitValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      respondentEmail: Zod.string().email().optional(),
      respondentName: Zod.string().optional(),
    }),
  });

  public GetFormForRespondent = async (req: CustomRequest, res: Response) => {
    return this.GetPublicFormData(req, res);
  };

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

      const { responseSet, respondentEmail, respondentName } =
        req.body as SubmitResponseBodyType;

      const { formId } = req.params as { formId: string };

      const form = await Form.findById(formId)
        .select("setting type title totalscore")
        .lean();

      if (!form) {
        console.warn(`[${submissionId}] Form not found:`, formId);
        return res.status(404).json(ReturnCode(404, "Form not found"));
      }

      let submissionDataWithTracking;

      const baseSubmissionData = {
        formId: formId,
        responseSet,
        respondentEmail,
        respondentName,
      };

      submissionDataWithTracking =
        RespondentTrackingService.createSubmissionWithTracking(
          baseSubmissionData,
          req
        );

      let result: Partial<SubmitionProcessionReturnType | undefined>;
      try {
        //Quiz type process
        if (form.type === TypeForm.Quiz) {
          result = await ResponseProcessingService.processFormSubmission(
            submissionDataWithTracking,
            form
          );
        }
        //Normal type process
        else {
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

      if (form.setting?.submitonce && req.formsession) {
        res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE as string);
        res.clearCookie(process.env.RESPONDENT_COOKIE as string);
        await Formsession.deleteOne({ session_id: req.formsession.sub });
      }

      //Create Notification for formOwner
      if (result.responseId) {
        await NotificationController.NotifyNewResponse(
          formId,
          result.responseId,
          {
            name: respondentName,
            email: respondentEmail,
          }
        );
      }

      return res.status(200).json({
        ...ReturnCode(200, "Form submitted successfully"),
        data: result,
        submissionId,
        meta: {
          formId,
          formType: form.type,
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

        if (error.name === "ValidationError" || error.name === "CastError") {
          return res.status(400).json({
            ...ReturnCode(400, "Invalid data provided"),
            submissionId,
            error: error.message,
          });
        }

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

    const { responseSet, respondentEmail, respondentName } = body;

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

    return null;
  }

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
      if (
        !process.env.REFRESH_TOKEN_COOKIE ||
        !process.env.ACCESS_TOKEN_COOKIE ||
        !process.env.RESPONDENT_COOKIE
      ) {
        throw new Error("Missing important environment var");
      }

      const { formId } = req.params;
      let { p, ty } = req.query as GetPublicFormDataType;

      if (!ty) return res.status(400).json(ReturnCode(400));
      if (!Types.ObjectId.isValid(formId)) {
        return res.status(400).json(ReturnCode(400, "Invalid form ID"));
      }

      const page = Number(p ?? "1");

      const isUserAlreadyAuthenticated = !!req.formsession;

      if (req.formsession) {
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

          if (initialData.setting?.email) {
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
                return res.status(200).json(ReturnCode(500));
              }
            }
            isAuthenticated = false;
          } else {
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
}

export default new FormResponseSubmissionController();
