"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Response_model_1 = __importStar(require("../../model/Response.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const Content_model_1 = __importStar(require("../../model/Content.model"));
const ResponseQueryService_1 = require("../ResponseQueryService");
const ResponseValidationService_1 = require("../ResponseValidationService");
const FormValidationService_1 = require("../FormValidationService");
const fingerprint_1 = require("../../utilities/fingerprint");
const bcrypt_1 = require("bcrypt");
const formHelpers = __importStar(require("../../utilities/formHelpers"));
const mockdata_1 = require("../../utilities/mockdata");
// Mock dependencies
jest.mock("../../model/Response.model");
jest.mock("../../model/Form.model");
jest.mock("../../model/Content.model");
jest.mock("../ResponseValidationService");
jest.mock("../FormValidationService");
jest.mock("../../utilities/fingerprint");
jest.mock("bcrypt");
const createMockQuery = (resolvedValue) => {
    const query = {
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
    const formId = new mongoose_1.Types.ObjectId();
    const formIdStr = formId.toString();
    const responseId1 = new mongoose_1.Types.ObjectId();
    const responseId2 = new mongoose_1.Types.ObjectId();
    const q1Id = new mongoose_1.Types.ObjectId();
    const q2Id = new mongoose_1.Types.ObjectId();
    beforeEach(() => {
        jest.clearAllMocks();
        ResponseValidationService_1.ResponseValidationService.createPaginationResponse.mockImplementation((page, limit, totalCount) => ({
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1,
        }));
        ResponseValidationService_1.ResponseValidationService.buildFilterQuery.mockImplementation((filters) => ({
            formId: new mongoose_1.Types.ObjectId(filters.formId),
        }));
        ResponseValidationService_1.ResponseValidationService.buildSortOptions.mockImplementation((sortBy, sortOrder) => ({
            [sortBy || "submittedAt"]: sortOrder === "desc" ? -1 : 1,
        }));
        FormValidationService_1.FormValidationService.validateContent.mockReturnValue({
            isValid: true,
        });
        fingerprint_1.FingerprintService.extractFingerprintFromRequest.mockReturnValue({
            platform: "macOS",
            timezone: "Asia/Bangkok",
        });
        fingerprint_1.FingerprintService.getClientIP.mockReturnValue("192.168.1.100");
        bcrypt_1.compareSync.mockReturnValue(true);
        jest.spyOn(formHelpers, "getLastQuestionIdx").mockResolvedValue(0);
    });
    describe("getResponsesByFormId", () => {
        test("should fetch paginated responses and add responseCount by email", async () => {
            const mockResponses = [
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
            Response_model_1.default.find.mockReturnValue(createMockQuery(mockResponses));
            Response_model_1.default.countDocuments.mockResolvedValue(2);
            Response_model_1.default.aggregate.mockResolvedValue([
                { _id: "user1@example.com", count: 3 },
                { _id: "user2@example.com", count: 1 },
            ]);
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formIdStr, 1, 10);
            expect(Response_model_1.default.find).toHaveBeenCalledWith({ formId: formIdStr });
            expect(result.responses).toHaveLength(2);
            expect(result.responses[0].responseCount).toBe(3);
            expect(result.responses[1].responseCount).toBe(1);
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
            const mockResponses = [
                {
                    _id: responseId1,
                    formId,
                    respondentEmail: undefined,
                    respondentName: "Anonymous",
                },
            ];
            Response_model_1.default.find.mockReturnValue(createMockQuery(mockResponses));
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formIdStr, 1, 10);
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].responseCount).toBe(0);
            expect(Response_model_1.default.aggregate).not.toHaveBeenCalled();
        });
        test("should default responseCount to 0 if email is not found in aggregate map", async () => {
            const mockResponses = [
                {
                    _id: responseId1,
                    formId,
                    respondentEmail: "unknown@example.com",
                },
            ];
            Response_model_1.default.find.mockReturnValue(createMockQuery(mockResponses));
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            Response_model_1.default.aggregate.mockResolvedValue([]);
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formIdStr, 1, 10);
            expect(result.responses[0].responseCount).toBe(0);
        });
    });
    describe("getResponsebyUserIdWithPagination", () => {
        let mockReq;
        let mockRes;
        let jsonMock;
        let statusMock;
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
                },
            };
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 400, message: "Invalid form ID" }));
        });
        test("should return 400 if page or resIdx is invalid or negative", async () => {
            mockReq = {
                params: {
                    formId: formIdStr,
                    page: "invalid",
                    resIdx: "-1",
                    userId: "user-123",
                },
            };
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                code: 400,
                message: "Invalid page or response index",
            }));
        });
        test("should return 404 if responseIdx is greater than or equal to totalCount", async () => {
            mockReq = {
                params: {
                    formId: formIdStr,
                    page: "1",
                    resIdx: "5",
                    userId: "user-123",
                },
            };
            Response_model_1.default.countDocuments.mockResolvedValue(3);
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                code: 404,
                message: "Response index out of range",
            }));
        });
        test("should return 404 if response is not found", async () => {
            mockReq = {
                params: {
                    formId: formIdStr,
                    page: "1",
                    resIdx: "0",
                    userId: "user-123",
                },
            };
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            Response_model_1.default.findOne.mockReturnValue({
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null),
            });
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(404);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 404, message: "Response not found" }));
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
                },
            };
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            Response_model_1.default.findOne.mockReturnValue({
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockResponse),
            });
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                code: 200,
                data: expect.objectContaining({
                    response: mockResponse,
                    pagination: expect.objectContaining({
                        page: 1,
                        limit: 1,
                        totalCount: 1,
                    }),
                }),
            }));
        });
        test("should return 500 when an exception occurs", async () => {
            mockReq = {
                params: {
                    formId: formIdStr,
                    page: "1",
                    resIdx: "0",
                    userId: "user-123",
                },
            };
            Response_model_1.default.countDocuments.mockRejectedValue(new Error("Database error"));
            await ResponseQueryService_1.ResponseQueryService.getResponsebyUserIdWithPagination(mockReq, mockRes);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                code: 500,
                message: "Internal server error",
            }));
        });
    });
    describe("getResponsesWithFilters", () => {
        test("should fetch paginated responses with built filters and sort options", async () => {
            const filters = {
                formId: formIdStr,
                page: 1,
                limit: 10,
                sortBy: "createdAt",
                sortOrder: "desc",
            };
            const mockResponses = [
                { _id: responseId1, respondentEmail: "test@example.com" },
            ];
            Response_model_1.default.find.mockReturnValue(createMockQuery(mockResponses));
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            Response_model_1.default.aggregate.mockResolvedValue([
                { _id: "test@example.com", count: 1 },
            ]);
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesWithFilters(filters);
            expect(ResponseValidationService_1.ResponseValidationService.buildFilterQuery).toHaveBeenCalledWith(filters);
            expect(ResponseValidationService_1.ResponseValidationService.buildSortOptions).toHaveBeenCalledWith("createdAt", "desc");
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].responseCount).toBe(1);
        });
        test("should call getGroupedResponses when group parameter is 'respondentEmail'", async () => {
            const filters = {
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
            Response_model_1.default.aggregate
                .mockResolvedValueOnce([{ total: 1 }]) // Count pipeline
                .mockResolvedValueOnce(mockGroupedResponses); // Group pipeline
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesWithFilters(filters);
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
            const sortOptions = { respondentEmail: 1 };
            Response_model_1.default.aggregate
                .mockResolvedValueOnce([{ total: 5 }])
                .mockResolvedValueOnce([
                {
                    respondentEmail: "a@example.com",
                    responseCount: 3,
                },
            ]);
            const result = await ResponseQueryService_1.ResponseQueryService.getGroupedResponses(query, 2, 2, sortOptions);
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
            Response_model_1.default.find.mockReturnValue(createMockQuery(mockResponses));
            Response_model_1.default.countDocuments.mockResolvedValue(1);
            Response_model_1.default.aggregate.mockResolvedValue([
                { _id: "user@example.com", count: 1 },
            ]);
            const result = await ResponseQueryService_1.ResponseQueryService.getUserResponses({
                page: 1,
                limit: 10,
                user: "user-123",
                formId: formIdStr,
            });
            expect(Response_model_1.default.find).toHaveBeenCalledWith({
                formId: formIdStr,
                $or: [{ user: "user-123" }, { respondentEmail: "user-123" }],
            });
            expect(result.responses).toHaveLength(1);
        });
    });
    describe("getGuestResponses", () => {
        test("should find guest responses with userId null", async () => {
            const mockGuestResponses = [{ _id: responseId1, userId: null, formId }];
            Response_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockGuestResponses),
            });
            const result = await ResponseQueryService_1.ResponseQueryService.getGuestResponses(formIdStr);
            expect(Response_model_1.default.find).toHaveBeenCalledWith({
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
        const mockContents = [
            {
                _id: q1Id,
                qIdx: 0,
                title: mockdata_1.MockContentFactory.createContentTitle("Question 1"),
                type: Content_model_1.QuestionType.MultipleChoice,
                multiple: mockdata_1.MockContentFactory.createChoiceOptions(3),
                score: 10,
                require: true,
                page: 1,
            },
            {
                _id: q2Id,
                qIdx: 1,
                title: mockdata_1.MockContentFactory.createContentTitle("Question 2"),
                type: Content_model_1.QuestionType.Text,
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
            await expect(ResponseQueryService_1.ResponseQueryService.getPublicFormData("invalid-id", 1, {})).rejects.toThrow("Invalid form ID");
        });
        test("should throw error if form is not found", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            await expect(ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, {})).rejects.toThrow("Form not found");
        });
        test("should throw error if form is not accepting responses and not in preview", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        ...mockForm,
                        setting: { acceptResponses: false },
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            await expect(ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, {}, false)).rejects.toThrow("Form is no longer accepting responses");
        });
        test("should allow accessing form if not accepting responses but isPreview is true", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        ...mockForm,
                        setting: { acceptResponses: false },
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            const result = await ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, {}, true);
            expect(result).toHaveProperty("contents");
            expect(result.title).toBe("Public Feedback Form");
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
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        ...mockForm,
                        setting: { submitonce: true, email: true },
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            Response_model_1.default.findOne.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(existingResponse),
                }),
            });
            const mockReq = {
                formsession: { email: "submitter@example.com" },
            };
            const result = await ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, mockReq, false);
            expect(result).toHaveProperty("isResponsed");
            expect(result.isResponsed.message).toBe("You already submitted response");
            expect(result.isResponsed.responseId).toEqual(responseId1);
            expect(result.isResponsed.maxScore).toBe(100);
        });
        test("should return isResponsed if submitonce is true and IP/fingerprint match score is >= 70", async () => {
            const existingResponse = {
                _id: responseId1,
                totalScore: 50,
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                submittedAt: new Date(),
                respondentIP: "hashed-ip",
                deviceInfo: {
                    platform: "macOS",
                    timezone: "Asia/Bangkok",
                },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        ...mockForm,
                        setting: { submitonce: true, email: false },
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            Response_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([existingResponse]),
                }),
            });
            const mockReq = {
                headers: {},
            };
            const result = await ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, mockReq, false);
            expect(result).toHaveProperty("isResponsed");
            expect(result.isResponsed.message).toBe("You already submitted response");
        });
        test("should return contentValidation errors if any question validation fails", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockForm),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            FormValidationService_1.FormValidationService.validateContent.mockReturnValueOnce({
                isValid: false,
                errors: ["Invalid score"],
            });
            const result = await ResponseQueryService_1.ResponseQueryService.getPublicFormData(formIdStr, 1, {});
            expect(result).toHaveProperty("contentValidation");
            expect(result.contentValidation[0].isValid).toBe(false);
        });
    });
    describe("bulkDeleteResponses", () => {
        test("should throw error if formId is invalid ObjectId", async () => {
            await expect(ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses([responseId1.toString()], "invalid-form-id")).rejects.toThrow("Invalid form ID: invalid-form-id");
        });
        test("should throw error if any responseId is invalid ObjectId", async () => {
            await expect(ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses([responseId1.toString(), "invalid-res-id"], formIdStr)).rejects.toThrow("Invalid response ID(s): invalid-res-id");
        });
        test("should throw error if responseIds is empty", async () => {
            await expect(ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses([], formIdStr)).rejects.toThrow("No valid response IDs provided");
        });
        test("should throw error if some responses do not exist", async () => {
            Response_model_1.default.countDocuments.mockResolvedValue(1); // Expecting 2
            await expect(ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses([responseId1.toString(), responseId2.toString()], formIdStr)).rejects.toThrow("Some responses don't exist or don't belong to this form");
        });
        test("should successfully delete matching responses", async () => {
            Response_model_1.default.countDocuments.mockResolvedValue(2);
            Response_model_1.default.deleteMany.mockResolvedValue({
                deletedCount: 2,
            });
            const result = await ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses([responseId1.toString(), responseId2.toString()], formIdStr);
            expect(Response_model_1.default.deleteMany).toHaveBeenCalledWith({
                _id: { $in: [responseId1, responseId2] },
                formId: new mongoose_1.Types.ObjectId(formIdStr),
            });
            expect(result).toEqual({ deletedCount: 2 });
        });
    });
    describe("GetResponseById", () => {
        test("should return null if response is not found", async () => {
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            const result = await ResponseQueryService_1.ResponseQueryService.GetResponseById({
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
            const mockContents = [
                {
                    _id: q1Id,
                    qIdx: 0,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    multiple: mockdata_1.MockContentFactory.createChoiceOptions(3),
                },
            ];
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockResponse),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockContents),
                    }),
                }),
            });
            Response_model_1.default.countDocuments.mockResolvedValue(4);
            const result = await ResponseQueryService_1.ResponseQueryService.GetResponseById({
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
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockResponse),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            const result = await ResponseQueryService_1.ResponseQueryService.GetResponseById({
                id: responseId1.toString(),
                formId: formIdStr,
            });
            expect(result?.responseCount).toBe(0);
            expect(Response_model_1.default.countDocuments).not.toHaveBeenCalled();
        });
    });
    describe("ResponsesetProcessQuestion", () => {
        test("should throw error 'Invalid Question' if any question has no _id", () => {
            const questions = [
                {
                    _id: undefined,
                    type: Content_model_1.QuestionType.Text,
                },
            ];
            expect(() => ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, [])).toThrow("Invalid Question");
        });
        test("should format single choice question responses with key and val", () => {
            const choices = mockdata_1.MockContentFactory.createChoiceOptions(3);
            const questions = [
                {
                    _id: q1Id,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    multiple: choices,
                    qIdx: 0,
                },
            ];
            const responseset = [
                {
                    question: q1Id,
                    response: 1,
                },
            ];
            const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset);
            expect(result[0].response).toEqual({
                key: 1,
                val: "Option 2",
            });
        });
        test("should format multiple choice / checkbox responses with key array and val array", () => {
            const choices = mockdata_1.MockContentFactory.createChoiceOptions(4);
            const questions = [
                {
                    _id: q1Id,
                    type: Content_model_1.QuestionType.CheckBox,
                    checkbox: choices,
                    qIdx: 0,
                },
            ];
            const responseset = [
                {
                    question: q1Id,
                    response: [0, 2],
                },
            ];
            const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset);
            expect(result[0].response).toEqual({
                key: [0, 2],
                val: ["Option 1", "Option 3"],
            });
        });
        test("should format Date question answer key to DD/MM/YYYY", () => {
            const questions = [
                {
                    _id: q1Id,
                    type: Content_model_1.QuestionType.Date,
                    qIdx: 0,
                    answer: {
                        _id: new mongoose_1.Types.ObjectId(),
                        answer: "2026-06-01",
                    },
                },
            ];
            const responseset = [
                {
                    question: q1Id,
                    response: "2026-06-01",
                },
            ];
            const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset);
            expect(result[0].question.answer?.answer).toBe("01-06-2026");
        });
        test("should format RangeDate question answer key start and end to DD/MM/YYYY", () => {
            const questions = [
                {
                    _id: q1Id,
                    type: Content_model_1.QuestionType.RangeDate,
                    qIdx: 0,
                    answer: {
                        _id: new mongoose_1.Types.ObjectId(),
                        answer: {
                            start: "2026-06-01",
                            end: "2026-06-15",
                        },
                    },
                },
            ];
            const responseset = [
                {
                    question: q1Id,
                    response: { start: "2026-06-01", end: "2026-06-15" },
                },
            ];
            const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset);
            expect(result[0].question.answer?.answer).toEqual({
                start: "01-06-2026",
                end: "15-06-2026",
            });
        });
        test("should preserve answer key for other question types unchanged", () => {
            const questions = [
                {
                    _id: q1Id,
                    type: Content_model_1.QuestionType.Number,
                    qIdx: 0,
                    answer: {
                        _id: new mongoose_1.Types.ObjectId(),
                        answer: 42,
                    },
                },
            ];
            const responseset = [
                {
                    question: q1Id,
                    response: 42,
                },
            ];
            const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset);
            expect(result[0].question.answer?.answer).toBe(42);
        });
        describe("conditional question filtering (filterHidden: true)", () => {
            const parentQId = new mongoose_1.Types.ObjectId();
            const childQId = new mongoose_1.Types.ObjectId();
            const questions = [
                {
                    _id: parentQId,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    multiple: mockdata_1.MockContentFactory.createChoiceOptions(3),
                    qIdx: 0,
                },
                {
                    _id: childQId,
                    type: Content_model_1.QuestionType.Text,
                    qIdx: 1,
                    parentcontent: {
                        qId: parentQId.toString(),
                        qIdx: 0,
                        optIdx: 1, // Requires Option 2 (idx 1)
                    },
                },
            ];
            test("should show child question if parent response matches  ptIdx", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: 1, // Matches optIdx 1
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(2);
            });
            test("should show child question if parent response is array including optIdx", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: [0, 1], // Includes optIdx 1
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(2);
            });
            test("should show child question if parent response is object key matching optIdx", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: { key: 1, val: "Option 2" },
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(2);
            });
            test("should show child question if parent response is object key array containing optIdx", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: { key: [1, 2], val: ["Option 2", "Option 3"] },
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(2);
            });
            test("should hide child question if parent response does not match optIdx and no existing child response", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: 0, // Does NOT match optIdx 1
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(1);
                expect(result[0].question._id).toEqual(parentQId);
            });
            test("should hide child question if parent has no response and no existing child response", () => {
                const responseset = [];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(1);
                expect(result[0].question._id).toEqual(parentQId);
            });
            test("should keep child question if child has an existing response even when parent condition is not met", () => {
                const responseset = [
                    {
                        question: parentQId,
                        response: 0, // Does NOT match
                    },
                    {
                        question: childQId,
                        response: "Saved answer",
                    },
                ];
                const result = ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion(questions, responseset, { filterHidden: true });
                expect(result).toHaveLength(2);
                expect(result[1].response).toBe("Saved answer");
            });
        });
    });
});
