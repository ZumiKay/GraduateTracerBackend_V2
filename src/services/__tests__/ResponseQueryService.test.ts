import { Types } from "mongoose";
import FormResponse, {
  FormResponseType,
  ResponseCompletionStatus,
  ResponseSetType,
} from "../../model/Response.model";
import Form from "../../model/Form.model";
import Content, { ContentType, QuestionType } from "../../model/Content.model";
import {
  ResponseQueryService,
  ResponseFilterType,
} from "../ResponseQueryService";
import { ResponseValidationService } from "../ResponseValidationService";
import { FormValidationService } from "../FormValidationService";
import { FingerprintService } from "../../utilities/fingerprint";
import { compareSync } from "bcrypt";
import * as formHelpers from "../../utilities/formHelpers";
import { MockContentFactory } from "../../utilities/mockdata";
import { CustomRequest } from "../../types/customType";
import { Response } from "express";

// Mock dependencies
jest.mock("../../model/Response.model");
jest.mock("../../model/Form.model");
jest.mock("../../model/Content.model");
jest.mock("../ResponseValidationService");
jest.mock("../FormValidationService");
jest.mock("../../utilities/fingerprint");
jest.mock("bcrypt");

const createMockQuery = (resolvedValue: any) => {
  const query: any = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolvedValue),
  };
  return query;
};

