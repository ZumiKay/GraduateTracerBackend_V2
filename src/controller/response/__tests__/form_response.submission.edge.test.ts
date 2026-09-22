import { Response } from "express";
import FormResponseSubmissionController from "../form_response.submission.controller";
import FormResponseScoringController from "../form_response.scoring.controller";
import Form from "../../../model/Form.model";
import Formsession from "../../../model/Formsession.model";
import { RespondentTrackingService } from "../../../services/RespondentTrackingService";
import { ResponseProcessingService } from "../../../services/ResponseProcessingService";
import { ResponseValidationService } from "../../../services/ResponseValidationService";
import { NotificationController } from "../../utils/notification.controller";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Form.model");
jest.mock("../../../model/Formsession.model");
jest.mock("../../../services/RespondentTrackingService");
jest.mock("../../../services/ResponseProcessingService");
jest.mock("../../../services/ResponseValidationService");
jest.mock("../../utils/notification.controller");

describe("Form Response Submission & Scoring Edge Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockClearCookie: jest.Mock;

  const validFormId = new Types.ObjectId().toString();
  const validQuestionId = new Types.ObjectId().toString();
  const validResponseId = new Types.ObjectId().toString();
  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockClearCookie = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRes = {
      status: mockStatus,
      json: mockJson,
      clearCookie: mockClearCookie,
    };
  });

  describe("SubmitFormResponse Validation Boundaries", () => {
    test("returns 400 when body is missing", async () => {
      mockReq = { params: { formId: validFormId }, body: undefined };

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Request body is required",
        }),
      );
    });

    test("returns 400 when responseSet is empty or not an array", async () => {
      mockReq = {
        params: { formId: validFormId },
        body: { responseSet: [] },
      };

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            "At least one response is required",
          ]),
        }),
      );
    });

    test("returns 400 when response item is missing question ID or response answer", async () => {
      mockReq = {
        params: { formId: validFormId },
        body: {
          responseSet: [
            { question: "", response: "Some Answer" },
            { question: validQuestionId, response: null },
          ],
        },
      };

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            "Response 1: Question ID is required",
            "Response 2: Answer is required",
          ]),
        }),
      );
    });

    test("returns 400 when respondentEmail format is invalid", async () => {
      mockReq = {
        params: { formId: validFormId },
        body: {
          responseSet: [{ question: validQuestionId, response: "Answer A" }],
          respondentEmail: "invalid-email-string",
        },
      };

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.arrayContaining(["Invalid email format"]),
        }),
      );
    });

    test("returns 404 if form does not exist", async () => {
      mockReq = {
        params: { formId: validFormId },
        body: {
          responseSet: [{ question: validQuestionId, response: "Answer A" }],
        },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Form not found" }),
      );
    });
  });

  describe("SubmitFormResponse Business Logic & Anti-Abuse", () => {
    test("rejects duplicate submission with 400 when respondent already responded", async () => {
      mockReq = {
        params: { formId: validFormId },
        body: {
          responseSet: [{ question: validQuestionId, response: "Answer A" }],
          respondentEmail: "student@example.com",
        },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: validFormId,
            type: "normal",
            title: "Tracer Survey",
            setting: { acceptResponses: true },
          }),
        }),
      });

      (
        RespondentTrackingService.createSubmissionWithTracking as jest.Mock
      ).mockReturnValue({
        formId: new Types.ObjectId(validFormId),
        responseset: [{ question: validQuestionId, response: "Answer A" }],
      });

      (
        RespondentTrackingService.checkRespondentExists as jest.Mock
      ).mockResolvedValue({
        hasResponded: true,
        responseId: "existing-resp-id",
      });

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Form already submitted" }),
      );
    });

    test("successfully submits form, notifies owner, and cleans up session for submitonce forms", async () => {
      process.env.ACCESS_RESPONDENT_COOKIE = "access_resp_cookie";
      process.env.RESPONDENT_COOKIE = "refresh_resp_cookie";

      mockReq = {
        params: { formId: validFormId },
        body: {
          responseSet: [{ question: validQuestionId, response: "Answer A" }],
          respondentName: "Jane Doe",
          respondentEmail: "jane@example.com",
        },
        formsession: { sub: "session-abc-123" },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: validFormId,
            type: "normal",
            title: "Tracer Survey",
            setting: { acceptResponses: true, submitonce: true },
          }),
        }),
      });

      (
        RespondentTrackingService.createSubmissionWithTracking as jest.Mock
      ).mockReturnValue({
        formId: new Types.ObjectId(validFormId),
        responseset: [{ question: validQuestionId, response: "Answer A" }],
      });

      (
        RespondentTrackingService.checkRespondentExists as jest.Mock
      ).mockResolvedValue({
        hasResponded: false,
      });

      (
        ResponseProcessingService.processNormalFormSubmission as jest.Mock
      ).mockResolvedValue({
        responseId: validResponseId,
        completionStatus: "completed",
      });

      (Formsession.deleteOne as jest.Mock).mockResolvedValue({ acknowledged: true });
      (NotificationController.NotifyNewResponse as jest.Mock).mockResolvedValue([]);

      await FormResponseSubmissionController.SubmitFormResponse(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockClearCookie).toHaveBeenCalledWith("access_resp_cookie");
      expect(mockClearCookie).toHaveBeenCalledWith("refresh_resp_cookie");
      expect(Formsession.deleteOne).toHaveBeenCalledWith({ session_id: "session-abc-123" });
      expect(NotificationController.NotifyNewResponse).toHaveBeenCalledWith(
        validFormId,
        validResponseId,
        expect.objectContaining({ name: "Jane Doe", email: "jane@example.com" }),
      );
    });
  });

  describe("UpdateResponseScore Edge Boundaries", () => {
    test("returns 400 if responseId is missing", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        body: { scores: [{ questionId: validQuestionId, score: 10 }] },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      await FormResponseScoringController.UpdateResponseScore(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Response ID is required" }),
      );
    });

    test("returns 400 if scores array is empty or missing", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        body: { responseId: validResponseId, scores: [] },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      await FormResponseScoringController.UpdateResponseScore(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Scores array is required and must not be empty",
        }),
      );
    });

    test("returns 400 if any score entry is missing questionId or score", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        body: {
          responseId: validResponseId,
          scores: [{ questionId: "", score: 10 }],
        },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      await FormResponseScoringController.UpdateResponseScore(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Each score entry must have questionId and score",
        }),
      );
    });
  });
});
