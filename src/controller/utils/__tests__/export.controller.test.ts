import { Response } from "express";
import {
  getAvailableColumns,
  getExportJobs,
  createExportJob,
  getExportJob,
  deleteExportJob,
  downloadExportFile,
  quickExport,
  generateExportFile,
} from "../export.controller";
import Form from "../../../model/Form.model";
import FormResponse from "../../../model/Response.model";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Form.model");
jest.mock("../../../model/Response.model");

describe("Export Controller Unit Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;
  let mockSetHeader: jest.Mock;

  const validFormId = new Types.ObjectId().toString();
  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockJson = jest.fn();
    mockSend = jest.fn();
    mockSetHeader = jest.fn();
    (FormResponse.find as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    mockStatus = jest.fn().mockReturnValue({
      json: mockJson,
      send: mockSend,
    });
    mockRes = {
      status: mockStatus,
      json: mockJson,
      send: mockSend,
      setHeader: mockSetHeader,
    };
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe("getAvailableColumns", () => {
    test("returns 404 if form does not exist", async () => {
      mockReq = { params: { formId: validFormId } };
      (Form.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await getAvailableColumns(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Form not found" }),
      );
    });

    test("returns 200 with standard and question-specific columns on success", async () => {
      mockReq = { params: { formId: validFormId } };

      const mockForm = {
        _id: validFormId,
        contents: [
          { _id: "q1", questionText: "What is your name?" },
          { _id: "q2", title: "Graduation Year" },
          { _id: "q3" }, // Fallback to question_id
        ],
      };

      (Form.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockForm),
      });

      await getAvailableColumns(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          columns: expect.arrayContaining([
            "id",
            "createdAt",
            "totalScore",
            "What is your name?",
            "Graduation Year",
            "question_q3",
          ]),
        },
      });
    });

    test("returns 500 when database error occurs", async () => {
      mockReq = { params: { formId: validFormId } };
      (Form.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error("DB Error")),
      });

      await getAvailableColumns(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe("getExportJobs", () => {
    test("returns 404 if form not found", async () => {
      mockReq = { params: { formId: validFormId }, query: {} };
      (Form.findById as jest.Mock).mockResolvedValue(null);

      await getExportJobs(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 200 with job list and pagination", async () => {
      mockReq = {
        params: { formId: validFormId },
        query: { page: "1", limit: "10" },
      };

      (Form.findById as jest.Mock).mockResolvedValue({ _id: validFormId });

      await getExportJobs(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            jobs: expect.any(Array),
            pagination: expect.objectContaining({ page: 1, limit: 10 }),
          }),
        }),
      );
    });
  });

  describe("createExportJob", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = {
        user: undefined,
        params: { formId: validFormId },
        body: {},
      };

      await createExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 404 if form not found", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        params: { formId: validFormId },
        body: { format: "csv", columns: ["id"] },
      };

      (Form.findById as jest.Mock).mockResolvedValue(null);

      await createExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 400 if export configuration is missing or invalid", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        params: { formId: validFormId },
        body: { format: "csv" }, // missing columns array
      };

      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        title: "Test Form",
      });

      await createExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid export configuration" }),
      );
    });

    test("returns 201 with created pending job on valid request", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        params: { formId: validFormId },
        body: { format: "csv", columns: ["id", "createdAt", "totalScore"] },
      };

      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        title: "Alumni Form",
      });

      await createExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Export job created successfully",
          data: expect.objectContaining({
            job: expect.objectContaining({
              formId: validFormId,
              status: "pending",
              createdBy: validUserId,
            }),
          }),
        }),
      );
    });
  });

  describe("getExportJob", () => {
    test("returns 200 with job details", async () => {
      mockReq = {
        params: { formId: validFormId, jobId: "job-123" },
        user: { sub: validUserId, role: ROLE.USER },
      };

      await getExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            job: expect.objectContaining({ id: "job-123", status: "completed" }),
          }),
        }),
      );
    });
  });

  describe("deleteExportJob", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined, params: { formId: validFormId, jobId: "job-1" } };

      await deleteExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 200 on successful deletion", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        params: { formId: validFormId, jobId: "job-1" },
      };

      await deleteExportJob(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Export job deleted successfully",
        }),
      );
    });
  });

  describe("downloadExportFile", () => {
    test("sets headers and sends CSV content", async () => {
      mockReq = { params: { filename: "export-test.csv" } };

      await downloadExportFile(mockReq as CustomRequest, mockRes as Response);

      expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockSetHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="export-test.csv"',
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("totalScore"));
    });
  });

  describe("quickExport", () => {
    test("returns 404 if form not found", async () => {
      mockReq = { params: { formId: validFormId }, query: { format: "csv" } };
      (Form.findById as jest.Mock).mockResolvedValue(null);

      await quickExport(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("exports CSV format with correct attachment headers", async () => {
      mockReq = { params: { formId: validFormId }, query: { format: "csv" } };
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        title: "TestForm",
      });

      await quickExport(mockReq as CustomRequest, mockRes as Response);

      expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(mockSetHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining('attachment; filename="TestForm_'),
      );
      expect(mockSend).toHaveBeenCalled();
    });

    test("exports JSON format with correct attachment headers", async () => {
      mockReq = { params: { formId: validFormId }, query: { format: "json" } };
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        title: "TestForm",
      });

      await quickExport(mockReq as CustomRequest, mockRes as Response);

      expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "application/json");
      expect(mockJson).toHaveBeenCalledWith(expect.any(Array));
    });

    test("returns 400 for unsupported export format", async () => {
      mockReq = { params: { formId: validFormId }, query: { format: "yaml" } };
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        title: "TestForm",
      });

      await quickExport(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unsupported format" }),
      );
    });
  });

  describe("generateExportFile helper", () => {
    test("generates CSV and properly escapes commas and double quotes", async () => {
      const config = {
        format: "csv",
        columns: ["id", "guestName", "userEmail", "totalScore"],
        includeHeaders: true,
        dateFormat: "iso",
      };

      const mockResponses = [
        {
          _id: "res-1",
          respondentName: 'John "The Great", Doe',
          respondentEmail: "john@example.com",
          totalScore: 95,
        },
      ];

      const result = await generateExportFile(config, mockResponses);

      expect(result.mimeType).toBe("text/csv");
      expect(result.content).toContain("id,guestName,userEmail,totalScore");
      // Quotes should be escaped as "" inside quoted CSV field
      expect(result.content).toContain('""The Great""');
    });

    test("generates JSON export format", async () => {
      const config = {
        format: "json",
        columns: ["id", "totalScore"],
        includeHeaders: true,
      };

      const mockResponses = [
        {
          _id: "res-2",
          totalScore: 88,
        },
      ];

      const result = await generateExportFile(config, mockResponses);

      expect(result.mimeType).toBe("application/json");
      const parsed = JSON.parse(result.content);
      expect(parsed[0].id).toBe("res-2");
      expect(parsed[0].totalScore).toBe(88);
    });
  });
});
