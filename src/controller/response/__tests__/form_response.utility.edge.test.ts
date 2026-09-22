import { Response } from "express";
import FormResponseUtilityController from "../form_response.utility.controller";
import Form from "../../../model/Form.model";
import FormResponse from "../../../model/Response.model";
import { ResponseValidationService } from "../../../services/ResponseValidationService";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Form.model");
jest.mock("../../../model/Response.model");
jest.mock("../../../services/ResponseValidationService");
jest.mock("../../../services/EmailService");
jest.mock("../../../services/FormLinkService");

// Mock Puppeteer
const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockClose = jest.fn();
const mockNewPage = jest.fn().mockResolvedValue({
  setContent: mockSetContent,
  pdf: mockPdf,
});
const mockLaunch = jest.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockClose,
});

jest.mock("puppeteer", () => ({
  launch: (...args: any[]) => mockLaunch(...args),
}));

describe("FormResponseUtility Edge Case & Resilience Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;
  let mockSetHeader: jest.Mock;

  const validFormId = new Types.ObjectId().toString();
  const validResponseId = new Types.ObjectId().toString();
  const validUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockSend = jest.fn();
    mockSetHeader = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson, send: mockSend });

    mockRes = {
      status: mockStatus,
      json: mockJson,
      send: mockSend,
      setHeader: mockSetHeader,
    };
  });

  describe("ExportResponsePDF", () => {
    test("returns 404 if response is not found in database", async () => {
      mockReq = {
        params: { formId: validFormId, responseId: validResponseId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue({
        _id: validFormId,
        title: "Test Form",
      });

      (FormResponse.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await FormResponseUtilityController.ExportResponsePDF(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Response not found" }),
      );
    });

    test("successfully exports response as PDF with correct headers and attachment filename", async () => {
      mockReq = {
        params: { formId: validFormId, responseId: validResponseId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      const mockForm = {
        _id: validFormId,
        title: "Student Tracer",
        user: new Types.ObjectId(validUserId),
      };
      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(mockForm);

      const mockResponse = {
        _id: validResponseId,
        formId: validFormId,
        respondentName: "Jane Doe",
        responseset: [],
      };
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResponse),
      });

      const fakePdfBuffer = Buffer.from("%PDF-1.4 test content");
      mockPdf.mockResolvedValue(fakePdfBuffer);

      await FormResponseUtilityController.ExportResponsePDF(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockSetHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf",
      );
      expect(mockSetHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="Jane Doe_Student Tracer_Response.pdf"',
      );
      expect(mockSend).toHaveBeenCalledWith(fakePdfBuffer);
      expect(mockClose).toHaveBeenCalled();
    });

    test("cleans up Puppeteer browser process in finally block when PDF generation crashes and returns 500", async () => {
      mockReq = {
        params: { formId: validFormId, responseId: validResponseId },
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
      });

      const mockForm = {
        _id: validFormId,
        title: "Student Tracer",
        user: new Types.ObjectId(validUserId),
      };
      (
        ResponseValidationService.validateFormAccess as jest.Mock
      ).mockResolvedValue(mockForm);

      const mockResponse = {
        _id: validResponseId,
        formId: validFormId,
        respondentName: "Jane Doe",
        responseset: [],
      };
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResponse),
      });

      mockPdf.mockRejectedValue(
        new Error("Chromium OOM: Protocol error (Page.printToPDF)"),
      );

      await FormResponseUtilityController.ExportResponsePDF(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      // Verify browser was closed despite error
      expect(mockClose).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to export response as PDF",
        }),
      );
    });
  });

  describe("SendFormLinks", () => {
    test("returns 400 if emails array is empty or missing", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
        formId: validFormId,
        emails: [],
      });

      await FormResponseUtilityController.SendFormLinks(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Form ID and email list are required",
        }),
      );
    });

    test("returns 404 if form is not found or not accepting responses", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
        formId: validFormId,
        emails: ["alumni@example.com"],
      });

      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        setting: { acceptResponses: false },
      });

      await FormResponseUtilityController.SendFormLinks(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 403 if user is not the form creator", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
      };

      (ResponseValidationService.validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        user: { sub: validUserId },
        formId: validFormId,
        emails: ["alumni@example.com"],
      });

      (Form.findById as jest.Mock).mockResolvedValue({
        _id: validFormId,
        user: new Types.ObjectId(),
        setting: { acceptResponses: true },
      });

      await FormResponseUtilityController.SendFormLinks(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });
  });

  describe("GenerateFormLink", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined };

      await FormResponseUtilityController.GenerateFormLink(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 400 if formId is missing in body", async () => {
      mockReq = { user: { sub: validUserId, role: ROLE.USER }, body: {} };

      await FormResponseUtilityController.GenerateFormLink(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("returns 404 if form does not exist", async () => {
      mockReq = {
        user: { sub: validUserId, role: ROLE.USER },
        body: { formId: validFormId },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await FormResponseUtilityController.GenerateFormLink(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });
  });
});
