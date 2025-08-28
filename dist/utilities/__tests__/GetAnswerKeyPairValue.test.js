"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../helper");
const Content_model_1 = require("../../model/Content.model");
describe("GetAnswerKeyPairValue Optimization Tests", () => {
    // Test data setup
    const mockMultipleChoiceQuestion = {
        _id: "q1",
        type: Content_model_1.QuestionType.MultipleChoice,
        title: "Test Question",
        qIdx: 1,
        formId: "form1",
        multiple: [
            { idx: 0, content: "Option A" },
            { idx: 1, content: "Option B" },
            { idx: 2, content: "Option C" },
        ],
    };
    const mockCheckboxQuestion = {
        _id: "q2",
        type: Content_model_1.QuestionType.CheckBox,
        title: "Checkbox Question",
        qIdx: 2,
        formId: "form1",
        checkbox: [
            { idx: 0, content: "Choice 1" },
            { idx: 1, content: "Choice 2" },
            { idx: 2, content: "Choice 3" },
        ],
    };
    describe("Multiple Choice Questions", () => {
        it("should return correct value for single selection", () => {
            const responseSet = {
                questionId: "q1",
                response: 1,
                question: mockMultipleChoiceQuestion,
            };
            const result = (0, helper_1.GetAnswerKeyPairValue)(responseSet);
            expect(result.key).toBe(1);
            expect(result.val).toBe("Option B");
        });
        it("should handle invalid choice index", () => {
            const responseSet = {
                questionId: "q1",
                response: 99,
                question: mockMultipleChoiceQuestion,
            };
            const result = (0, helper_1.GetAnswerKeyPairValue)(responseSet);
            expect(result.key).toBe(99);
            expect(result.val).toBe(99);
        });
    });
    describe("Checkbox Questions", () => {
        it("should return array of selected choices", () => {
            const responseSet = {
                questionId: "q2",
                response: [0, 2],
                question: mockCheckboxQuestion,
            };
            const result = (0, helper_1.GetAnswerKeyPairValue)(responseSet);
            expect(result.key).toEqual([0, 2]);
            expect(result.val).toEqual(["Choice 1", "Choice 3"]);
        });
        it("should handle single checkbox selection", () => {
            const responseSet = {
                questionId: "q2",
                response: [1],
                question: mockCheckboxQuestion,
            };
            const result = (0, helper_1.GetAnswerKeyPairValue)(responseSet);
            expect(result.key).toEqual([1]);
            expect(result.val).toEqual(["Choice 2"]);
        });
        it("should handle empty checkbox selection", () => {
            const responseSet = {
                questionId: "q2",
                response: [],
                question: mockCheckboxQuestion,
            };
            const result = (0, helper_1.GetAnswerKeyPairValue)(responseSet);
            expect(result.key).toEqual([]);
            expect(result.val).toEqual([]);
        });
    });
});
