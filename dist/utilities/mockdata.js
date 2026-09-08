"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockContentFactory = void 0;
const mongoose_1 = require("mongoose");
const Content_model_1 = require("../model/Content.model");
const Response_model_1 = require("../model/Response.model");
const Form_model_1 = require("../model/Form.model");
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
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("What is your favorite programming language?"),
            type: Content_model_1.QuestionType.MultipleChoice,
            qIdx: 0,
            formId: this.createFormId(),
            multiple: choices,
            score: 10,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: 0,
                isCorrect: true,
            },
            require: true,
            page: 1,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createCheckboxContent(overrides) {
        const choices = this.createChoiceOptions(5);
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Select all programming languages you know"),
            type: Content_model_1.QuestionType.CheckBox,
            qIdx: 1,
            formId: this.createFormId(),
            checkbox: choices,
            score: 15,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [0, 1, 3], // Multiple correct answers
                isCorrect: true,
            },
            require: false,
            page: 1,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createTextContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("What is your full name?"),
            type: Content_model_1.QuestionType.Text,
            qIdx: 2,
            formId: this.createFormId(),
            text: "",
            score: 0,
            require: true,
            page: 1,
            hasAnswer: false,
            isValidated: false,
            ...overrides,
        };
    }
    static createShortAnswerContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Explain the concept of polymorphism"),
            type: Content_model_1.QuestionType.ShortAnswer,
            qIdx: 3,
            formId: this.createFormId(),
            text: "",
            score: 20,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: "polymorphism is the ability of objects to take multiple forms",
                isCorrect: true,
            },
            require: true,
            page: 2,
            hasAnswer: true,
            isValidated: false, // Usually requires manual validation
            ...overrides,
        };
    }
    static createNumberContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("How many years of programming experience do you have?"),
            type: Content_model_1.QuestionType.Number,
            qIdx: 4,
            formId: this.createFormId(),
            score: 5,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: 5,
                isCorrect: true,
            },
            require: false,
            page: 2,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createDateContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("When did you start programming?"),
            type: Content_model_1.QuestionType.Date,
            qIdx: 5,
            formId: this.createFormId(),
            date: new Date(),
            score: 0,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: new Date("2020-01-01"),
                isCorrect: true,
            },
            require: false,
            page: 2,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createRangeNumberContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Select your salary range (in thousands)"),
            type: Content_model_1.QuestionType.RangeNumber,
            qIdx: 6,
            formId: this.createFormId(),
            rangenumber: { start: 0, end: 200 },
            score: 0,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: { start: 50, end: 100 },
                isCorrect: true,
            },
            require: false,
            page: 3,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createRangeDateContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Select your project duration"),
            type: Content_model_1.QuestionType.RangeDate,
            qIdx: 7,
            formId: this.createFormId(),
            rangedate: {
                start: new Date("2024-01-01"),
                end: new Date("2024-12-31"),
            },
            score: 0,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: {
                    start: new Date("2024-03-01"),
                    end: new Date("2024-09-01"),
                },
                isCorrect: true,
            },
            require: false,
            page: 3,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createSelectionContent(overrides) {
        const choices = this.createChoiceOptions(3);
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Choose your preferred IDE"),
            type: Content_model_1.QuestionType.Selection,
            qIdx: 8,
            formId: this.createFormId(),
            selection: choices,
            score: 5,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: 1, // Single selection
                isCorrect: true,
            },
            require: true,
            page: 3,
            hasAnswer: true,
            isValidated: true,
            ...overrides,
        };
    }
    static createParagraphContent(overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle("Describe your biggest programming project"),
            type: Content_model_1.QuestionType.Paragraph,
            qIdx: 9,
            formId: this.createFormId(),
            text: "",
            score: 25,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: "A comprehensive e-commerce platform built with React and Node.js",
                isCorrect: true,
            },
            require: false,
            page: 4,
            hasAnswer: true,
            isValidated: false, // Usually requires manual validation
            ...overrides,
        };
    }
    static createConditionQuestionWithChilds({ parent, childs, childKey, }) {
        const parentQ = {
            ...parent,
            conditional: childs.map((c, idx) => ({
                _id: new mongoose_1.Types.ObjectId(),
                contentId: c._id,
                key: childKey?.[idx] !== undefined ? childKey[idx] : idx,
            })),
        };
        return [
            parentQ,
            ...childs.map((child, idx) => ({
                ...child,
                parentcontent: {
                    _id: new mongoose_1.Types.ObjectId().toString(),
                    qId: parent._id ? parent._id.toString() : `temp_${parent.qIdx}`,
                    qIdx: parent.qIdx,
                    optIdx: parentQ.conditional[idx].key,
                },
            })),
        ];
    }
    /**
   
     * @param depth          - How many levels to generate (1 = root only, max 20)
     * @param formId         - Shared formId for all nodes (generated if omitted)
     * @param startQIdx      - qIdx for the root; children increment from there
     * @param optionCount    - Number of choice options per node
     * @param triggerKey     - Which option index (key) triggers the child at each level
     * @param parentOverrides - Partial<ContentType> applied only to the root node
     * @param childOverrides  - Array of Partial<ContentType> indexed by depth (0 = root).
     *                          Entries beyond the array length are ignored.
     */
    static createNestedContent({ depth = 1, formId, startQIdx = 0, optionCount = 3, triggerKey = 0, parentOverrides, childOverrides = [], } = {}) {
        const MAX_DEPTH = 20;
        const clampedDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
        const sharedFormId = formId ?? this.createFormId();
        const result = [];
        let parentNode = null;
        for (let level = 0; level < clampedDepth; level++) {
            const nodeId = new mongoose_1.Types.ObjectId();
            const qIdx = startQIdx + level;
            const choices = this.createChoiceOptions(optionCount);
            // Build parentcontent linking back to the previous level's node
            const parentcontent = parentNode
                ? {
                    _id: parentNode._id.toString(),
                    qId: parentNode._id.toString(),
                    qIdx: parentNode.qIdx,
                    optIdx: triggerKey,
                    ...(level === 1 ? (parentOverrides?.parentcontent ?? {}) : {}),
                }
                : undefined;
            // The previous node needs a conditional entry pointing to this new node
            if (parentNode) {
                parentNode.conditional = [
                    ...(parentNode.conditional ?? []),
                    {
                        _id: new mongoose_1.Types.ObjectId(),
                        key: triggerKey,
                        contentId: nodeId,
                        contentIdx: qIdx,
                    },
                ];
            }
            const levelOverride = childOverrides[level] ?? {};
            const node = Object.assign({
                _id: nodeId,
                title: this.createContentTitle(levelOverride.title
                    ? ""
                    : level === 0
                        ? "Root Question"
                        : `Child Question – Level ${level}`),
                type: Content_model_1.QuestionType.MultipleChoice,
                multiple: choices,
                qIdx,
                formId: sharedFormId,
                page: 1,
                score: 0,
                require: false,
                hasAnswer: false,
                isValidated: false,
                conditional: [],
                ...(level === 0 ? (parentOverrides ?? {}) : {}),
                ...levelOverride,
            }, 
            // Pin structural identity fields — always wins over any override
            { _id: nodeId, qIdx, formId: sharedFormId, parentcontent });
            result.push(node);
            parentNode = node;
        }
        return result;
    }
    /**
     * Simple form mock data with 10 questions across 4 pages.
     *
     * List of created questions:
     * 1. [qIdx: 0, Page 1] MultipleChoice (4 options): "What is your favorite programming language?"
     * 2. [qIdx: 1, Page 1] CheckBox (5 options): "Select all programming languages you know"
     * 3. [qIdx: 2, Page 1] Text: "What is your full name?"
     * 4. [qIdx: 3, Page 2] ShortAnswer: "Explain the concept of polymorphism"
     * 5. [qIdx: 4, Page 2] Number: "How many years of programming experience do you have?"
     * 6. [qIdx: 5, Page 2] Date: "When did you start programming?"
     * 7. [qIdx: 6, Page 3] RangeNumber: "Select your salary range (in thousands)"
     * 8. [qIdx: 7, Page 3] RangeDate: "Select your project duration"
     * 9. [qIdx: 8, Page 3] Selection (3 options): "Choose your preferred IDE"
     * 10. [qIdx: 9, Page 4] Paragraph: "Describe your biggest programming project"
     *
     * @returns Array of 10 ContentType questions sharing a common formId
     */
    static createSampleForm(newFormId, additional) {
        const formId = newFormId ?? this.createFormId();
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
            ...(additional ?? []),
        ];
    }
    // Helper method to create content for quick testing
    static createMinimalContent(type, overrides) {
        return {
            _id: new mongoose_1.Types.ObjectId(),
            title: this.createContentTitle(`Sample ${type} Question`),
            type,
            qIdx: 0,
            formId: this.createFormId(),
            score: 10,
            page: 1,
            hasAnswer: false,
            isValidated: false,
            ...overrides,
        };
    }
    static createFormObj(override) {
        return {
            title: "Testing Form",
            type: Form_model_1.TypeForm.Normal,
            submittype: Form_model_1.SubmitType.Once,
            user: new mongoose_1.Types.ObjectId(),
            pendingCollarborators: [],
            setting: {
                submitonce: true,
                returnscore: Form_model_1.returnscore.partial,
                acceptResponses: false,
                email: true,
            },
            ...override,
        };
    }
    /**
     * Generate an appropriate mock answer based on the question type
     * Uses question.answer if available, otherwise generates a default valid response
     */
    static generateResponseForQuestion(question) {
        if (question.answer?.answer !== undefined) {
            if (question.answer.answer instanceof Date) {
                return question.answer.answer.toISOString().split("T")[0];
            }
            return question.answer.answer;
        }
        switch (question.type) {
            case Content_model_1.QuestionType.MultipleChoice:
                return question.multiple?.[0]?.idx ?? 0;
            case Content_model_1.QuestionType.CheckBox:
            case Content_model_1.QuestionType.MultipleSelection:
                return question.checkbox && question.checkbox.length > 0
                    ? question.checkbox.slice(0, 2).map((c) => c.idx)
                    : [0];
            case Content_model_1.QuestionType.Selection:
                return question.selection?.[0]?.idx ?? 0;
            case Content_model_1.QuestionType.ShortAnswer:
                return "Sample short answer";
            case Content_model_1.QuestionType.Paragraph:
                return "Sample paragraph response with detailed feedback.";
            case Content_model_1.QuestionType.Text:
                return "Sample text response";
            case Content_model_1.QuestionType.Number:
                return 42;
            case Content_model_1.QuestionType.Date:
                return "2024-01-01";
            case Content_model_1.QuestionType.RangeDate: {
                const start = question.rangedate?.start instanceof Date
                    ? question.rangedate.start.toISOString().split("T")[0]
                    : String(question.rangedate?.start ?? "2024-01-01");
                const end = question.rangedate?.end instanceof Date
                    ? question.rangedate.end.toISOString().split("T")[0]
                    : String(question.rangedate?.end ?? "2024-12-31");
                return { start, end };
            }
            case Content_model_1.QuestionType.RangeNumber:
                return question.rangenumber ?? { start: 1, end: 10 };
            default:
                return "Sample answer";
        }
    }
    /**
     * Generate a mock ResponseSetType
     * Supports generating from ContentType, ObjectId/string, or manual override
     */
    static generateResponseSet(questionOrOverride, override) {
        // If first argument is a ContentType (has 'type' and not a plain ResponseSetType)
        if (questionOrOverride &&
            typeof questionOrOverride === "object" &&
            "type" in questionOrOverride &&
            !("response" in questionOrOverride)) {
            const question = questionOrOverride;
            return {
                question: question._id ?? new mongoose_1.Types.ObjectId(),
                response: this.generateResponseForQuestion(question),
                score: question.score ?? 10,
                scoringMethod: Response_model_1.ScoringMethod.AUTO,
                ...override,
            };
        }
        // If first argument is an ObjectId or string
        if (questionOrOverride instanceof mongoose_1.Types.ObjectId ||
            typeof questionOrOverride === "string") {
            return {
                question: questionOrOverride,
                response: 0,
                score: 10,
                scoringMethod: Response_model_1.ScoringMethod.AUTO,
                ...override,
            };
        }
        // If first argument is partial ResponseSetType overrides
        const partialOverrides = questionOrOverride ?? {};
        return {
            question: new mongoose_1.Types.ObjectId(),
            response: 0,
            score: 20,
            scoringMethod: Response_model_1.ScoringMethod.AUTO,
            ...partialOverrides,
            ...override,
        };
    }
    /**
     * Generate an array of ResponseSetType items for multiple questions
     */
    static generateResponseSets(questions, overrides) {
        return questions.map((q) => this.generateResponseSet(q, overrides));
    }
    /**Function to create mock response set
     * @requires Form,User,Question
     */
    static createResponseSet(override) {
        return this.generateResponseSet(override);
    }
}
exports.MockContentFactory = MockContentFactory;
