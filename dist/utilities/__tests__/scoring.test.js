"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const globals_1 = require("@jest/globals");
const form_response_controller_1 = __importDefault(require("../../controller/form_response.controller"));
const Content_model_1 = require("../../model/Content.model");
const Content_model_2 = __importDefault(require("../../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../../services/SolutionValidationService"));
const mockdata_1 = require("../mockdata");
// Mock dependencies
globals_1.jest.mock("../../model/Content.model");
globals_1.jest.mock("../../services/SolutionValidationService");
const mockContent = Content_model_2.default;
const mockSolutionValidationService = SolutionValidationService_1.default;
(0, globals_1.describe)("Test Scoring System", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    //Test MultpleChoice
    const [formId, parenId] = [
        mockdata_1.MockContentFactory.createFormId(),
        new mongoose_1.Types.ObjectId().toString(),
    ];
    const mockChoices = mockdata_1.MockContentFactory.createChoiceOptions(2);
    const mockChildQuestion = [
        mockdata_1.MockContentFactory.createParagraphContent({
            score: 10,
            parentcontent: {
                qId: parenId,
                qIdx: 1,
                optIdx: 0,
            },
        }),
        mockdata_1.MockContentFactory.createShortAnswerContent({
            score: 10,
            parentcontent: {
                qId: parenId,
                qIdx: 1,
                optIdx: 1,
            },
        }),
    ];
    const mockMultpleQuestionWithCondition = mockdata_1.MockContentFactory.createMultipleChoiceContent({
        multiple: mockChoices,
        conditional: mockChildQuestion.map((i, idx) => ({
            key: idx,
            contentId: i._id,
        })),
    });
    (0, globals_1.describe)("AddScore Function Tests", () => {
        (0, globals_1.describe)("Basic Scoring Tests", () => {
            it("should return score 0 when content has no answer", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createTextContent(),
                    response: "Some answer",
                };
                const mockContentData = {
                    _id: questionId,
                    score: 10,
                    type: Content_model_1.QuestionType.Text,
                    answer: null, // No answer
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(0);
                (0, globals_1.expect)(result.questionId).toBe(questionId);
            }));
            it("should return score 0 when content has no score", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createTextContent(),
                    response: "Some answer",
                };
                const mockContentData = {
                    _id: questionId,
                    score: null, // No score
                    type: Content_model_1.QuestionType.Text,
                    answer: { answer: "correct answer" },
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(0);
            }));
            it("should calculate score for simple question without conditionals", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [0, 1],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 10,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [0, 1] },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(10);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([0, 1], [0, 1], Content_model_1.QuestionType.MultipleChoice, 10);
                (0, globals_1.expect)(result.score).toBe(10);
            }));
        });
        (0, globals_1.describe)("Conditional Scoring Tests", () => {
            it("should calculate score for conditional question with child questions", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const childId1 = new mongoose_1.Types.ObjectId();
                const childId2 = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [0],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 25,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [0] },
                    conditional: [
                        { contentId: childId1, key: 0 },
                        { contentId: childId2, key: 1 },
                    ],
                };
                const mockChildQuestions = [
                    { _id: childId1, score: 10 },
                    { _id: childId2, score: 5 },
                ];
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockContent.find.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockResolvedValue(mockChildQuestions),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(10);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                // Child scores: 10 + 5 = 15
                // Question score calculation: Math.max(0, 15 - 25) = 0
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([0], [0], Content_model_1.QuestionType.MultipleChoice, 0);
                (0, globals_1.expect)(result.score).toBe(10);
            }));
            it("should handle conditional question with higher child scores", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const childId1 = new mongoose_1.Types.ObjectId();
                const childId2 = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [1],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 10,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [1] },
                    conditional: [
                        { contentId: childId1, key: 0 },
                        { contentId: childId2, key: 1 },
                    ],
                };
                const mockChildQuestions = [
                    { _id: childId1, score: 15 },
                    { _id: childId2, score: 20 },
                ];
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockContent.find.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockResolvedValue(mockChildQuestions),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(8);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                // Child scores: 15 + 20 = 35
                // Question score calculation: Math.max(0, 35 - 10) = 25
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([1], [1], Content_model_1.QuestionType.MultipleChoice, 25);
                (0, globals_1.expect)(result.score).toBe(8);
            }));
            it("should handle conditional question with some child scores being null", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const childId1 = new mongoose_1.Types.ObjectId();
                const childId2 = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [0],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 20,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [0] },
                    conditional: [
                        { contentId: childId1, key: 0 },
                        { contentId: childId2, key: 1 },
                    ],
                };
                const mockChildQuestions = [
                    { _id: childId1, score: 10 },
                    { _id: childId2, score: null }, // Null score should be filtered out
                ];
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockContent.find.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockResolvedValue(mockChildQuestions),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                // Only child score 10 should be counted (null filtered out)
                // Question score calculation: Math.max(0, 10 - 20) = 0
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([0], [0], Content_model_1.QuestionType.MultipleChoice, 0);
                (0, globals_1.expect)(result.score).toBe(5);
            }));
        });
        (0, globals_1.describe)("Different Question Types Tests", () => {
            it("should handle checkbox question scoring", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createCheckboxContent(),
                    response: [0, 2, 3],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 15,
                    type: Content_model_1.QuestionType.CheckBox,
                    answer: { answer: [0, 2, 3] },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(15);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([0, 2, 3], [0, 2, 3], Content_model_1.QuestionType.CheckBox, 15);
                (0, globals_1.expect)(result.score).toBe(15);
            }));
            it("should handle number question scoring", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createNumberContent(),
                    response: 42,
                };
                const mockContentData = {
                    _id: questionId,
                    score: 5,
                    type: Content_model_1.QuestionType.Number,
                    answer: { answer: 42 },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(5);
            }));
            it("should handle short answer question scoring", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createShortAnswerContent(),
                    response: "polymorphism is object oriented programming concept",
                };
                const mockContentData = {
                    _id: questionId,
                    score: 20,
                    type: Content_model_1.QuestionType.ShortAnswer,
                    answer: {
                        answer: "polymorphism is the ability of objects to take multiple forms",
                    },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(18);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(18);
            }));
        });
        (0, globals_1.describe)("Error Handling Tests", () => {
            it("should return score 0 when database query fails", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createTextContent(),
                    response: "Some answer",
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest
                                .fn()
                                .mockRejectedValue(new Error("Database error")),
                        }),
                    }),
                });
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(0);
                (0, globals_1.expect)(result.questionId).toBe(questionId);
            }));
            it("should return score 0 when SolutionValidationService throws error", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [0],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 10,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [0] },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockImplementation(() => {
                    throw new Error("Validation service error");
                });
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.score).toBe(0);
            }));
            it("should handle missing conditional children gracefully", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createMultipleChoiceContent(),
                    response: [0],
                };
                const mockContentData = {
                    _id: questionId,
                    score: 10,
                    type: Content_model_1.QuestionType.MultipleChoice,
                    answer: { answer: [0] },
                    conditional: [{ contentId: new mongoose_1.Types.ObjectId(), key: 0 }],
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                // Return empty array for child questions
                mockContent.find.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockResolvedValue([]),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(8);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                // Should use original question score when no child scores found
                (0, globals_1.expect)(mockSolutionValidationService.calculateResponseScore).toHaveBeenCalledWith([0], [0], Content_model_1.QuestionType.MultipleChoice, 0 // Math.max(0, 0 - 10) = 0
                );
                (0, globals_1.expect)(result.score).toBe(8);
            }));
        });
        (0, globals_1.describe)("Edge Cases", () => {
            it("should preserve original response properties", () => __awaiter(void 0, void 0, void 0, function* () {
                const questionId = new mongoose_1.Types.ObjectId();
                const mockResponse = {
                    questionId,
                    question: mockdata_1.MockContentFactory.createTextContent(),
                    response: "answer",
                    isManuallyScored: false,
                };
                const mockContentData = {
                    _id: questionId,
                    score: 5,
                    type: Content_model_1.QuestionType.Text,
                    answer: { answer: "answer" },
                    conditional: null,
                };
                mockContent.findById.mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        lean: globals_1.jest.fn().mockReturnValue({
                            exec: globals_1.jest.fn().mockResolvedValue(mockContentData),
                        }),
                    }),
                });
                mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);
                const result = yield form_response_controller_1.default.AddScore(questionId, mockResponse);
                (0, globals_1.expect)(result.questionId).toBe(questionId);
                (0, globals_1.expect)(result.question).toBe(mockResponse.question);
                (0, globals_1.expect)(result.response).toBe("answer");
                (0, globals_1.expect)(result.isManuallyScored).toBe(false);
                (0, globals_1.expect)(result.score).toBe(5);
            }));
        });
    });
});
