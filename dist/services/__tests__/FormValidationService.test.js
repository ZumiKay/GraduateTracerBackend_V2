"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Content_model_1 = require("../../model/Content.model");
const Form_model_1 = require("../../model/Form.model");
const mockdata_1 = require("../../utilities/mockdata");
const FormValidationService_1 = require("../FormValidationService");
const validation_types_1 = require("../../types/validation.types");
const form_query_controller_1 = require("../../controller/form/form.query.controller");
const formId = new mongoose_1.Types.ObjectId();
function makeForm(overrides = {}) {
    return {
        _id: new mongoose_1.Types.ObjectId(),
        type: Form_model_1.TypeForm.Quiz,
        setting: { returnscore: Form_model_1.returnscore.partial },
        totalpage: 1,
        contentIds: [],
        title: "Test Form",
        ...overrides,
    };
}
describe("formValidationErrorByContentTypes", () => {
    describe("QuestionType.Text", () => {
        it("returns an error when a text question has a score", () => {
            const content = mockdata_1.MockContentFactory.createTextContent({
                formId,
                score: 5,
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.Text](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.invalid);
        });
        it("returns an error when a text question has isBonusScore set", () => {
            const content = mockdata_1.MockContentFactory.createTextContent({
                formId,
                isBonusScore: true,
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.Text](content);
            expect(errors).toHaveLength(1);
        });
    });
    describe("QuestionType.MultipleChoice", () => {
        it("returns no errors when options are present and non-empty", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.MultipleChoice](content);
            expect(errors).toHaveLength(0);
        });
        it("returns an error when multiple is empty", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                multiple: [],
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.MultipleChoice](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.format);
        });
        it("returns an error when a choice option has empty content", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                multiple: [{ idx: 0, content: "" }],
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.MultipleChoice](content);
            expect(errors).toHaveLength(1);
        });
    });
    describe("QuestionType.CheckBox", () => {
        it("returns no errors when checkbox options are present", () => {
            const content = mockdata_1.MockContentFactory.createCheckboxContent({ formId });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.CheckBox](content);
            expect(errors).toHaveLength(0);
        });
        it("returns an error when checkbox options are empty", () => {
            const content = mockdata_1.MockContentFactory.createCheckboxContent({
                formId,
                checkbox: [],
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.CheckBox](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.format);
        });
    });
    describe("QuestionType.Number", () => {
        it("returns no errors when answer is a valid number", () => {
            const content = mockdata_1.MockContentFactory.createNumberContent({ formId });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.Number](content);
            expect(errors).toHaveLength(0);
        });
        it("returns an error when answer is not a number", () => {
            const content = mockdata_1.MockContentFactory.createNumberContent({
                formId,
                answer: { _id: new mongoose_1.Types.ObjectId(), answer: "not-a-number" },
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.Number](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.answerformat);
        });
    });
    describe("QuestionType.RangeNumber", () => {
        it("returns no errors for a valid range", () => {
            const content = mockdata_1.MockContentFactory.createRangeNumberContent({
                formId,
                rangenumber: { start: 0, end: 100 },
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.RangeNumber](content);
            expect(errors).toHaveLength(0);
        });
        it("returns an error when start > end", () => {
            const content = mockdata_1.MockContentFactory.createRangeNumberContent({
                formId,
                rangenumber: { start: 100, end: 0 },
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.RangeNumber](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.format);
        });
    });
    describe("QuestionType.RangeDate", () => {
        it("returns no errors for a valid date range", () => {
            const content = mockdata_1.MockContentFactory.createRangeDateContent({
                formId,
                rangedate: { start: "2024-01-01", end: "2024-12-31" },
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.RangeDate](content);
            expect(errors).toHaveLength(0);
        });
        it("returns an error when start date is after end date", () => {
            const content = mockdata_1.MockContentFactory.createRangeDateContent({
                formId,
                rangedate: { start: "2024-12-31", end: "2024-01-01" },
            });
            const errors = FormValidationService_1.formValidationErrorByContentTypes[Content_model_1.QuestionType.RangeDate](content);
            expect(errors).toHaveLength(1);
            expect(errors[0].name).toBe(validation_types_1.ValidationErrorCodeEnum.format);
        });
    });
});
describe("FormValidationService.validateContent", () => {
    describe("Solution Tab only", () => {
        it("is valid for a question with no parent or score constraints", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                qIdx: 1,
            });
            const result = FormValidationService_1.FormValidationService.validateContent({ content });
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it("adds a warning when an auto-scorable question is missing score or answer", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                qIdx: 1,
                score: 0,
                answer: undefined,
            });
            const result = FormValidationService_1.FormValidationService.validateContent({ content });
            expect(result.warnings).toHaveLength(1);
        });
        it("is valid when child score equals parentScore", () => {
            const parentId = new mongoose_1.Types.ObjectId().toString();
            const content = mockdata_1.MockContentFactory.createMinimalContent(Content_model_1.QuestionType.MultipleChoice, {
                formId,
                qIdx: 2,
                score: 10,
                parentcontent: {
                    _id: new mongoose_1.Types.ObjectId().toString(),
                    qId: parentId,
                    qIdx: 1,
                    optIdx: 0,
                },
            });
            const result = FormValidationService_1.FormValidationService.validateContent({
                content,
                parentScore: 10,
            });
            expect(result.wrongScores).toHaveLength(0);
            expect(result.isValid).toBe(true);
        });
        it("flags wrongScores when useChildSum sibling total exceeds parentScore", () => {
            const parentId = new mongoose_1.Types.ObjectId().toString();
            const content = mockdata_1.MockContentFactory.createMinimalContent(Content_model_1.QuestionType.MultipleChoice, {
                formId,
                qIdx: 3,
                score: 8,
                parentcontent: {
                    _id: new mongoose_1.Types.ObjectId().toString(),
                    qId: parentId,
                    qIdx: 1,
                    optIdx: 0,
                },
            });
            // siblingSumScore = 5, content.score = 8, total = 13 > parentScore (10)
            const result = FormValidationService_1.FormValidationService.validateContent({
                content,
                parentScore: 10,
                useChildSum: true,
                siblingSumScore: 5,
            });
            expect(result.wrongScores).toHaveLength(1);
        });
    });
    describe("detail tab", () => {
        it("returns errors for a MultipleChoice question with no options", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                qIdx: 1,
                multiple: [],
            });
            const result = FormValidationService_1.FormValidationService.validateContent({
                content,
                validateContentDetail: true,
            });
            expect(result.errors.length).toBeGreaterThan(0);
        });
        it("is valid for a MultipleChoice question with valid options", () => {
            const content = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId,
                qIdx: 1,
            });
            const result = FormValidationService_1.FormValidationService.validateContent({
                content,
                validateContentDetail: true,
            });
            expect(result.errors).toHaveLength(0);
        });
    });
});
describe("FormValidationService.validateForm", () => {
    it("skips Text questions and does not count them", () => {
        const contents = [
            mockdata_1.MockContentFactory.createTextContent({ formId, qIdx: 0 }),
            mockdata_1.MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 1 }),
        ];
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm(), contents, 1, form_query_controller_1.GetFilterTypeEnum.solution);
        // Only 1 non-text question evaluated
        expect(result.totalValidQuestions + result.totalInvalidQuestions).toBe(1);
    });
    it("returns canReturnScoreAutomatically=true for a fully valid Quiz with partial return", () => {
        const contents = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        ];
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm(), contents, 1, form_query_controller_1.GetFilterTypeEnum.solution);
        expect(result.canReturnScoreAutomatically).toBe(true);
        expect(result.totalInvalidQuestions).toBe(0);
    });
    it("returns canReturnScoreAutomatically=false for a Normal form", () => {
        const contents = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        ];
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm({ type: Form_model_1.TypeForm.Normal }), contents, 1, form_query_controller_1.GetFilterTypeEnum.solution);
        expect(result.canReturnScoreAutomatically).toBe(false);
    });
    it("returns canReturnScoreAutomatically=false when returnscore is manual", () => {
        const contents = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        ];
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm({ setting: { returnscore: Form_model_1.returnscore.manual } }), contents, 1, form_query_controller_1.GetFilterTypeEnum.solution);
        expect(result.canReturnScoreAutomatically).toBe(false);
    });
    it("aggregates warnings across multiple auto-scorable questions missing answers", () => {
        const q1 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
            formId,
            qIdx: 0,
            score: 0,
            answer: undefined,
        });
        const q2 = mockdata_1.MockContentFactory.createCheckboxContent({
            formId,
            qIdx: 1,
            score: 0,
            answer: undefined,
        });
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm(), [q1, q2], 1, form_query_controller_1.GetFilterTypeEnum.solution);
        expect(result.validationResults.warnings.length).toBeGreaterThanOrEqual(2);
    });
    it("includes scoringAnalysis and initialCurrentPageScoreAnalysis in result", () => {
        const contents = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
        ];
        const result = FormValidationService_1.FormValidationService.validateForm(makeForm(), contents, 1, form_query_controller_1.GetFilterTypeEnum.solution);
        expect(result.scoringAnalysis).toBeDefined();
        expect(result.initialCurrentPageScoreAnalysis).toBeDefined();
    });
});
describe("FormValidationService.getValidationMessageByQId", () => {
    const qId = new mongoose_1.Types.ObjectId().toString();
    const issues = [
        {
            _id: qId,
            qIdx: 1,
            questionId: "Question 1",
            page: 1,
            message: {
                name: validation_types_1.ValidationErrorCodeEnum.score,
                message: "Invalid Score",
            },
        },
        {
            _id: new mongoose_1.Types.ObjectId().toString(),
            qIdx: 2,
            questionId: "Question 2",
            page: 1,
            message: {
                name: validation_types_1.ValidationErrorCodeEnum.format,
                message: "Invalid Format",
            },
        },
    ];
    it("returns messages matching by _id", () => {
        const result = FormValidationService_1.FormValidationService.getValidationMessageByQId(issues, qId);
        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe(validation_types_1.ValidationErrorCodeEnum.score);
    });
    it("returns messages matching by qIdx", () => {
        const result = FormValidationService_1.FormValidationService.getValidationMessageByQId(issues, 2);
        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe(validation_types_1.ValidationErrorCodeEnum.format);
    });
    it("returns an empty array when no match is found", () => {
        const result = FormValidationService_1.FormValidationService.getValidationMessageByQId(issues, "nonexistent-id");
        expect(result).toHaveLength(0);
    });
});
