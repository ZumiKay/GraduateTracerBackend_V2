"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ConditionValidator_1 = __importDefault(require("../ConditionValidator"));
const Content_model_1 = require("../../model/Content.model");
const mongoose_1 = require("mongoose");
const helper_1 = require("../../utilities/helper");
describe("ConditionQuestionValidator Unit Tests", () => {
    let mockReq;
    let mockRes;
    let nextFun;
    let errorSpy;
    const validOptions = [
        { idx: 0, content: "Option 1" },
        { idx: 1, content: "Option 2" },
    ];
    const validCondition = {
        _id: new mongoose_1.Types.ObjectId(),
        key: 0,
        contentId: new mongoose_1.Types.ObjectId(),
    };
    const createMockQuestion = (overrides = {}) => ({
        formId: new mongoose_1.Types.ObjectId(),
        qIdx: 0,
        title: { type: "doc", content: [] },
        type: Content_model_1.QuestionType.MultipleChoice,
        multiple: validOptions,
        conditional: [validCondition],
        ...overrides,
    });
    beforeEach(() => {
        jest.clearAllMocks();
        nextFun = jest.fn();
        mockReq = {
            body: {},
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });
    describe("Validation Methods", () => {
        describe("validateConditionQuestionTypes", () => {
            test("should be valid if question has no conditional logic", () => {
                const question = createMockQuestion({
                    type: Content_model_1.QuestionType.Text,
                    conditional: [],
                });
                const result = ConditionValidator_1.default.validateConditionQuestionTypes(question);
                expect(result.isValid).toBe(true);
            });
            test("should be valid for MultipleChoice and CheckBox with conditional logic", () => {
                const mcQuestion = createMockQuestion({
                    type: Content_model_1.QuestionType.MultipleChoice,
                });
                const cbQuestion = createMockQuestion({
                    type: Content_model_1.QuestionType.CheckBox,
                    checkbox: validOptions,
                });
                expect(ConditionValidator_1.default.validateConditionQuestionTypes(mcQuestion)
                    .isValid).toBe(true);
                expect(ConditionValidator_1.default.validateConditionQuestionTypes(cbQuestion)
                    .isValid).toBe(true);
            });
            test("should be invalid for unsupported question types with conditional logic", () => {
                const textQuestion = createMockQuestion({
                    type: Content_model_1.QuestionType.Text,
                    conditional: [validCondition],
                });
                const result = ConditionValidator_1.default.validateConditionQuestionTypes(textQuestion);
                expect(result.isValid).toBe(false);
                expect(result.error).toContain("Condition questions are only allowed");
            });
        });
        describe("validateConditionKeys", () => {
            test("should be valid if question has no conditional logic", () => {
                const question = createMockQuestion({ conditional: [] });
                const result = ConditionValidator_1.default.validateConditionKeys(question);
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
            test("should be invalid if question has conditions but no options defined", () => {
                const question = createMockQuestion({
                    multiple: [],
                    conditional: [validCondition],
                });
                const result = ConditionValidator_1.default.validateConditionKeys(question);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain("Question has conditional logic but no options defined");
            });
            test("should be invalid if condition key does not match any option index", () => {
                const question = createMockQuestion({
                    multiple: validOptions,
                    conditional: [{ ...validCondition, key: 99 }],
                });
                const result = ConditionValidator_1.default.validateConditionKeys(question);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain("references non-existent option key: 99");
            });
            test("should be invalid if condition key is undefined or null", () => {
                const question = createMockQuestion({
                    multiple: validOptions,
                    conditional: [{ ...validCondition, key: undefined }],
                });
                const result = ConditionValidator_1.default.validateConditionKeys(question);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain("has undefined key");
            });
            test("should be valid when all condition keys match valid option indices", () => {
                const question = createMockQuestion({
                    multiple: validOptions,
                    conditional: [{ ...validCondition, key: 1 }],
                });
                const result = ConditionValidator_1.default.validateConditionKeys(question);
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });
        describe("validateSingleContent and validateMultipleContent", () => {
            test("validateSingleContent should aggregate errors from type and key validations", () => {
                const invalidQuestion = createMockQuestion({
                    type: Content_model_1.QuestionType.Date,
                    conditional: [{ ...validCondition, key: 99 }],
                });
                const result = ConditionValidator_1.default.validateSingleContent(invalidQuestion);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThanOrEqual(2);
            });
            test("validateMultipleContent should prefix errors with content index", () => {
                const validQ = createMockQuestion();
                const invalidQ = createMockQuestion({
                    type: Content_model_1.QuestionType.Text,
                    conditional: [validCondition],
                });
                const result = ConditionValidator_1.default.validateMultipleContent([
                    validQ,
                    invalidQ,
                ]);
                expect(result.isValid).toBe(false);
                expect(result.errors[0]).toContain("Content 1:");
            });
        });
    });
    describe("validateConditionMiddleware", () => {
        test("should call next() if no content is provided in body", () => {
            mockReq.body = {};
            ConditionValidator_1.default.validateConditionMiddleware(mockReq, mockRes, nextFun);
            expect(nextFun).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
        test("should call next() for valid single content", () => {
            mockReq.body = {
                content: createMockQuestion(),
            };
            ConditionValidator_1.default.validateConditionMiddleware(mockReq, mockRes, nextFun);
            expect(nextFun).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
        test("should call next() for valid multiple contents (data array)", () => {
            mockReq.body = {
                data: [createMockQuestion(), createMockQuestion({ qIdx: 1 })],
            };
            ConditionValidator_1.default.validateConditionMiddleware(mockReq, mockRes, nextFun);
            expect(nextFun).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
        test("should return 400 when single content has invalid condition configuration", () => {
            mockReq.body = {
                content: createMockQuestion({
                    type: Content_model_1.QuestionType.Text,
                    conditional: [validCondition],
                }),
            };
            ConditionValidator_1.default.validateConditionMiddleware(mockReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 400,
                message: expect.stringContaining("Invalid condition question configuration"),
            }));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 400 when data array contains invalid condition configuration", () => {
            mockReq.body = {
                data: [
                    createMockQuestion(),
                    createMockQuestion({
                        multiple: validOptions,
                        conditional: [{ ...validCondition, key: 99 }],
                    }),
                ],
            };
            ConditionValidator_1.default.validateConditionMiddleware(mockReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 400,
                message: expect.stringContaining("references non-existent option key: 99"),
            }));
            expect(nextFun).not.toHaveBeenCalled();
        });
    });
    describe("validateConditionCreationMiddleware", () => {
        test("should return 400 if parent content or content._id is missing", () => {
            mockReq.body = {
                content: {},
                key: 0,
                newContent: createMockQuestion(),
            };
            ConditionValidator_1.default.validateConditionCreationMiddleware(mockReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(400, "Parent content ID is required for condition creation"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 400 if condition key is missing (undefined/null)", () => {
            mockReq.body = {
                content: { _id: new mongoose_1.Types.ObjectId() },
                key: undefined,
                newContent: createMockQuestion(),
            };
            ConditionValidator_1.default.validateConditionCreationMiddleware(mockReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(400, "Condition key is required"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should return 400 if newContent is missing", () => {
            mockReq.body = {
                content: { _id: new mongoose_1.Types.ObjectId() },
                key: 0,
            };
            ConditionValidator_1.default.validateConditionCreationMiddleware(mockReq, mockRes, nextFun);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith((0, helper_1.ReturnCode)(400, "New content is required for condition creation"));
            expect(nextFun).not.toHaveBeenCalled();
        });
        test("should call next() when all required parameters are provided", () => {
            mockReq.body = {
                content: { _id: new mongoose_1.Types.ObjectId() },
                key: 0,
                newContent: createMockQuestion(),
            };
            ConditionValidator_1.default.validateConditionCreationMiddleware(mockReq, mockRes, nextFun);
            expect(nextFun).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });
});
