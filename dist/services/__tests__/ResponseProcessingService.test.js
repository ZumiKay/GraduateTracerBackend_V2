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
const Content_model_1 = __importStar(require("../../model/Content.model"));
const Form_model_1 = __importStar(require("../../model/Form.model"));
const User_model_1 = __importDefault(require("../../model/User.model"));
const EmailService_1 = __importDefault(require("../EmailService"));
const RespondentTrackingService_1 = require("../RespondentTrackingService");
const ResponseProcessingService_1 = require("../ResponseProcessingService");
// Mock dependencies
jest.mock("../../model/Response.model");
jest.mock("../../model/Content.model");
jest.mock("../../model/Form.model");
jest.mock("../../model/User.model");
jest.mock("../EmailService");
jest.mock("../RespondentTrackingService");
describe("ResponseProcessingService", () => {
    const formId = new mongoose_1.Types.ObjectId();
    const userId = new mongoose_1.Types.ObjectId();
    const q1Id = new mongoose_1.Types.ObjectId();
    const q2Id = new mongoose_1.Types.ObjectId();
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe("processNormalFormSubmission", () => {
        const mockQuestions = [
            {
                _id: q1Id,
                formId,
                type: Content_model_1.QuestionType.Text,
                require: true,
                questionId: "1",
            },
            {
                _id: q2Id,
                formId,
                type: Content_model_1.QuestionType.Number,
                require: false,
                questionId: "2",
            },
        ];
        test("should throw error if form is not found", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            await expect(ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission({
                formId: formId.toString(),
                responseset: [],
                req: {},
            })).rejects.toThrow("Form not found");
        });
        test("should throw error if form requires email but no respondentEmail is provided", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: formId,
                        setting: { email: true },
                    }),
                }),
            });
            await expect(ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission({
                formId: formId.toString(),
                responseset: [],
                req: {},
            })).rejects.toThrow("Email is required for this form");
        });
        test("should throw error if form is submitonce and respondent has already submitted", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: formId,
                        setting: { submitonce: true },
                    }),
                }),
            });
            RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists.mockResolvedValue({
                hasResponded: true,
            });
            await expect(ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission({
                formId: formId.toString(),
                responseset: [],
                req: {},
            })).rejects.toThrow("Form already submitted");
        });
        test("should throw error if a required question is missing or empty", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: formId,
                        setting: {},
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockQuestions),
            });
            const submissionData = {
                formId: formId.toString(),
                responseset: [
                    { question: q1Id.toString(), response: "" }, // required but empty
                    { question: q2Id.toString(), response: 25 },
                ],
                req: {},
            };
            await expect(ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission(submissionData)).rejects.toThrow("Require");
        });
        test("should throw error if answer format is invalid", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: formId,
                        setting: {},
                    }),
                }),
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockQuestions),
            });
            const submissionData = {
                formId: formId.toString(),
                responseset: [
                    { question: q1Id.toString(), response: "Valid text" },
                    { question: q2Id.toString(), response: "Not a number" }, // Invalid for Number type
                ],
                req: {},
            };
            await expect(ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission(submissionData)).rejects.toThrow();
        });
        test("should successfully save response and return confirmation", async () => {
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: formId,
                        setting: { email: true },
                    }),
                }),
            });
            User_model_1.default.findOne.mockResolvedValue({
                _id: userId,
                email: "user@example.com",
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockQuestions),
            });
            Response_model_1.default.create.mockResolvedValue({
                _id: new mongoose_1.Types.ObjectId(),
            });
            const submissionData = {
                formId: formId.toString(),
                respondentEmail: "user@example.com",
                respondentName: "John Doe",
                responseset: [
                    { question: q1Id.toString(), response: "Valid text" },
                    { question: q2Id.toString(), response: 42 },
                ],
                req: {},
            };
            const result = await ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission(submissionData);
            expect(result).toEqual({ message: "Form Submitted" });
            expect(Response_model_1.default.create).toHaveBeenCalledWith(expect.objectContaining({
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                respondentType: Response_model_1.RespondentType.user,
                respondentEmail: "user@example.com",
            }));
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                         processFormSubmission Tests                        */
    /* -------------------------------------------------------------------------- */
    describe("processFormSubmission", () => {
        const mockForm = {
            _id: formId,
            title: "Quiz Form",
            totalscore: 20,
            setting: {
                email: true,
                returnscore: Form_model_1.returnscore.partial,
            },
        };
        test("should return null if responseset is empty", async () => {
            const result = await ResponseProcessingService_1.ResponseProcessingService.processFormSubmission({ formId, responseset: [] }, mockForm);
            expect(result).toBeNull();
        });
        test("should return null if form requires email but none is provided", async () => {
            const result = await ResponseProcessingService_1.ResponseProcessingService.processFormSubmission({
                formId,
                responseset: [{ question: q1Id.toString(), response: "Ans" }],
            }, mockForm);
            expect(result).toBeNull();
        });
        test("should process auto-scored submission, save response, and send email", async () => {
            const responseId = new mongoose_1.Types.ObjectId();
            const sendResponseResultsMock = jest.fn().mockResolvedValue(true);
            EmailService_1.default.mockImplementation(() => ({
                sendResponseResults: sendResponseResultsMock,
            }));
            User_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    select: jest
                        .fn()
                        .mockResolvedValue({ _id: userId, email: "user@example.com" }),
                }),
            });
            // Mock addScore
            jest.spyOn(ResponseProcessingService_1.ResponseProcessingService, "addScore").mockResolvedValue({
                response: [
                    {
                        question: q1Id,
                        response: "Answer",
                        score: 10,
                        scoringMethod: Response_model_1.ScoringMethod.AUTO,
                    },
                ],
                isNonScore: false,
                hasUnansweredScoredQuestion: false,
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            });
            Response_model_1.default.create.mockResolvedValue({
                _id: responseId,
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.processFormSubmission({
                formId,
                respondentEmail: "user@example.com",
                responseset: [{ question: q1Id.toString(), response: "Answer" }],
            }, mockForm);
            expect(result.responseId).toBe(responseId.toString());
            expect(result.totalScore).toBe(10);
            expect(result.message).toBe("This your final score");
            expect(sendResponseResultsMock).toHaveBeenCalledWith(expect.objectContaining({
                to: "user@example.com",
                formTitle: "Quiz Form",
                totalScore: 10,
                maxScore: 20,
            }));
        });
        test("should handle partial score return with manual grading notice", async () => {
            const responseId = new mongoose_1.Types.ObjectId();
            User_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockReturnValue({
                    select: jest.fn().mockResolvedValue(null),
                }),
            });
            jest.spyOn(ResponseProcessingService_1.ResponseProcessingService, "addScore").mockResolvedValue({
                response: [
                    {
                        question: q1Id,
                        response: "Auto Answer",
                        score: 5,
                        scoringMethod: Response_model_1.ScoringMethod.AUTO,
                    },
                    {
                        question: q2Id,
                        response: "Manual Answer",
                        scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                    },
                ],
                isNonScore: false,
                hasUnansweredScoredQuestion: false,
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            });
            Response_model_1.default.create.mockResolvedValue({
                _id: responseId,
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.processFormSubmission({
                formId,
                respondentEmail: "guest@example.com",
                responseset: [
                    { question: q1Id.toString(), response: "Auto Answer" },
                    { question: q2Id.toString(), response: "Manual Answer" },
                ],
            }, mockForm);
            expect(result.message).toBe("Totalscore is partial only might change when form owner return your score.");
            expect(Response_model_1.default.create).toHaveBeenCalledWith(expect.objectContaining({
                completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
            }));
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                         updateResponseScores Tests                         */
    /* -------------------------------------------------------------------------- */
    describe("updateResponseScores", () => {
        const responseId = new mongoose_1.Types.ObjectId().toString();
        test("should throw error for empty or invalid scores array", async () => {
            await expect(ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores: [],
            })).rejects.toThrow("Invalid scores data");
        });
        test("should throw error if response is not found", async () => {
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });
            await expect(ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores: [{ questionId: q1Id.toString(), score: 10 }],
            })).rejects.toThrow("Response not found");
        });
        test("should update score and comment and save response", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const mockResponse = {
                _id: responseId,
                responseset: [
                    {
                        question: q1Id.toString(),
                        score: 0,
                        scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        comment: undefined,
                    },
                    {
                        question: q2Id.toString(),
                        score: 5,
                        scoringMethod: Response_model_1.ScoringMethod.AUTO,
                    },
                ],
                totalScore: 5,
                completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
                save: mockSave,
            };
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockResponse),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores: [
                    {
                        questionId: q1Id.toString(),
                        score: 8,
                        comment: "Great improvement",
                    },
                ],
            });
            expect(result.success).toBe(true);
            expect(result.updatedScores).toBe(1);
            expect(result.totalScore).toBe(13);
            expect(mockResponse.responseset[0].score).toBe(8);
            expect(mockResponse.responseset[0].comment).toBe("Great improvement");
            expect(mockResponse.completionStatus).toBe(Response_model_1.ResponseCompletionStatus.completed);
            expect(mockSave).toHaveBeenCalled();
        });
        test("should return message when no matching questions found", async () => {
            const mockResponse = {
                _id: responseId,
                responseset: [{ question: q1Id.toString(), score: 5 }],
                save: jest.fn(),
            };
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockResponse),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores: [{ questionId: new mongoose_1.Types.ObjectId().toString(), score: 10 }],
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe("No matching questions found to update");
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                      batchUpdateResponseScores Tests                       */
    /* -------------------------------------------------------------------------- */
    describe("batchUpdateResponseScores", () => {
        test("should batch update multiple response scores", async () => {
            const update1 = {
                responseId: new mongoose_1.Types.ObjectId().toString(),
                scores: [{ questionId: q1Id.toString(), score: 10 }],
            };
            const update2 = {
                responseId: new mongoose_1.Types.ObjectId().toString(),
                scores: [{ questionId: q2Id.toString(), score: 5 }],
            };
            jest
                .spyOn(ResponseProcessingService_1.ResponseProcessingService, "updateResponseScores")
                .mockResolvedValueOnce({
                success: true,
                updatedScores: 1,
                totalScore: 10,
            })
                .mockResolvedValueOnce({
                success: true,
                updatedScores: 1,
                totalScore: 5,
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.batchUpdateResponseScores([
                update1,
                update2,
            ]);
            expect(result.success).toBe(true);
            expect(result.total).toBe(2);
            expect(result.successful).toBe(2);
            expect(result.failed).toBe(0);
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                     recalculateResponseTotalScore Tests                    */
    /* -------------------------------------------------------------------------- */
    describe("recalculateResponseTotalScore", () => {
        const responseId = new mongoose_1.Types.ObjectId().toString();
        test("should throw error if response is not found", async () => {
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });
            await expect(ResponseProcessingService_1.ResponseProcessingService.recalculateResponseTotalScore(responseId)).rejects.toThrow("Response not found");
        });
        test("should correct totalScore if mismatch is found", async () => {
            const mockSave = jest.fn().mockResolvedValue(true);
            const mockResponse = {
                responseset: [{ score: 5 }, { score: 10 }],
                totalScore: 0, // Out of sync
                save: mockSave,
            };
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockResponse),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.recalculateResponseTotalScore(responseId);
            expect(result.corrected).toBe(true);
            expect(result.newTotal).toBe(15);
            expect(mockResponse.totalScore).toBe(15);
            expect(mockSave).toHaveBeenCalled();
        });
        test("should not update if totalScore is already correct", async () => {
            const mockSave = jest.fn();
            const mockResponse = {
                responseset: [{ score: 5 }, { score: 5 }],
                totalScore: 10,
                save: mockSave,
            };
            Response_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockResponse),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.recalculateResponseTotalScore(responseId);
            expect(result.corrected).toBe(false);
            expect(result.totalScore).toBe(10);
            expect(mockSave).not.toHaveBeenCalled();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                        validateFormSubmission Tests                        */
    /* -------------------------------------------------------------------------- */
    describe("validateFormSubmission", () => {
        test("should return error if form is not found", async () => {
            Form_model_1.default.findById.mockResolvedValue(null);
            const result = await ResponseProcessingService_1.ResponseProcessingService.validateFormSubmission({
                formId: formId.toString(),
                responseset: [],
            });
            expect(result).toEqual({ errormess: "Form not found" });
        });
        test("should return error if form is not accepting responses", async () => {
            Form_model_1.default.findById.mockResolvedValue({
                _id: formId,
                setting: { acceptResponses: false },
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.validateFormSubmission({
                formId: formId.toString(),
                responseset: [],
            });
            expect(result).toEqual({
                errormess: "Form is no longer accepting responses",
            });
        });
        test("should return error if no questions are found", async () => {
            Form_model_1.default.findById.mockResolvedValue({
                _id: formId,
                setting: { acceptResponses: true },
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.validateFormSubmission({
                formId: formId.toString(),
                responseset: [],
            });
            expect(result).toEqual({
                errormess: "No questions found for this form",
            });
        });
        test("should return true when validation passes", async () => {
            Form_model_1.default.findById.mockResolvedValue({
                _id: formId,
                setting: { acceptResponses: true },
            });
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([
                    {
                        _id: q1Id,
                        type: Content_model_1.QuestionType.Text,
                        require: true,
                    },
                ]),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.validateFormSubmission({
                formId: formId.toString(),
                responseset: [{ question: q1Id.toString(), response: "Hello" }],
            });
            expect(result).toBe(true);
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                        checkExistingResponse Tests                         */
    /* -------------------------------------------------------------------------- */
    describe("checkExistingResponse", () => {
        test("should return null if neither userId nor guestEmail is provided", async () => {
            const result = await ResponseProcessingService_1.ResponseProcessingService.checkExistingResponse(formId.toString());
            expect(result).toBeNull();
        });
        test("should query by userId when provided", async () => {
            Response_model_1.default.findOne.mockReturnValue({
                lean: jest
                    .fn()
                    .mockResolvedValue({ _id: new mongoose_1.Types.ObjectId(), userId }),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.checkExistingResponse(formId.toString(), userId.toString());
            expect(Response_model_1.default.findOne).toHaveBeenCalledWith(expect.objectContaining({ formId: formId.toString() }));
            expect(result).not.toBeNull();
        });
        test("should query by guest.email when guestEmail is provided", async () => {
            Response_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: new mongoose_1.Types.ObjectId() }),
            });
            const result = await ResponseProcessingService_1.ResponseProcessingService.checkExistingResponse(formId.toString(), undefined, "guest@example.com");
            expect(Response_model_1.default.findOne).toHaveBeenCalledWith(expect.objectContaining({ "guest.email": "guest@example.com" }));
            expect(result).not.toBeNull();
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                           getFormMaxScore Tests                            */
    /* -------------------------------------------------------------------------- */
    describe("getFormMaxScore", () => {
        test("should calculate total max score of all questions in a form", async () => {
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest
                        .fn()
                        .mockResolvedValue([
                        { score: 10 },
                        { score: 15 },
                        { score: undefined },
                    ]),
                }),
            });
            const maxScore = await ResponseProcessingService_1.ResponseProcessingService.getFormMaxScore(formId.toString());
            expect(maxScore).toBe(25);
        });
    });
    /* -------------------------------------------------------------------------- */
    /*                        getResponseStatistics Tests                         */
    /* -------------------------------------------------------------------------- */
    describe("getResponseStatistics", () => {
        test("should return calculated statistics for a form", async () => {
            Response_model_1.default.countDocuments
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(8); // completed
            Response_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest
                        .fn()
                        .mockResolvedValue([
                        { totalScore: 80 },
                        { totalScore: 90 },
                        { totalScore: 70 },
                    ]),
                }),
            });
            const stats = await ResponseProcessingService_1.ResponseProcessingService.getResponseStatistics(formId.toString());
            expect(stats.totalResponses).toBe(10);
            expect(stats.completedResponses).toBe(8);
            expect(stats.completionRate).toBe(80);
            expect(stats.averageScore).toBe(80);
            expect(stats.maxScore).toBe(90);
            expect(stats.minScore).toBe(70);
        });
        test("should handle empty response stats gracefully", async () => {
            Response_model_1.default.countDocuments
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0);
            Response_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([]),
                }),
            });
            const stats = await ResponseProcessingService_1.ResponseProcessingService.getResponseStatistics(formId.toString());
            expect(stats.totalResponses).toBe(0);
            expect(stats.completedResponses).toBe(0);
            expect(stats.completionRate).toBe(0);
            expect(stats.averageScore).toBe(0);
            expect(stats.maxScore).toBe(0);
            expect(stats.minScore).toBe(0);
        });
    });
});
