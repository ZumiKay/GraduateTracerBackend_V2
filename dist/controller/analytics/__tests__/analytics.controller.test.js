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
const analytics_controller_1 = __importDefault(require("../analytics.controller"));
const ResponseAnalyticsService_1 = require("../../../services/ResponseAnalyticsService");
const ResponseValidationService_1 = require("../../../services/ResponseValidationService");
const Content_model_1 = __importStar(require("../../../model/Content.model"));
const Response_model_1 = __importDefault(require("../../../model/Response.model"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../services/ResponseAnalyticsService");
jest.mock("../../../services/ResponseValidationService");
jest.mock("../../../model/Content.model");
jest.mock("../../../model/Response.model");
describe("Analytics Controller Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    const validFormId = new mongoose_1.Types.ObjectId().toString();
    const validUserId = new mongoose_1.Types.ObjectId().toString();
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
            await analytics_controller_1.default.GetFormOverviewPerformance(mockReq, mockRes);
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
            ResponseAnalyticsService_1.FormOverViewAnalyticsService.getFormAnalytics.mockResolvedValue(mockOverviewData);
            await analytics_controller_1.default.GetFormOverviewPerformance(mockReq, mockRes);
            expect(ResponseAnalyticsService_1.FormOverViewAnalyticsService.getFormAnalytics).toHaveBeenCalledWith(validFormId, "30d");
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({ data: mockOverviewData });
        });
        test("returns 500 when service throws an error", async () => {
            mockReq = {
                query: { formId: validFormId },
            };
            ResponseAnalyticsService_1.FormOverViewAnalyticsService.getFormAnalytics.mockRejectedValue(new Error("Service failure"));
            await analytics_controller_1.default.GetFormOverviewPerformance(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(500);
        });
    });
    describe("GetAnalyticsData", () => {
        test("returns 400 if formId query parameter is invalid", async () => {
            mockReq = {
                query: { formId: "invalid-id" },
            };
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("returns 403 if user is not authenticated", async () => {
            mockReq = {
                query: { formId: validFormId },
                user: undefined,
            };
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("returns early if user access to form is denied", async () => {
            mockReq = {
                query: { formId: validFormId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(null);
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(ResponseValidationService_1.ResponseValidationService.validateFormAccess).toHaveBeenCalled();
            expect(Content_model_1.default.find).not.toHaveBeenCalled();
        });
        test("returns 404 if no questions are found for the form", async () => {
            mockReq = {
                query: { formId: validFormId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            const mockForm = { _id: validFormId, title: "Survey Form" };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(mockForm);
            Content_model_1.default.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([]),
                }),
            });
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "No questions found" }));
        });
        test("returns 204 if form has 0 total responses", async () => {
            mockReq = {
                query: { formId: validFormId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            const mockForm = { _id: validFormId, title: "Survey Form" };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(mockForm);
            const qId = new mongoose_1.Types.ObjectId();
            const mockQuestions = [
                {
                    _id: qId,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    title: "Question 1",
                    qIdx: 1,
                },
            ];
            Content_model_1.default.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockQuestions),
                }),
            });
            Response_model_1.default.countDocuments.mockResolvedValue(0);
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(204);
            expect(mockJson).toHaveBeenCalledWith({
                data: { isResponse: false },
            });
        });
        test("processes choice, text, range, and number questions and returns 200 with structured analytics", async () => {
            mockReq = {
                query: { formId: validFormId },
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
            };
            const mockForm = {
                _id: validFormId,
                title: "Comprehensive Form",
                totalscore: 100,
            };
            ResponseValidationService_1.ResponseValidationService.validateFormAccess.mockResolvedValue(mockForm);
            const choiceQId = new mongoose_1.Types.ObjectId();
            const textQId = new mongoose_1.Types.ObjectId();
            const rangeQId = new mongoose_1.Types.ObjectId();
            const numberQId = new mongoose_1.Types.ObjectId();
            const mockQuestions = [
                {
                    _id: choiceQId,
                    questionId: "1",
                    type: Content_model_1.QuestionType.MultipleChoice,
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
                    type: Content_model_1.QuestionType.ShortAnswer,
                    title: "Feedback",
                    qIdx: 2,
                },
                {
                    _id: rangeQId,
                    questionId: "3",
                    type: Content_model_1.QuestionType.RangeNumber,
                    title: "Experience Level",
                    qIdx: 3,
                },
                {
                    _id: numberQId,
                    questionId: "4",
                    type: Content_model_1.QuestionType.Number,
                    title: "Age",
                    qIdx: 4,
                },
            ];
            Content_model_1.default.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockQuestions),
                }),
            });
            Response_model_1.default.countDocuments.mockResolvedValue(2);
            const mockResponses = [
                {
                    _id: new mongoose_1.Types.ObjectId(),
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
                    _id: new mongoose_1.Types.ObjectId(),
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
            Response_model_1.default.aggregate.mockResolvedValue(mockResponses);
            await analytics_controller_1.default.GetAnalyticsData(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
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
            }));
        });
    });
});
