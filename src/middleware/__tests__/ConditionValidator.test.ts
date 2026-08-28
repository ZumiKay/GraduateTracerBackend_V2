import { Response, NextFunction } from "express";
import ConditionQuestionValidator, {
  ConditionValidationRequest,
} from "../ConditionValidator";
import {
  ContentType,
  QuestionType,
  ChoiceQuestionType,
  ConditionalType,
} from "../../model/Content.model";
import { Types } from "mongoose";
import { ReturnCode } from "../../utilities/helper";

describe("ConditionQuestionValidator Unit Tests", () => {
  let mockReq: Partial<ConditionValidationRequest>;
  let mockRes: Partial<Response>;
  let nextFun: NextFunction;
  let errorSpy: jest.SpyInstance;

  const validOptions: ChoiceQuestionType[] = [
    { idx: 0, content: "Option 1" },
    { idx: 1, content: "Option 2" },
  ];

  const validCondition: ConditionalType = {
    _id: new Types.ObjectId(),
    key: 0,
    contentId: new Types.ObjectId(),
  };

  const createMockQuestion = (overrides: Partial<ContentType> = {}): ContentType =>
    ({
      formId: new Types.ObjectId(),
      qIdx: 0,
      title: { type: "doc", content: [] },
      type: QuestionType.MultipleChoice,
      multiple: validOptions,
      conditional: [validCondition],
      ...overrides,
    } as ContentType);

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

    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("Validation Methods", () => {
    describe("validateConditionQuestionTypes", () => {
      test("should be valid if question has no conditional logic", () => {
        const question = createMockQuestion({
          type: QuestionType.Text,
          conditional: [],
        });
        const result =
          ConditionQuestionValidator.validateConditionQuestionTypes(question);
        expect(result.isValid).toBe(true);
      });

      test("should be valid for MultipleChoice and CheckBox with conditional logic", () => {
        const mcQuestion = createMockQuestion({
          type: QuestionType.MultipleChoice,
        });
        const cbQuestion = createMockQuestion({
          type: QuestionType.CheckBox,
          checkbox: validOptions,
        });

        expect(
          ConditionQuestionValidator.validateConditionQuestionTypes(mcQuestion)
            .isValid,
        ).toBe(true);
        expect(
          ConditionQuestionValidator.validateConditionQuestionTypes(cbQuestion)
            .isValid,
        ).toBe(true);
      });

      test("should be invalid for unsupported question types with conditional logic", () => {
        const textQuestion = createMockQuestion({
          type: QuestionType.Text,
          conditional: [validCondition],
        });

        const result =
          ConditionQuestionValidator.validateConditionQuestionTypes(
            textQuestion,
          );
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("Condition questions are only allowed");
      });
    });

    describe("validateConditionKeys", () => {
      test("should be valid if question has no conditional logic", () => {
        const question = createMockQuestion({ conditional: [] });
        const result =
          ConditionQuestionValidator.validateConditionKeys(question);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test("should be invalid if question has conditions but no options defined", () => {
        const question = createMockQuestion({
          multiple: [],
          conditional: [validCondition],
        });
        const result =
          ConditionQuestionValidator.validateConditionKeys(question);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Question has conditional logic but no options defined",
        );
      });

      test("should be invalid if condition key does not match any option index", () => {
        const question = createMockQuestion({
          multiple: validOptions,
          conditional: [{ ...validCondition, key: 99 }],
        });
        const result =
          ConditionQuestionValidator.validateConditionKeys(question);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          "references non-existent option key: 99",
        );
      });

      test("should be invalid if condition key is undefined or null", () => {
        const question = createMockQuestion({
          multiple: validOptions,
          conditional: [{ ...validCondition, key: undefined as never }],
        });
        const result =
          ConditionQuestionValidator.validateConditionKeys(question);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("has undefined key");
      });

      test("should be valid when all condition keys match valid option indices", () => {
        const question = createMockQuestion({
          multiple: validOptions,
          conditional: [{ ...validCondition, key: 1 }],
        });
        const result =
          ConditionQuestionValidator.validateConditionKeys(question);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("validateSingleContent and validateMultipleContent", () => {
      test("validateSingleContent should aggregate errors from type and key validations", () => {
        const invalidQuestion = createMockQuestion({
          type: QuestionType.Date,
          conditional: [{ ...validCondition, key: 99 }],
        });

        const result =
          ConditionQuestionValidator.validateSingleContent(invalidQuestion);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      });

      test("validateMultipleContent should prefix errors with content index", () => {
        const validQ = createMockQuestion();
        const invalidQ = createMockQuestion({
          type: QuestionType.Text,
          conditional: [validCondition],
        });

        const result = ConditionQuestionValidator.validateMultipleContent([
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

      ConditionQuestionValidator.validateConditionMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(nextFun).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should call next() for valid single content", () => {
      mockReq.body = {
        content: createMockQuestion(),
      };

      ConditionQuestionValidator.validateConditionMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(nextFun).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should call next() for valid multiple contents (data array)", () => {
      mockReq.body = {
        data: [createMockQuestion(), createMockQuestion({ qIdx: 1 })],
      };

      ConditionQuestionValidator.validateConditionMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(nextFun).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should return 400 when single content has invalid condition configuration", () => {
      mockReq.body = {
        content: createMockQuestion({
          type: QuestionType.Text,
          conditional: [validCondition],
        }),
      };

      ConditionQuestionValidator.validateConditionMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: expect.stringContaining(
            "Invalid condition question configuration",
          ),
        }),
      );
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

      ConditionQuestionValidator.validateConditionMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: expect.stringContaining(
            "references non-existent option key: 99",
          ),
        }),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });
  });

  describe("validateConditionCreationMiddleware", () => {
    test("should return 400 if parent content or content._id is missing", () => {
      mockReq.body = {
        content: {} as never,
        key: 0,
        newContent: createMockQuestion(),
      };

      ConditionQuestionValidator.validateConditionCreationMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(400, "Parent content ID is required for condition creation"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should return 400 if condition key is missing (undefined/null)", () => {
      mockReq.body = {
        content: { _id: new Types.ObjectId() } as never,
        key: undefined,
        newContent: createMockQuestion(),
      };

      ConditionQuestionValidator.validateConditionCreationMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(400, "Condition key is required"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should return 400 if newContent is missing", () => {
      mockReq.body = {
        content: { _id: new Types.ObjectId() } as never,
        key: 0,
      };

      ConditionQuestionValidator.validateConditionCreationMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(400, "New content is required for condition creation"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should call next() when all required parameters are provided", () => {
      mockReq.body = {
        content: { _id: new Types.ObjectId() } as never,
        key: 0,
        newContent: createMockQuestion(),
      };

      ConditionQuestionValidator.validateConditionCreationMiddleware(
        mockReq as ConditionValidationRequest,
        mockRes as Response,
        nextFun,
      );

      expect(nextFun).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
