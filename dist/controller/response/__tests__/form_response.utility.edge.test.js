"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const form_response_utility_controller_1 = __importDefault(require("../form_response.utility.controller"));
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Response_model_1 = __importDefault(require("../../../model/Response.model"));
const ResponseValidationService_1 = require("../../../services/ResponseValidationService");
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
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
    launch: (...args) => mockLaunch(...args),
}));
describe("FormResponseUtility Edge Case & Resilience Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockSend;
    let mockSetHeader;
    const validFormId = new mongoose_1.Types.ObjectId().toString();
    const validResponseId = new mongoose_1.Types.ObjectId().toString();
    const validUserId = new mongoose_1.Types.ObjectId().toString();
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
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue({
                _id: validFormId,
                title: "Test Form",
            });
            Response_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            await form_response_utility_controller_1.default.ExportResponsePDF(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Response not found" }));
        });
        test("successfully exports response as PDF with correct headers and attachment filename", async () => {
            mockReq = {
                params: { formId: validFormId, responseId: validResponseId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            const mockForm = {
                _id: validFormId,
                title: "Student Tracer",
                user: new mongoose_1.Types.ObjectId(validUserId),
            };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(mockForm);
            const mockResponse = {
                _id: validResponseId,
                formId: validFormId,
                respondentName: "Jane Doe",
                responseset: [],
            };
            Response_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockResponse),
            });
            const fakePdfBuffer = Buffer.from("%PDF-1.4 test content");
            mockPdf.mockResolvedValue(fakePdfBuffer);
            await form_response_utility_controller_1.default.ExportResponsePDF(mockReq, mockRes);
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="Jane Doe_Student Tracer_Response.pdf"');
            expect(mockSend).toHaveBeenCalledWith(fakePdfBuffer);
            expect(mockClose).toHaveBeenCalled();
        });
        test("cleans up Puppeteer browser process in finally block when PDF generation crashes and returns 500", async () => {
            mockReq = {
                params: { formId: validFormId, responseId: validResponseId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            const mockForm = {
                _id: validFormId,
                title: "Student Tracer",
                user: new mongoose_1.Types.ObjectId(validUserId),
            };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(mockForm);
            const mockResponse = {
                _id: validResponseId,
                formId: validFormId,
                respondentName: "Jane Doe",
                responseset: [],
            };
            Response_model_1.default.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockResponse),
            });
            mockPdf.mockRejectedValue(new Error("Chromium OOM: Protocol error (Page.printToPDF)"));
            await form_response_utility_controller_1.default.ExportResponsePDF(mockReq, mockRes);
            // Verify browser was closed despite error
            expect(mockClose).toHaveBeenCalled();
            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to export response as PDF",
            }));
        });
    });
    describe("SendFormLinks", () => {
        test("returns 400 if emails array is empty or missing", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
                formId: validFormId,
                emails: [],
            });
            await form_response_utility_controller_1.default.SendFormLinks(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Form ID and email list are required",
            }));
        });
        test("returns 404 if form is not found or not accepting responses", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
                formId: validFormId,
                emails: ["alumni@example.com"],
            });
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                setting: { acceptResponses: false },
            });
            await form_response_utility_controller_1.default.SendFormLinks(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 403 if user is not the form creator", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
                formId: validFormId,
                emails: ["alumni@example.com"],
            });
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                user: new mongoose_1.Types.ObjectId(),
                setting: { acceptResponses: true },
            });
            await form_response_utility_controller_1.default.SendFormLinks(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
    });
    describe("GenerateFormLink", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined };
            await form_response_utility_controller_1.default.GenerateFormLink(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 400 if formId is missing in body", async () => {
            mockReq = { user: { sub: validUserId, role: User_model_1.ROLE.USER }, body: {} };
            await form_response_utility_controller_1.default.GenerateFormLink(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("returns 404 if form does not exist", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                body: { formId: validFormId },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });
            await form_response_utility_controller_1.default.GenerateFormLink(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
    });
});
