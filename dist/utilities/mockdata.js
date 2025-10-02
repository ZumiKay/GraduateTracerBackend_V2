"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockContentFactory = void 0;
const mongoose_1 = require("mongoose");
const Content_model_1 = require("../model/Content.model");
class MockContentFactory {
    static createFormId() {
        return new mongoose_1.Types.ObjectId();
    }
    static createContentTitle(text = "Sample Question") {
        return {
            type: "doc",
            content: [
                {
                    type: "heading",
                    attrs: { level: 1 },
                    content: [{ type: "text", text }],
                },
            ],
        };
    }
    static createChoiceOptions(count = 3) {
        return Array.from({ length: count }, (_, idx) => ({
            _id: new mongoose_1.Types.ObjectId(),
            idx,
            content: `Option ${idx + 1}`,
        }));
    }
    static createMultipleChoiceContent(overrides) {
        const choices = this.createChoiceOptions(4);
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("What is your favorite programming language?"), type: Content_model_1.QuestionType.MultipleChoice, qIdx: 0, formId: this.createFormId(), multiple: choices, score: 10, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [0, 2], // Correct options indices
                isCorrect: true,
            }, require: true, page: 1, hasAnswer: true, isValidated: true }, overrides);
    }
    static createCheckboxContent(overrides) {
        const choices = this.createChoiceOptions(5);
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Select all programming languages you know"), type: Content_model_1.QuestionType.CheckBox, qIdx: 1, formId: this.createFormId(), checkbox: choices, score: 15, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [0, 1, 3], // Multiple correct answers
                isCorrect: true,
            }, require: false, page: 1, hasAnswer: true, isValidated: true }, overrides);
    }
    static createTextContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("What is your full name?"), type: Content_model_1.QuestionType.Text, qIdx: 2, formId: this.createFormId(), text: "", score: 0, require: true, page: 1, hasAnswer: false, isValidated: false }, overrides);
    }
    static createShortAnswerContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Explain the concept of polymorphism"), type: Content_model_1.QuestionType.ShortAnswer, qIdx: 3, formId: this.createFormId(), text: "", score: 20, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: "polymorphism is the ability of objects to take multiple forms",
                isCorrect: true,
            }, require: true, page: 2, hasAnswer: true, isValidated: false }, overrides);
    }
    static createNumberContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("How many years of programming experience do you have?"), type: Content_model_1.QuestionType.Number, qIdx: 4, formId: this.createFormId(), score: 5, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: 5, // Exact number answer
                isCorrect: true,
            }, require: false, page: 2, hasAnswer: true, isValidated: true }, overrides);
    }
    static createDateContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("When did you start programming?"), type: Content_model_1.QuestionType.Date, qIdx: 5, formId: this.createFormId(), date: new Date(), score: 0, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: new Date("2020-01-01"),
                isCorrect: true,
            }, require: false, page: 2, hasAnswer: true, isValidated: true }, overrides);
    }
    static createRangeNumberContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Select your salary range (in thousands)"), type: Content_model_1.QuestionType.RangeNumber, qIdx: 6, formId: this.createFormId(), rangenumber: { start: 0, end: 200 }, score: 0, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: { start: 50, end: 100 },
                isCorrect: true,
            }, require: false, page: 3, hasAnswer: true, isValidated: true }, overrides);
    }
    static createRangeDateContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Select your project duration"), type: Content_model_1.QuestionType.RangeDate, qIdx: 7, formId: this.createFormId(), rangedate: {
                start: new Date("2024-01-01"),
                end: new Date("2024-12-31"),
            }, score: 0, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: {
                    start: new Date("2024-03-01"),
                    end: new Date("2024-09-01"),
                },
                isCorrect: true,
            }, require: false, page: 3, hasAnswer: true, isValidated: true }, overrides);
    }
    static createSelectionContent(overrides) {
        const choices = this.createChoiceOptions(3);
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Choose your preferred IDE"), type: Content_model_1.QuestionType.Selection, qIdx: 8, formId: this.createFormId(), selection: choices, score: 5, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [1], // Single selection
                isCorrect: true,
            }, require: true, page: 3, hasAnswer: true, isValidated: true }, overrides);
    }
    static createParagraphContent(overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Describe your biggest programming project"), type: Content_model_1.QuestionType.Paragraph, qIdx: 9, formId: this.createFormId(), text: "", score: 25, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: "A comprehensive e-commerce platform built with React and Node.js",
                isCorrect: true,
            }, require: false, page: 4, hasAnswer: true, isValidated: false }, overrides);
    }
    static createConditionalContent(parentContentId, overrides) {
        const conditionalData = {
            _id: new mongoose_1.Types.ObjectId(),
            key: 0, // Depends on first option of parent
            contentId: new mongoose_1.Types.ObjectId(parentContentId),
            contentIdx: 0,
        };
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle("Which JavaScript framework do you prefer? (Conditional)"), type: Content_model_1.QuestionType.MultipleChoice, qIdx: 10, formId: this.createFormId(), multiple: this.createChoiceOptions(3), score: 10, answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [0],
                isCorrect: true,
            }, conditional: [conditionalData], parentcontent: {
                _id: new mongoose_1.Types.ObjectId().toString(),
                qId: parentContentId,
                qIdx: 0,
                optIdx: 0,
            }, require: false, page: 4, hasAnswer: true, isValidated: true }, overrides);
    }
    // Helper method to create a complete form with various question types
    static createSampleForm() {
        var _a;
        const formId = this.createFormId();
        const multipleChoice = this.createMultipleChoiceContent({
            formId,
            qIdx: 0,
        });
        const checkbox = this.createCheckboxContent({ formId, qIdx: 1 });
        const text = this.createTextContent({ formId, qIdx: 2 });
        const shortAnswer = this.createShortAnswerContent({ formId, qIdx: 3 });
        const number = this.createNumberContent({ formId, qIdx: 4 });
        const date = this.createDateContent({ formId, qIdx: 5 });
        const rangeNumber = this.createRangeNumberContent({ formId, qIdx: 6 });
        const rangeDate = this.createRangeDateContent({ formId, qIdx: 7 });
        const selection = this.createSelectionContent({ formId, qIdx: 8 });
        const paragraph = this.createParagraphContent({ formId, qIdx: 9 });
        const conditional = this.createConditionalContent((_a = multipleChoice._id) === null || _a === void 0 ? void 0 : _a.toString(), {
            formId,
            qIdx: 10,
        });
        return [
            multipleChoice,
            checkbox,
            text,
            shortAnswer,
            number,
            date,
            rangeNumber,
            rangeDate,
            selection,
            paragraph,
            conditional,
        ];
    }
    // Helper method to create minimal content for quick testing
    static createMinimalContent(type, overrides) {
        return Object.assign({ _id: new mongoose_1.Types.ObjectId(), title: this.createContentTitle(`Sample ${type} Question`), type, qIdx: 0, formId: this.createFormId(), score: 10, page: 1, hasAnswer: false, isValidated: false }, overrides);
    }
}
exports.MockContentFactory = MockContentFactory;
