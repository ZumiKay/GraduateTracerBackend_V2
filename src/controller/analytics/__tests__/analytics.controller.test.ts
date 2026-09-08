import { Response } from "express";
import analyticsController from "../analytics.controller";
import { FormOverViewAnalyticsService } from "../../../services/ResponseAnalyticsService";
import { ResponseValidationService } from "../../../services/ResponseValidationService";
import Content, { QuestionType } from "../../../model/Content.model";
import FormResponse from "../../../model/Response.model";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../services/ResponseAnalyticsService");
jest.mock("../../../services/ResponseValidationService");
jest.mock("../../../model/Content.model");
jest.mock("../../../model/Response.model");

describe("Analytics Controller Unit Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const validFormId = new Types.ObjectId().toString();
  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe("GetFormOverviewPerformance", () => {
    test("returns 400 for invalid formId parameter", async () => {
      mockReq = {
        query: { formId: "invalid-id" },
      };

      await analyticsController.GetFormOverviewPerformance(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("returns 200 with overview data on valid request", async () => {
      mockReq = {
        query: { formId: validFormId, period: "30d" },
      };

      const mockOverviewData = {
        totalResponses: 150,
        completionRate: 85,
        avgScore: 78.5,
      };

      (
        FormOverViewAnalyticsService.getFormAnalytics as jest.Mock
      ).mockResolvedValue(mockOverviewData);

      await analyticsController.GetFormOverviewPerformance(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(FormOverViewAnalyticsService.getFormAnalytics).toHaveBeenCalledWith(
        validFormId,
        "30d",
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ data: mockOverviewData });
    });

    test("returns 500 when service throws an error", async () => {
      mockReq = {
        query: { formId: validFormId },
      };

      (
        FormOverViewAnalyticsService.getFormAnalytics as jest.Mock
      ).mockRejectedValue(new Error("Service failure"));

      await analyticsController.GetFormOverviewPerformance(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("GetAnalyticsData", () => {
    test("returns 400 if formId query parameter is invalid", async () => {
      mockReq = {
        query: { formId: "invalid-id" },
      };

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("returns 403 if user is not authenticated", async () => {
      mockReq = {
        query: { formId: validFormId },
        user: undefined,
      };

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("returns early if user access to form is denied", async () => {
      mockReq = {
        query: { formId: validFormId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(null);

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(ResponseValidationService.validateFormAccess).toHaveBeenCalled();
      expect(Content.find).not.toHaveBeenCalled();
    });

    test("returns 404 if no questions are found for the form", async () => {
      mockReq = {
        query: { formId: validFormId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      const mockForm = { _id: validFormId, title: "Survey Form" };
      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(mockForm);

      (Content.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No questions found" }),
      );
    });

    test("returns 204 if form has 0 total responses", async () => {
      mockReq = {
        query: { formId: validFormId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      const mockForm = { _id: validFormId, title: "Survey Form" };
      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(mockForm);

      const qId = new Types.ObjectId();
      const mockQuestions = [
        {
          _id: qId,
          type: QuestionType.MultipleChoice,
          title: "Question 1",
          qIdx: 1,
        },
      ];

      (Content.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockQuestions),
        }),
      });

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(0);

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(204);
      expect(mockJson).toHaveBeenCalledWith({
        data: { isResponse: false },
      });
    });

    test("processes choice, text, range, and number questions and returns 200 with structured analytics", async () => {
      mockReq = {
        query: { formId: validFormId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      const mockForm = {
        _id: validFormId,
        title: "Comprehensive Form",
        totalscore: 100,
      };
      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(mockForm);

      const choiceQId = new Types.ObjectId();
      const textQId = new Types.ObjectId();
      const rangeQId = new Types.ObjectId();
      const numberQId = new Types.ObjectId();

      const mockQuestions = [
        {
          _id: choiceQId,
          questionId: "1",
          type: QuestionType.MultipleChoice,
          title: "Favorite Color",
          qIdx: 1,
          multiple: [
            { idx: 1, content: "Red" },
            { idx: 2, content: "Blue" },
          ],
          score: 10,
          answer: { answer: 1 },
        },
        {
          _id: textQId,
          questionId: "2",
          type: QuestionType.ShortAnswer,
          title: "Feedback",
          qIdx: 2,
        },
        {
          _id: rangeQId,
          questionId: "3",
          type: QuestionType.RangeNumber,
          title: "Experience Level",
          qIdx: 3,
        },
        {
          _id: numberQId,
          questionId: "4",
          type: QuestionType.Number,
          title: "Age",
          qIdx: 4,
        },
      ];

      (Content.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockQuestions),
        }),
      });

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(2);

      const mockResponses = [
        {
          _id: new Types.ObjectId(),
          respondentName: "Alice",
          respondentEmail: "alice@example.com",
          totalScore: 50,
          completionStatus: "completed",
          submittedAt: new Date(),
          responseset: [
            {
              question: choiceQId.toString(),
              response: 1,
              score: 10,
            },
            {
              question: textQId.toString(),
              response: "Great service and quick response",
            },
            {
              question: rangeQId.toString(),
              response: { start: 1, end: 5 },
            },
            {
              question: numberQId.toString(),
              response: 25,
            },
          ],
        },
        {
          _id: new Types.ObjectId(),
          respondentName: "Bob",
          respondentEmail: "bob@example.com",
          totalScore: 40,
          completionStatus: "completed",
          submittedAt: new Date(),
          responseset: [
            {
              question: choiceQId.toString(),
              response: 2,
              score: 0,
            },
            {
              question: textQId.toString(),
              response: "Satisfied overall",
            },
            {
              question: rangeQId.toString(),
              response: { start: 2, end: 4 },
            },
            {
              question: numberQId.toString(),
              response: 35,
            },
          ],
        },
      ];

      (FormResponse.aggregate as jest.Mock).mockResolvedValue(mockResponses);

      await analyticsController.GetAnalyticsData(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            formId: validFormId,
            totalResponses: 2,
            questions: expect.any(Array),
            formStats: expect.objectContaining({
              totalResponses: 2,
              averageScore: 45,
            }),
          }),
        }),
      );
    });
  });
});
