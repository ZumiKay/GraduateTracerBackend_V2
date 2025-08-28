"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../helper");
const Content_model_1 = require("../../model/Content.model");
const mongoose_1 = require("mongoose");
describe("GetAnswerKeyForQuestion Tests", () => {
    // Helper function to create mock content title
    const createMockTitle = () => ({
        type: "doc",
        content: [{ type: "text", text: "Test Question" }],
    });
    // Test data setup
    const mockFormId = new mongoose_1.Types.ObjectId();
    describe("Multiple Choice Questions", () => {
        const mockMultipleChoiceQuestion = {
            _id: "q1",
            title: createMockTitle(),
            type: Content_model_1.QuestionType.MultipleChoice,
            qIdx: 1,
            formId: mockFormId,
            multiple: [
                { idx: 0, content: "Option A" },
                { idx: 1, content: "Option B" },
                { idx: 2, content: "Option C" },
            ],
            answer: {
                answer: 1, // Correct answer is index 1 (Option B)
                isCorrect: true,
            },
            score: 10,
        };
        it("should return correct choice for multiple choice question", () => {
            const result = (0, helper_1.GetAnswerKeyForQuestion)(mockMultipleChoiceQuestion);
            expect(result).toBeDefined();
            expect(result === null || result === void 0 ? void 0 : result.idx).toBe(1);
            expect(result === null || result === void 0 ? void 0 : result.content).toBe("Option B");
        });
        it("should return undefined when answer key is missing", () => {
            const questionWithoutAnswer = Object.assign(Object.assign({}, mockMultipleChoiceQuestion), { answer: undefined });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithoutAnswer);
            expect(result).toBeUndefined();
        });
        it("should return undefined when multiple choices array is missing", () => {
            const questionWithoutChoices = Object.assign(Object.assign({}, mockMultipleChoiceQuestion), { multiple: undefined });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithoutChoices);
            expect(result).toBeUndefined();
        });
        it("should return undefined when answer index doesn't match any choice", () => {
            const questionWithInvalidAnswer = Object.assign(Object.assign({}, mockMultipleChoiceQuestion), { answer: {
                    answer: 99, // Invalid index
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithInvalidAnswer);
            expect(result).toBeUndefined();
        });
    });
    describe("Selection Questions", () => {
        const mockSelectionQuestion = {
            _id: "q2",
            title: createMockTitle(),
            type: Content_model_1.QuestionType.Selection,
            qIdx: 2,
            formId: mockFormId,
            selection: [
                { idx: 0, content: "Choice A" },
                { idx: 1, content: "Choice B" },
                { idx: 2, content: "Choice C" },
            ],
            answer: {
                answer: 2, // Correct answer is index 2 (Choice C)
                isCorrect: true,
            },
            score: 5,
        };
        it("should return correct choice for selection question", () => {
            const result = (0, helper_1.GetAnswerKeyForQuestion)(mockSelectionQuestion);
            expect(result).toBeDefined();
            expect(result === null || result === void 0 ? void 0 : result.idx).toBe(2);
            expect(result === null || result === void 0 ? void 0 : result.content).toBe("Choice C");
        });
        it("should handle selection with no matching answer", () => {
            const questionWithInvalidAnswer = Object.assign(Object.assign({}, mockSelectionQuestion), { answer: {
                    answer: 5, // Invalid index
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithInvalidAnswer);
            expect(result).toBeUndefined();
        });
    });
    describe("Checkbox Questions", () => {
        const mockCheckboxQuestion = {
            _id: "q3",
            title: createMockTitle(),
            type: Content_model_1.QuestionType.CheckBox,
            qIdx: 3,
            formId: mockFormId,
            checkbox: [
                { idx: 0, content: "Option 1" },
                { idx: 1, content: "Option 2" },
                { idx: 2, content: "Option 3" },
                { idx: 3, content: "Option 4" },
            ],
            answer: {
                answer: [0, 2], // Correct answers are indices 0 and 2
                isCorrect: true,
            },
            score: 15,
        };
        it("should return array of correct choices for checkbox question", () => {
            const result = (0, helper_1.GetAnswerKeyForQuestion)(mockCheckboxQuestion);
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ key: 0, val: "Option 1" });
            expect(result[1]).toEqual({ key: 2, val: "Option 3" });
        });
        it("should handle single checkbox selection", () => {
            const singleCheckboxQuestion = Object.assign(Object.assign({}, mockCheckboxQuestion), { answer: {
                    answer: [1], // Only one correct answer
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(singleCheckboxQuestion);
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ key: 1, val: "Option 2" });
        });
        it("should filter out invalid indices for checkbox question", () => {
            const questionWithInvalidIndices = Object.assign(Object.assign({}, mockCheckboxQuestion), { answer: {
                    answer: [0, 5, 2, 10], // Indices 5 and 10 are invalid
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithInvalidIndices);
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2); // Only valid indices should be returned
            expect(result[0]).toEqual({ key: 0, val: "Option 1" });
            expect(result[1]).toEqual({ key: 2, val: "Option 3" });
        });
        it("should return empty array when no valid indices found", () => {
            const questionWithNoValidIndices = Object.assign(Object.assign({}, mockCheckboxQuestion), { answer: {
                    answer: [10, 20, 30], // All invalid indices
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithNoValidIndices);
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(0);
        });
        it("should return undefined when checkbox array is missing", () => {
            const questionWithoutCheckbox = Object.assign(Object.assign({}, mockCheckboxQuestion), { checkbox: undefined });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithoutCheckbox);
            expect(result).toBeUndefined();
        });
        it("should return undefined when answer is not an array", () => {
            const questionWithInvalidAnswer = Object.assign(Object.assign({}, mockCheckboxQuestion), { answer: {
                    answer: "not an array", // Invalid answer type
                    isCorrect: true,
                } });
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithInvalidAnswer);
            expect(result).toBeUndefined();
        });
    });
    describe("Non-Choice Questions", () => {
        it("should return answer as-is for short answer questions", () => {
            const shortAnswerQuestion = {
                _id: "q4",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.ShortAnswer,
                qIdx: 4,
                formId: mockFormId,
                answer: {
                    answer: "Correct text answer",
                    isCorrect: true,
                },
                score: 10,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(shortAnswerQuestion);
            expect(result).toEqual({
                answer: "Correct text answer",
                isCorrect: true,
            });
        });
        it("should return answer as-is for paragraph questions", () => {
            const paragraphQuestion = {
                _id: "q5",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.Paragraph,
                qIdx: 5,
                formId: mockFormId,
                answer: {
                    answer: "This is a long paragraph answer with multiple sentences.",
                    isCorrect: true,
                },
                score: 20,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(paragraphQuestion);
            expect(result).toEqual({
                answer: "This is a long paragraph answer with multiple sentences.",
                isCorrect: true,
            });
        });
        it("should return answer as-is for number questions", () => {
            const numberQuestion = {
                _id: "q6",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.Number,
                qIdx: 6,
                formId: mockFormId,
                answer: {
                    answer: 42,
                    isCorrect: true,
                },
                score: 5,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(numberQuestion);
            expect(result).toEqual({
                answer: 42,
                isCorrect: true,
            });
        });
        it("should return answer as-is for date questions", () => {
            const testDate = new Date("2024-01-15");
            const dateQuestion = {
                _id: "q7",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.Date,
                qIdx: 7,
                formId: mockFormId,
                answer: {
                    answer: testDate,
                    isCorrect: true,
                },
                score: 5,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(dateQuestion);
            expect(result).toEqual({
                answer: testDate,
                isCorrect: true,
            });
        });
        it("should return answer as-is for range number questions", () => {
            const rangeNumberQuestion = {
                _id: "q8",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.RangeNumber,
                qIdx: 8,
                formId: mockFormId,
                answer: {
                    answer: { start: 10, end: 50 },
                    isCorrect: true,
                },
                score: 15,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(rangeNumberQuestion);
            expect(result).toEqual({
                answer: { start: 10, end: 50 },
                isCorrect: true,
            });
        });
    });
    describe("Edge Cases", () => {
        it("should return undefined when content has no answer", () => {
            const questionWithoutAnswer = {
                _id: "q9",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.MultipleChoice,
                qIdx: 9,
                formId: mockFormId,
                multiple: [
                    { idx: 0, content: "Option A" },
                    { idx: 1, content: "Option B" },
                ],
                // No answer property
                score: 10,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithoutAnswer);
            expect(result).toBeUndefined();
        });
        it("should handle undefined answer property gracefully", () => {
            const questionWithUndefinedAnswer = {
                _id: "q10",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.ShortAnswer,
                qIdx: 10,
                formId: mockFormId,
                answer: undefined,
                score: 5,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithUndefinedAnswer);
            expect(result).toBeUndefined();
        });
        it("should handle question with empty string answer", () => {
            const questionWithEmptyAnswer = {
                _id: "q11",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.Text,
                qIdx: 11,
                formId: mockFormId,
                answer: {
                    answer: "",
                    isCorrect: true,
                },
                score: 5,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithEmptyAnswer);
            expect(result).toEqual({
                answer: "",
                isCorrect: true,
            });
        });
        it("should handle question with zero as answer", () => {
            const questionWithZeroAnswer = {
                _id: "q12",
                title: createMockTitle(),
                type: Content_model_1.QuestionType.Number,
                qIdx: 12,
                formId: mockFormId,
                answer: {
                    answer: 0,
                    isCorrect: true,
                },
                score: 5,
            };
            const result = (0, helper_1.GetAnswerKeyForQuestion)(questionWithZeroAnswer);
            expect(result).toEqual({
                answer: 0,
                isCorrect: true,
            });
        });
    });
    describe("Type Validation", () => {
        it("should handle all supported question types", () => {
            const supportedTypes = [
                Content_model_1.QuestionType.MultipleChoice,
                Content_model_1.QuestionType.CheckBox,
                Content_model_1.QuestionType.Selection,
                Content_model_1.QuestionType.ShortAnswer,
                Content_model_1.QuestionType.Paragraph,
                Content_model_1.QuestionType.Text,
                Content_model_1.QuestionType.Number,
                Content_model_1.QuestionType.Date,
                Content_model_1.QuestionType.RangeDate,
                Content_model_1.QuestionType.RangeNumber,
            ];
            supportedTypes.forEach((type) => {
                const question = {
                    _id: `q_${type}`,
                    title: createMockTitle(),
                    type: type,
                    qIdx: 1,
                    formId: mockFormId,
                    answer: {
                        answer: type === Content_model_1.QuestionType.CheckBox
                            ? [0]
                            : type === Content_model_1.QuestionType.MultipleChoice ||
                                type === Content_model_1.QuestionType.Selection
                                ? 0
                                : "test answer",
                        isCorrect: true,
                    },
                    score: 10,
                };
                // Add required choice arrays for choice-based questions
                if (type === Content_model_1.QuestionType.MultipleChoice) {
                    question.multiple = [{ idx: 0, content: "Option A" }];
                }
                else if (type === Content_model_1.QuestionType.CheckBox) {
                    question.checkbox = [{ idx: 0, content: "Option A" }];
                }
                else if (type === Content_model_1.QuestionType.Selection) {
                    question.selection = [{ idx: 0, content: "Option A" }];
                }
                // Function should not throw errors for any supported type
                expect(() => (0, helper_1.GetAnswerKeyForQuestion)(question)).not.toThrow();
            });
        });
    });
});