describe("ResponseQueryService", () => {
  const formId = new Types.ObjectId();
  const formIdStr = formId.toString();
  const responseId1 = new Types.ObjectId();
  const responseId2 = new Types.ObjectId();
  const q1Id = new Types.ObjectId();
  const q2Id = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();

    (
      ResponseValidationService.createPaginationResponse as jest.Mock
    ).mockImplementation((page: number, limit: number, totalCount: number) => ({
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
    }));

    (
      ResponseValidationService.buildFilterQuery as jest.Mock
    ).mockImplementation((filters: ResponseFilterType) => ({
      formId: new Types.ObjectId(filters.formId),
    }));

    (
      ResponseValidationService.buildSortOptions as jest.Mock
    ).mockImplementation((sortBy?: string, sortOrder?: string) => ({
      [sortBy || "submittedAt"]: sortOrder === "desc" ? -1 : 1,
    }));

    (FormValidationService.validateContent as jest.Mock).mockReturnValue({
      isValid: true,
    });

    (
      FingerprintService.extractFingerprintFromRequest as jest.Mock
    ).mockReturnValue({
      platform: "macOS",
      timezone: "Asia/Bangkok",
    });

    (FingerprintService.getClientIP as jest.Mock).mockReturnValue(
      "192.168.1.100",
    );

    (compareSync as jest.Mock).mockReturnValue(true);

    jest.spyOn(formHelpers, "getLastQuestionIdx").mockResolvedValue(0);
  });

  describe("getResponsesByFormId", () => {
    test("should fetch paginated responses and add responseCount by email", async () => {
      const mockResponses: Partial<FormResponseType>[] = [
        {
          _id: responseId1,
          formId,
          respondentEmail: "user1@example.com",
          respondentName: "User One",
          isCompleted: true,
        },
        {
          _id: responseId2,
          formId,
          respondentEmail: "user2@example.com",
          respondentName: "User Two",
          isCompleted: true,
        },
      ];

      (FormResponse.find as jest.Mock).mockReturnValue(
        createMockQuery(mockResponses),
      );
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(2);
      (FormResponse.aggregate as jest.Mock).mockResolvedValue([
        { _id: "user1@example.com", count: 3 },
        { _id: "user2@example.com", count: 1 },
      ]);

      const result = await ResponseQueryService.getResponsesByFormId(
        formIdStr,
        1,
        10,
      );

      expect(FormResponse.find).toHaveBeenCalledWith({ formId: formIdStr });
      expect(result.responses).toHaveLength(2);
      expect((result.responses[0] as any).responseCount).toBe(3);
      expect((result.responses[1] as any).responseCount).toBe(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    test("should handle responses without emails by setting responseCount to 0", async () => {
      const mockResponses: Partial<FormResponseType>[] = [
        {
          _id: responseId1,
          formId,
          respondentEmail: undefined,
          respondentName: "Anonymous",
        },
      ];

      (FormResponse.find as jest.Mock).mockReturnValue(
        createMockQuery(mockResponses),
      );
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await ResponseQueryService.getResponsesByFormId(
        formIdStr,
        1,
        10,
      );

      expect(result.responses).toHaveLength(1);
      expect((result.responses[0] as any).responseCount).toBe(0);
      expect(FormResponse.aggregate).not.toHaveBeenCalled();
    });

    test("should default responseCount to 0 if email is not found in aggregate map", async () => {
      const mockResponses: Partial<FormResponseType>[] = [
        {
          _id: responseId1,
          formId,
          respondentEmail: "unknown@example.com",
        },
      ];

      (FormResponse.find as jest.Mock).mockReturnValue(
        createMockQuery(mockResponses),
      );
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);
      (FormResponse.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await ResponseQueryService.getResponsesByFormId(
        formIdStr,
        1,
        10,
      );

      expect((result.responses[0] as any).responseCount).toBe(0);
    });
  });

  describe("getResponsebyUserIdWithPagination", () => {
    let mockReq: Partial<CustomRequest>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      mockRes = {
        status: statusMock,
      };
    });

    test("should return 400 if formId is not a valid ObjectId", async () => {
      mockReq = {
        params: {
          formId: "invalid-id",
          page: "1",
          resIdx: "0",
          userId: "user-123",
        } as never,
      };

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 400, message: "Invalid form ID" }),
      );
    });

    test("should return 400 if page or resIdx is invalid or negative", async () => {
      mockReq = {
        params: {
          formId: formIdStr,
          page: "invalid",
          resIdx: "-1",
          userId: "user-123",
        } as never,
      };

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: "Invalid page or response index",
        }),
      );
    });

    test("should return 404 if responseIdx is greater than or equal to totalCount", async () => {
      mockReq = {
        params: {
          formId: formIdStr,
          page: "1",
          resIdx: "5",
          userId: "user-123",
        } as never,
      };

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(3);

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          message: "Response index out of range",
        }),
      );
    });

    test("should return 404 if response is not found", async () => {
      mockReq = {
        params: {
          formId: formIdStr,
          page: "1",
          resIdx: "0",
          userId: "user-123",
        } as never,
      };

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 404, message: "Response not found" }),
      );
    });

    test("should return 200 with response and pagination on success", async () => {
      const mockResponse = {
        _id: responseId1,
        formId,
        userId: "user-123",
        totalScore: 50,
      };

      mockReq = {
        params: {
          formId: formIdStr,
          page: "1",
          resIdx: "0",
          userId: "user-123",
        } as never,
      };

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockResponse),
      });

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          data: expect.objectContaining({
            response: mockResponse,
            pagination: expect.objectContaining({
              page: 1,
              limit: 1,
              totalCount: 1,
            }),
          }),
        }),
      );
    });

    test("should return 500 when an exception occurs", async () => {
      mockReq = {
        params: {
          formId: formIdStr,
          page: "1",
          resIdx: "0",
          userId: "user-123",
        } as never,
      };

      (FormResponse.countDocuments as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await ResponseQueryService.getResponsebyUserIdWithPagination(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: "Internal server error",
        }),
      );
    });
  });

  describe("getResponsesWithFilters", () => {
    test("should fetch paginated responses with built filters and sort options", async () => {
      const filters: ResponseFilterType = {
        formId: formIdStr,
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      const mockResponses = [
        { _id: responseId1, respondentEmail: "test@example.com" },
      ];
      (FormResponse.find as jest.Mock).mockReturnValue(
        createMockQuery(mockResponses),
      );
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);
      (FormResponse.aggregate as jest.Mock).mockResolvedValue([
        { _id: "test@example.com", count: 1 },
      ]);

      const result =
        await ResponseQueryService.getResponsesWithFilters(filters);

      expect(ResponseValidationService.buildFilterQuery).toHaveBeenCalledWith(
        filters,
      );
      expect(ResponseValidationService.buildSortOptions).toHaveBeenCalledWith(
        "createdAt",
        "desc",
      );
      expect(result.responses).toHaveLength(1);
      expect((result.responses[0] as any).responseCount).toBe(1);
    });

    test("should call getGroupedResponses when group parameter is 'respondentEmail'", async () => {
      const filters: ResponseFilterType = {
        formId: formIdStr,
        page: 1,
        limit: 10,
        group: "respondentEmail",
      };

      const mockGroupedResponses = [
        {
          respondentEmail: "grouped@example.com",
          respondentName: "Grouped User",
          responseCount: 2,
          responseIds: [responseId1.toString(), responseId2.toString()],
        },
      ];

      (FormResponse.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ total: 1 }]) // Count pipeline
        .mockResolvedValueOnce(mockGroupedResponses); // Group pipeline

      const result =
        await ResponseQueryService.getResponsesWithFilters(filters);

      expect(result.responses).toEqual(mockGroupedResponses);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        totalCount: 1,
        totalPages: 1,
      });
    });
  });

  describe("getGroupedResponses", () => {
    test("should group responses by email with custom sort options", async () => {
      const query = { formId };
      const sortOptions = { respondentEmail: 1 as const };

      (FormResponse.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ total: 5 }])
        .mockResolvedValueOnce([
          {
            respondentEmail: "a@example.com",
            responseCount: 3,
          },
        ]);

      const result = await ResponseQueryService.getGroupedResponses(
        query as never,
        2,
        2,
        sortOptions,
      );

      expect(result.responses).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        totalCount: 5,
        totalPages: 3,
      });
    });
  });

  describe("getUserResponses", () => {
    test("should query user responses with pagination", async () => {
      const mockResponses = [
        { _id: responseId1, respondentEmail: "user@example.com" },
      ];
      (FormResponse.find as jest.Mock).mockReturnValue(
        createMockQuery(mockResponses),
      );
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1);
      (FormResponse.aggregate as jest.Mock).mockResolvedValue([
        { _id: "user@example.com", count: 1 },
      ]);

      const result = await ResponseQueryService.getUserResponses({
        page: 1,
        limit: 10,
        user: "user-123",
        formId: formIdStr,
      });

      expect(FormResponse.find).toHaveBeenCalledWith({
        formId: formIdStr,
        $or: [{ user: "user-123" }, { respondentEmail: "user-123" }],
      });
      expect(result.responses).toHaveLength(1);
    });
  });

  describe("getGuestResponses", () => {
    test("should find guest responses with userId null", async () => {
      const mockGuestResponses = [{ _id: responseId1, userId: null, formId }];
      (FormResponse.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockGuestResponses),
      });

      const result = await ResponseQueryService.getGuestResponses(formIdStr);

      expect(FormResponse.find).toHaveBeenCalledWith({
        formId: formIdStr,
        userId: null,
      });
      expect(result).toEqual(mockGuestResponses);
    });
  });

  describe("getPublicFormData", () => {
    const mockForm = {
      _id: formId,
      title: "Public Feedback Form",
      type: "survey",
      totalscore: 100,
      totalpage: 1,
      setting: {
        acceptResponses: true,
        submitonce: false,
        email: true,
      },
    };

    const mockContents: Partial<ContentType>[] = [
      {
        _id: q1Id,
        qIdx: 0,
        title: MockContentFactory.createContentTitle("Question 1"),
        type: QuestionType.MultipleChoice,
        multiple: MockContentFactory.createChoiceOptions(3),
        score: 10,
        require: true,
        page: 1,
      },
      {
        _id: q2Id,
        qIdx: 1,
        title: MockContentFactory.createContentTitle("Question 2"),
        type: QuestionType.Text,
        score: 5,
        require: false,
        page: 1,
        parentcontent: {
          qId: q1Id.toString(),
          qIdx: 0,
          optIdx: 0,
        },
      },
    ];

    test("should throw error if formId is invalid ObjectId", async () => {
      await expect(
        ResponseQueryService.getPublicFormData("invalid-id", 1, {} as never),
      ).rejects.toThrow("Invalid form ID");
    });

    test("should throw error if form is not found", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        ResponseQueryService.getPublicFormData(formIdStr, 1, {} as never),
      ).rejects.toThrow("Form not found");
    });

    test("should throw error if form is not accepting responses and not in preview", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockForm,
            setting: { acceptResponses: false },
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });

      await expect(
        ResponseQueryService.getPublicFormData(
          formIdStr,
          1,
          {} as never,
          false,
        ),
      ).rejects.toThrow("Form is no longer accepting responses");
    });

    test("should allow accessing form if not accepting responses but isPreview is true", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockForm,
            setting: { acceptResponses: false },
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });

      const result = await ResponseQueryService.getPublicFormData(
        formIdStr,
        1,
        {} as never,
        true,
      );

      expect(result).toHaveProperty("contents");
      expect((result as any).title).toBe("Public Feedback Form");
    });

    test("should return isResponsed if submitonce is true and user has already submitted by email", async () => {
      const existingResponse = {
        _id: responseId1,
        totalScore: 80,
        isCompleted: true,
        submittedAt: new Date(),
        respondentEmail: "submitter@example.com",
        respondentName: "Submitter",
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockForm,
            setting: { submitonce: true, email: true },
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(existingResponse),
        }),
      });

      const mockReq = {
        formsession: { email: "submitter@example.com" },
      };

      const result = await ResponseQueryService.getPublicFormData(
        formIdStr,
        1,
        mockReq as never,
        false,
      );

      expect(result).toHaveProperty("isResponsed");
      expect((result as any).isResponsed.message).toBe(
        "You already submitted response",
      );
      expect((result as any).isResponsed.responseId).toEqual(responseId1);
      expect((result as any).isResponsed.maxScore).toBe(100);
    });

    test("should return isResponsed if submitonce is true and IP/fingerprint match score is >= 70", async () => {
      const existingResponse = {
        _id: responseId1,
        totalScore: 50,
        completionStatus: ResponseCompletionStatus.completed,
        submittedAt: new Date(),
        respondentIP: "hashed-ip",
        deviceInfo: {
          platform: "macOS",
          timezone: "Asia/Bangkok",
        },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ...mockForm,
            setting: { submitonce: true, email: false },
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });
      (FormResponse.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([existingResponse]),
        }),
      });

      const mockReq = {
        headers: {},
      };

      const result = await ResponseQueryService.getPublicFormData(
        formIdStr,
        1,
        mockReq as never,
        false,
      );

      expect(result).toHaveProperty("isResponsed");
      expect((result as any).isResponsed.message).toBe(
        "You already submitted response",
      );
    });

    test("should return contentValidation errors if any question validation fails", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockForm),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });

      (FormValidationService.validateContent as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: ["Invalid score"],
      });

      const result = await ResponseQueryService.getPublicFormData(
        formIdStr,
        1,
        {} as never,
      );

      expect(result).toHaveProperty("contentValidation");
      expect((result as any).contentValidation[0].isValid).toBe(false);
    });
  });

  describe("bulkDeleteResponses", () => {
    test("should throw error if formId is invalid ObjectId", async () => {
      await expect(
        ResponseQueryService.bulkDeleteResponses(
          [responseId1.toString()],
          "invalid-form-id",
        ),
      ).rejects.toThrow("Invalid form ID: invalid-form-id");
    });

    test("should throw error if any responseId is invalid ObjectId", async () => {
      await expect(
        ResponseQueryService.bulkDeleteResponses(
          [responseId1.toString(), "invalid-res-id"],
          formIdStr,
        ),
      ).rejects.toThrow("Invalid response ID(s): invalid-res-id");
    });

    test("should throw error if responseIds is empty", async () => {
      await expect(
        ResponseQueryService.bulkDeleteResponses([], formIdStr),
      ).rejects.toThrow("No valid response IDs provided");
    });

    test("should throw error if some responses do not exist", async () => {
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(1); // Expecting 2

      await expect(
        ResponseQueryService.bulkDeleteResponses(
          [responseId1.toString(), responseId2.toString()],
          formIdStr,
        ),
      ).rejects.toThrow(
        "Some responses don't exist or don't belong to this form",
      );
    });

    test("should successfully delete matching responses", async () => {
      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(2);
      (FormResponse.deleteMany as jest.Mock).mockResolvedValue({
        deletedCount: 2,
      });

      const result = await ResponseQueryService.bulkDeleteResponses(
        [responseId1.toString(), responseId2.toString()],
        formIdStr,
      );

      expect(FormResponse.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [responseId1, responseId2] },
        formId: new Types.ObjectId(formIdStr),
      });
      expect(result).toEqual({ deletedCount: 2 });
    });
  });

  describe("GetResponseById", () => {
    test("should return null if response is not found", async () => {
      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await ResponseQueryService.GetResponseById({
        id: responseId1.toString(),
        formId: formIdStr,
      });

      expect(result).toBeNull();
    });

    test("should return response data when found", async () => {
      const mockResponse = {
        _id: responseId1,
        formId,
        respondentEmail: "test@example.com",
        submittedAt: new Date("2026-06-01T00:00:00.000Z"),
        responseset: [
          {
            question: q1Id,
            response: 0,
          },
        ],
      };

      const mockContents: Partial<ContentType>[] = [
        {
          _id: q1Id,
          qIdx: 0,
          type: QuestionType.MultipleChoice,
          multiple: MockContentFactory.createChoiceOptions(3),
        },
      ];

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockResponse),
        }),
      });

      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockContents),
          }),
        }),
      });

      (FormResponse.countDocuments as jest.Mock).mockResolvedValue(4);

      const result = await ResponseQueryService.GetResponseById({
        id: responseId1.toString(),
        formId: formIdStr,
      });

      expect(result).not.toBeNull();
      expect(result?.responseCount).toBe(4);
      expect(result?.isScoreable).toBe(true);
      expect(result?.submittedAt).toBe("01-06-2026");
      expect(result?.responseset).toBeDefined();
    });

    test("should handle response without respondentEmail without querying response count", async () => {
      const mockResponse = {
        _id: responseId1,
        formId,
        respondentEmail: undefined,
        submittedAt: new Date("2026-06-01T00:00:00.000Z"),
        responseset: [],
      };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockResponse),
        }),
      });

      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await ResponseQueryService.GetResponseById({
        id: responseId1.toString(),
        formId: formIdStr,
      });

      expect(result?.responseCount).toBe(0);
      expect(FormResponse.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe("ResponsesetProcessQuestion", () => {
    test("should throw error 'Invalid Question' if any question has no _id", () => {
      const questions = [
        {
          _id: undefined,
          type: QuestionType.Text,
        } as never,
      ];

      expect(() =>
        ResponseQueryService.ResponsesetProcessQuestion(questions, []),
      ).toThrow("Invalid Question");
    });

    test("should format single choice question responses with key and val", () => {
      const choices = MockContentFactory.createChoiceOptions(3);
      const questions: ContentType[] = [
        {
          _id: q1Id,
          type: QuestionType.MultipleChoice,
          multiple: choices,
          qIdx: 0,
        } as never,
      ];

      const responseset: ResponseSetType[] = [
        {
          question: q1Id,
          response: 1,
        },
      ];

      const result = ResponseQueryService.ResponsesetProcessQuestion(
        questions,
        responseset,
      );

      expect(result[0].response).toEqual({
        key: 1,
        val: "Option 2",
      });
    });

    test("should format multiple choice / checkbox responses with key array and val array", () => {
      const choices = MockContentFactory.createChoiceOptions(4);
      const questions: ContentType[] = [
        {
          _id: q1Id,
          type: QuestionType.CheckBox,
          checkbox: choices,
          qIdx: 0,
        } as never,
      ];

      const responseset: ResponseSetType[] = [
        {
          question: q1Id,
          response: [0, 2],
        },
      ];

      const result = ResponseQueryService.ResponsesetProcessQuestion(
        questions,
        responseset,
      );

      expect(result[0].response).toEqual({
        key: [0, 2],
        val: ["Option 1", "Option 3"],
      });
    });

    test("should format Date question answer key to DD/MM/YYYY", () => {
      const questions: ContentType[] = [
        {
          _id: q1Id,
          type: QuestionType.Date,
          qIdx: 0,
          answer: {
            _id: new Types.ObjectId(),
            answer: "2026-06-01",
          },
        } as never,
      ];

      const responseset: ResponseSetType[] = [
        {
          question: q1Id,
          response: "2026-06-01",
        },
      ];

      const result = ResponseQueryService.ResponsesetProcessQuestion(
        questions,
        responseset,
      );

      expect((result[0].question as ContentType).answer?.answer).toBe(
        "01-06-2026",
      );
    });

    test("should format RangeDate question answer key start and end to DD/MM/YYYY", () => {
      const questions: ContentType[] = [
        {
          _id: q1Id,
          type: QuestionType.RangeDate,
          qIdx: 0,
          answer: {
            _id: new Types.ObjectId(),
            answer: {
              start: "2026-06-01",
              end: "2026-06-15",
            } as never,
          },
        } as never,
      ];

      const responseset: ResponseSetType[] = [
        {
          question: q1Id,
          response: { start: "2026-06-01", end: "2026-06-15" },
        },
      ];

      const result = ResponseQueryService.ResponsesetProcessQuestion(
        questions,
        responseset,
      );

      expect((result[0].question as ContentType).answer?.answer).toEqual({
        start: "01-06-2026",
        end: "15-06-2026",
      });
    });

    test("should preserve answer key for other question types unchanged", () => {
      const questions: ContentType[] = [
        {
          _id: q1Id,
          type: QuestionType.Number,
          qIdx: 0,
          answer: {
            _id: new Types.ObjectId(),
            answer: 42,
          },
        } as never,
      ];

      const responseset: ResponseSetType[] = [
        {
          question: q1Id,
          response: 42,
        },
      ];

      const result = ResponseQueryService.ResponsesetProcessQuestion(
        questions,
        responseset,
      );

      expect((result[0].question as ContentType).answer?.answer).toBe(42);
    });

    describe("conditional question filtering (filterHidden: true)", () => {
      const parentQId = new Types.ObjectId();
      const childQId = new Types.ObjectId();

      const questions: ContentType[] = [
        {
          _id: parentQId,
          type: QuestionType.MultipleChoice,
          multiple: MockContentFactory.createChoiceOptions(3),
          qIdx: 0,
        } as never,
        {
          _id: childQId,
          type: QuestionType.Text,
          qIdx: 1,
          parentcontent: {
            qId: parentQId.toString(),
            qIdx: 0,
            optIdx: 1, // Requires Option 2 (idx 1)
          },
        } as never,
      ];

      test("should show child question if parent response matches  ptIdx", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: 1, // Matches optIdx 1
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(2);
      });

      test("should show child question if parent response is array including optIdx", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: [0, 1], // Includes optIdx 1
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(2);
      });

      test("should show child question if parent response is object key matching optIdx", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: { key: 1, val: "Option 2" } as never,
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(2);
      });

      test("should show child question if parent response is object key array containing optIdx", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: { key: [1, 2], val: ["Option 2", "Option 3"] } as never,
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(2);
      });

      test("should hide child question if parent response does not match optIdx and no existing child response", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: 0, // Does NOT match optIdx 1
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(1);
        expect((result[0].question as ContentType)._id).toEqual(parentQId);
      });

      test("should hide child question if parent has no response and no existing child response", () => {
        const responseset: ResponseSetType[] = [];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(1);
        expect((result[0].question as ContentType)._id).toEqual(parentQId);
      });

      test("should keep child question if child has an existing response even when parent condition is not met", () => {
        const responseset: ResponseSetType[] = [
          {
            question: parentQId,
            response: 0, // Does NOT match
          },
          {
            question: childQId,
            response: "Saved answer",
          },
        ];

        const result = ResponseQueryService.ResponsesetProcessQuestion(
          questions,
          responseset,
          { filterHidden: true },
        );

        expect(result).toHaveLength(2);
        expect(result[1].response).toBe("Saved answer");
      });
    });
  });
});
