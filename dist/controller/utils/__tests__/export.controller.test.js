"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const export_controller_1 = require("../export.controller");
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Response_model_1 = __importDefault(require("../../../model/Response.model"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../model/Form.model");
jest.mock("../../../model/Response.model");
describe("Export Controller Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockSend;
    let mockSetHeader;
    const validFormId = new mongoose_1.Types.ObjectId().toString();
    const validUserId = new mongoose_1.Types.ObjectId().toString();
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockJson = jest.fn();
        mockSend = jest.fn();
        mockSetHeader = jest.fn();
        Response_model_1.default.find.mockReturnValue({
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
            Form_model_1.default.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
            });
            await (0, export_controller_1.getAvailableColumns)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Form not found" }));
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
            Form_model_1.default.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockForm),
            });
            await (0, export_controller_1.getAvailableColumns)(mockReq, mockRes);
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
            Form_model_1.default.findById.mockReturnValue({
                populate: jest.fn().mockRejectedValue(new Error("DB Error")),
            });
            await (0, export_controller_1.getAvailableColumns)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(500);
        });
    });
    describe("getExportJobs", () => {
        test("returns 404 if form not found", async () => {
            mockReq = { params: { formId: validFormId }, query: {} };
            Form_model_1.default.findById.mockResolvedValue(null);
            await (0, export_controller_1.getExportJobs)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 200 with job list and pagination", async () => {
            mockReq = {
                params: { formId: validFormId },
                query: { page: "1", limit: "10" },
            };
            Form_model_1.default.findById.mockResolvedValue({ _id: validFormId });
            await (0, export_controller_1.getExportJobs)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    jobs: expect.any(Array),
                    pagination: expect.objectContaining({ page: 1, limit: 10 }),
                }),
            }));
        });
    });
    describe("createExportJob", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = {
                user: undefined,
                params: { formId: validFormId },
                body: {},
            };
            await (0, export_controller_1.createExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 404 if form not found", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                params: { formId: validFormId },
                body: { format: "csv", columns: ["id"] },
            };
            Form_model_1.default.findById.mockResolvedValue(null);
            await (0, export_controller_1.createExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 400 if export configuration is missing or invalid", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                params: { formId: validFormId },
                body: { format: "csv" }, // missing columns array
            };
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                title: "Test Form",
            });
            await (0, export_controller_1.createExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid export configuration" }));
        });
        test("returns 201 with created pending job on valid request", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                params: { formId: validFormId },
                body: { format: "csv", columns: ["id", "createdAt", "totalScore"] },
            };
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                title: "Alumni Form",
            });
            await (0, export_controller_1.createExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: "Export job created successfully",
                data: expect.objectContaining({
                    job: expect.objectContaining({
                        formId: validFormId,
                        status: "pending",
                        createdBy: validUserId,
                    }),
                }),
            }));
        });
    });
    describe("getExportJob", () => {
        test("returns 200 with job details", async () => {
            mockReq = {
                params: { formId: validFormId, jobId: "job-123" },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            await (0, export_controller_1.getExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    job: expect.objectContaining({ id: "job-123", status: "completed" }),
                }),
            }));
        });
    });
    describe("deleteExportJob", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, params: { formId: validFormId, jobId: "job-1" } };
            await (0, export_controller_1.deleteExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 200 on successful deletion", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                params: { formId: validFormId, jobId: "job-1" },
            };
            await (0, export_controller_1.deleteExportJob)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: "Export job deleted successfully",
            }));
        });
    });
    describe("downloadExportFile", () => {
        test("sets headers and sends CSV content", async () => {
            mockReq = { params: { filename: "export-test.csv" } };
            await (0, export_controller_1.downloadExportFile)(mockReq, mockRes);
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="export-test.csv"');
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockSend).toHaveBeenCalledWith(expect.stringContaining("totalScore"));
        });
    });
    describe("quickExport", () => {
        test("returns 404 if form not found", async () => {
            mockReq = { params: { formId: validFormId }, query: { format: "csv" } };
            Form_model_1.default.findById.mockResolvedValue(null);
            await (0, export_controller_1.quickExport)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("exports CSV format with correct attachment headers", async () => {
            mockReq = { params: { formId: validFormId }, query: { format: "csv" } };
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                title: "TestForm",
            });
            await (0, export_controller_1.quickExport)(mockReq, mockRes);
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining('attachment; filename="TestForm_'));
            expect(mockSend).toHaveBeenCalled();
        });
        test("exports JSON format with correct attachment headers", async () => {
            mockReq = { params: { formId: validFormId }, query: { format: "json" } };
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                title: "TestForm",
            });
            await (0, export_controller_1.quickExport)(mockReq, mockRes);
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "application/json");
            expect(mockJson).toHaveBeenCalledWith(expect.any(Array));
        });
        test("returns 400 for unsupported export format", async () => {
            mockReq = { params: { formId: validFormId }, query: { format: "yaml" } };
            Form_model_1.default.findById.mockResolvedValue({
                _id: validFormId,
                title: "TestForm",
            });
            await (0, export_controller_1.quickExport)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Unsupported format" }));
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
            const result = await (0, export_controller_1.generateExportFile)(config, mockResponses);
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
            const result = await (0, export_controller_1.generateExportFile)(config, mockResponses);
            expect(result.mimeType).toBe("application/json");
            const parsed = JSON.parse(result.content);
            expect(parsed[0].id).toBe("res-2");
            expect(parsed[0].totalScore).toBe(88);
        });
    });
});
