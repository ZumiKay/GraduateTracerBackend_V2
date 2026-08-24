"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Content_model_1 = require("../../model/Content.model");
const validation_types_1 = require("../../types/validation.types");
const mockdata_1 = require("../../utilities/mockdata");
const ResponseContentValidationService_1 = __importDefault(require("../ResponseContentValidationService"));
describe("ResponseContentValidation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe("validateAnswerFormat", () => {
        test("invalid type returns answerformat error", () => {
            const invalidTypeCon = mockdata_1.MockContentFactory.createMinimalContent("hello", {
                questionId: "1",
                answer: {
                    answer: 0,
                },
                hasAnswer: true,
            });
            const validate = ResponseContentValidationService_1.default.validateAnswerFormat(invalidTypeCon);
            expect(validate.isValid).toBe(false);
            expect(validate.errors).toEqual([
                {
                    _id: invalidTypeCon._id?.toString(),
                    qIdx: invalidTypeCon.qIdx,
                    questionId: "Question 1",
                    page: 1,
                    message: (0, validation_types_1.PredefinedErrorMessage)()[validation_types_1.ValidationErrorCodeEnum.answerformat],
                },
            ]);
        });
        test("valid question type with wrong answer format returns invalid", () => {
            const validContentWithAnswer = [
                mockdata_1.MockContentFactory.createRangeDateContent({
                    hasAnswer: true,
                    answer: {
                        answer: 10,
                    },
                }),
                mockdata_1.MockContentFactory.createDateContent({
                    hasAnswer: true,
                    answer: {
                        answer: {
                            start: 5,
                            end: 10,
                        },
                    },
                }),
            ];
            const validated = validContentWithAnswer.map(ResponseContentValidationService_1.default.validateAnswerFormat);
            expect(validated.map((i) => i.isValid)).toEqual([false, false]);
            expect(validated[0].errors.length).toBe(1);
            expect(validated[1].errors.length).toBe(1);
        });
        test("returns isValid true when content has no answer or hasAnswer is false", () => {
            const contentNoAnswer = mockdata_1.MockContentFactory.createMinimalContent(Content_model_1.QuestionType.MultipleChoice, {
                hasAnswer: false,
            });
            const res = ResponseContentValidationService_1.default.validateAnswerFormat(contentNoAnswer);
            expect(res.isValid).toBe(true);
            expect(res.errors).toEqual([]);
        });
        test("validates MultipleChoice, Selection, CheckBox, MultipleSelection properly", () => {
            // Valid number answer
            const mcValid = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                hasAnswer: true,
                answer: { answer: 2 },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(mcValid).isValid).toBe(true);
            // Valid array answer
            const cbValid = mockdata_1.MockContentFactory.createCheckboxContent({
                hasAnswer: true,
                answer: { answer: [0, 1, 2] },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(cbValid).isValid).toBe(true);
            // Invalid: string instead of number
            const mcInvalid = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                hasAnswer: true,
                answer: { answer: "0" },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(mcInvalid).isValid).toBe(false);
            // Invalid: array with non-numbers
            const cbInvalid = mockdata_1.MockContentFactory.createCheckboxContent({
                hasAnswer: true,
                answer: { answer: [0, "abc"] },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(cbInvalid).isValid).toBe(false);
        });
        test("validates Text, ShortAnswer, Paragraph properly", () => {
            const textValid = mockdata_1.MockContentFactory.createShortAnswerContent({
                hasAnswer: true,
                answer: { answer: "Valid text response" },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(textValid).isValid).toBe(true);
            const textInvalid = mockdata_1.MockContentFactory.createShortAnswerContent({
                hasAnswer: true,
                answer: { answer: 12345 },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(textInvalid).isValid).toBe(false);
        });
        test("validates Number properly", () => {
            const numValid = mockdata_1.MockContentFactory.createNumberContent({
                hasAnswer: true,
                answer: { answer: 42 },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(numValid).isValid).toBe(true);
            const numInvalid = mockdata_1.MockContentFactory.createNumberContent({
                hasAnswer: true,
                answer: { answer: "42" },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(numInvalid).isValid).toBe(false);
        });
        test("validates Date properly", () => {
            const dateStringValid = mockdata_1.MockContentFactory.createDateContent({
                hasAnswer: true,
                answer: { answer: "2024-05-01" },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(dateStringValid).isValid).toBe(true);
            const dateObjValid = mockdata_1.MockContentFactory.createDateContent({
                hasAnswer: true,
                answer: { answer: new Date("2024-05-01") },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(dateObjValid).isValid).toBe(true);
            const dateInvalidString = mockdata_1.MockContentFactory.createDateContent({
                hasAnswer: true,
                answer: { answer: "not-a-valid-date" },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(dateInvalidString).isValid).toBe(false);
        });
        test("validates RangeDate properly", () => {
            const rangeDateValid = mockdata_1.MockContentFactory.createRangeDateContent({
                hasAnswer: true,
                answer: {
                    answer: {
                        start: "2024-01-01",
                        end: "2024-12-31",
                    },
                },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(rangeDateValid).isValid).toBe(true);
            // Inverted date range
            const rangeDateInverted = mockdata_1.MockContentFactory.createRangeDateContent({
                hasAnswer: true,
                answer: {
                    answer: {
                        start: "2024-12-31",
                        end: "2024-01-01",
                    },
                },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(rangeDateInverted).isValid).toBe(false);
        });
        test("validates RangeNumber properly", () => {
            const rangeNumValid = mockdata_1.MockContentFactory.createRangeNumberContent({
                hasAnswer: true,
                answer: {
                    answer: { start: 10, end: 50 },
                },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(rangeNumValid).isValid).toBe(true);
            // Inverted range
            const rangeNumInverted = mockdata_1.MockContentFactory.createRangeNumberContent({
                hasAnswer: true,
                answer: {
                    answer: { start: 100, end: 50 },
                },
            });
            expect(ResponseContentValidationService_1.default.validateAnswerFormat(rangeNumInverted).isValid).toBe(false);
        });
        test("supports 3-argument signature (questionType, answer, content)", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                questionId: "5",
            });
            const validResult = ResponseContentValidationService_1.default.validateAnswerFormat(Content_model_1.QuestionType.MultipleChoice, 0, content);
            expect(validResult.isValid).toBe(true);
            expect(validResult.errors).toEqual([]);
            const invalidResult = ResponseContentValidationService_1.default.validateAnswerFormat(Content_model_1.QuestionType.MultipleChoice, "invalid", content);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors[0].questionId).toBe("Question 5");
        });
    });
    describe("isAnswerisempty", () => {
        test("identifies null, undefined, empty string, and empty array as empty", () => {
            expect(ResponseContentValidationService_1.default.isAnswerisempty(null)).toBe(true);
            expect(ResponseContentValidationService_1.default.isAnswerisempty(undefined)).toBe(true);
            expect(ResponseContentValidationService_1.default.isAnswerisempty("")).toBe(true);
            expect(ResponseContentValidationService_1.default.isAnswerisempty("   ")).toBe(true);
            expect(ResponseContentValidationService_1.default.isAnswerisempty([])).toBe(true);
        });
        test("identifies numbers (including 0), booleans, and non-empty strings/arrays as not empty", () => {
            expect(ResponseContentValidationService_1.default.isAnswerisempty(0)).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty(42)).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty(false)).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty(true)).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty("answer")).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty([0])).toBe(false);
        });
        test("handles range objects properly for emptiness", () => {
            // Both start and end empty
            expect(ResponseContentValidationService_1.default.isAnswerisempty({
                start: null,
                end: undefined,
            })).toBe(true);
            expect(ResponseContentValidationService_1.default.isAnswerisempty({
                start: "  ",
                end: "",
            })).toBe(true);
            // Valid range with numbers or dates
            expect(ResponseContentValidationService_1.default.isAnswerisempty({
                start: 0,
                end: 10,
            })).toBe(false);
            expect(ResponseContentValidationService_1.default.isAnswerisempty({
                start: "2024-01-01",
                end: "2024-12-31",
            })).toBe(false);
        });
    });
    describe("calculateResponseTotalScore", () => {
        test("calculates total score for top-level questions and ignores conditional questions", () => {
            const topLevelQ1 = mockdata_1.MockContentFactory.createMultipleChoiceContent({ score: 10 });
            const topLevelQ2 = mockdata_1.MockContentFactory.createMultipleChoiceContent({ score: 15 });
            const childQ = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                score: 5,
                parentcontent: {
                    qId: topLevelQ1._id.toString(),
                    optIdx: 0,
                },
            });
            const responseSet = [
                { question: topLevelQ1, response: 0, score: 10 },
                { question: topLevelQ2, response: 1, score: 15 },
                { question: childQ, response: 0, score: 5 }, // child question score should be ignored
                { question: undefined, response: 0, score: 20 }, // no question should be ignored
            ];
            const total = ResponseContentValidationService_1.default.calculateResponseTotalScore(responseSet);
            expect(total).toBe(25);
            // Test typo alias returns identical result
            expect(ResponseContentValidationService_1.default.calcualteResponseTotalScore(responseSet)).toBe(25);
        });
    });
    describe("calculateResponseScore", () => {
        test("returns 0 if correctAnswer is missing or maxScore is 0", () => {
            expect(ResponseContentValidationService_1.default.calculateResponseScore("test", "", Content_model_1.QuestionType.ShortAnswer, 10)).toBe(0);
            expect(ResponseContentValidationService_1.default.calculateResponseScore("test", "test", Content_model_1.QuestionType.ShortAnswer, 0)).toBe(0);
        });
        test("returns 0 for Text question type (manual grading only)", () => {
            expect(ResponseContentValidationService_1.default.calculateResponseScore("user text", "correct text", Content_model_1.QuestionType.Text, 10)).toBe(0);
        });
        test("scores choice questions with exact and partial matching", () => {
            const maxScore = 10;
            // Exact match
            expect(ResponseContentValidationService_1.default.calculateResponseScore([0, 1], [0, 1], Content_model_1.QuestionType.CheckBox, maxScore)).toBe(10);
            // Partial match (intersection: 1, union: 2 -> 50% -> 5)
            expect(ResponseContentValidationService_1.default.calculateResponseScore([0], [0, 1], Content_model_1.QuestionType.CheckBox, maxScore)).toBe(5);
            // No match
            expect(ResponseContentValidationService_1.default.calculateResponseScore([2], [0, 1], Content_model_1.QuestionType.CheckBox, maxScore)).toBe(0);
        });
        test("scores ShortAnswer and Paragraph with exact and text similarity", () => {
            const maxScore = 20;
            // Exact match (case and whitespace insensitive)
            expect(ResponseContentValidationService_1.default.calculateResponseScore("  Hello World  ", "hello world", Content_model_1.QuestionType.ShortAnswer, maxScore)).toBe(20);
            // High similarity (> 0.8)
            expect(ResponseContentValidationService_1.default.calculateResponseScore("the quick brown fox jumps over the lazy dog", "the quick brown fox jumps over lazy dog", Content_model_1.QuestionType.Paragraph, maxScore)).toBe(20);
            // Low similarity
            expect(ResponseContentValidationService_1.default.calculateResponseScore("completely different text", "the quick brown fox", Content_model_1.QuestionType.ShortAnswer, maxScore)).toBe(0);
        });
        test("scores Number questions correctly", () => {
            expect(ResponseContentValidationService_1.default.calculateResponseScore(42, 42, Content_model_1.QuestionType.Number, 10)).toBe(10);
            expect(ResponseContentValidationService_1.default.calculateResponseScore(40, 42, Content_model_1.QuestionType.Number, 10)).toBe(0);
        });
        test("scores Date questions correctly", () => {
            expect(ResponseContentValidationService_1.default.calculateResponseScore("2024-05-01T00:00:00.000Z", "2024-05-01T00:00:00.000Z", Content_model_1.QuestionType.Date, 15)).toBe(15);
            expect(ResponseContentValidationService_1.default.calculateResponseScore("2024-05-01", "2024-05-02", Content_model_1.QuestionType.Date, 15)).toBe(0);
        });
        test("scores RangeDate and RangeNumber questions correctly", () => {
            // RangeNumber match
            expect(ResponseContentValidationService_1.default.calculateResponseScore({ start: 10, end: 20 }, { start: 10, end: 20 }, Content_model_1.QuestionType.RangeNumber, 10)).toBe(10);
            // RangeNumber mismatch
            expect(ResponseContentValidationService_1.default.calculateResponseScore({ start: 10, end: 20 }, { start: 10, end: 30 }, Content_model_1.QuestionType.RangeNumber, 10)).toBe(0);
            // RangeDate match
            expect(ResponseContentValidationService_1.default.calculateResponseScore({ start: "2024-01-01", end: "2024-12-31" }, { start: "2024-01-01", end: "2024-12-31" }, Content_model_1.QuestionType.RangeDate, 10)).toBe(10);
        });
    });
});
