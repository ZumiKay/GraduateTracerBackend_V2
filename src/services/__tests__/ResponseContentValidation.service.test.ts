import { QuestionType } from "../../model/Content.model";
import {
  PredefinedErrorMessage,
  ValidationErrorCodeEnum,
} from "../../types/validation.types";
import { MockContentFactory } from "../../utilities/mockdata";
import ResponseContentValidationService from "../ResponseContentValidationService";

describe("ResponseContentValidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateAnswerFormat", () => {
    test("invalid type returns answerformat error", () => {
      const invalidTypeCon = MockContentFactory.createMinimalContent(
        "hello" as never,
        {
          questionId: "1",
          answer: {
            answer: 0,
          },
          hasAnswer: true,
        },
      );

      const validate =
        ResponseContentValidationService.validateAnswerFormat(invalidTypeCon);
      expect(validate.isValid).toBe(false);
      expect(validate.errors).toEqual([
        {
          _id: invalidTypeCon._id?.toString(),
          qIdx: invalidTypeCon.qIdx,
          questionId: "Question 1",
          page: 1,
          message:
            PredefinedErrorMessage()[ValidationErrorCodeEnum.answerformat],
        },
      ]);
    });

    test("valid question type with wrong answer format returns invalid", () => {
      const validContentWithAnswer = [
        MockContentFactory.createRangeDateContent({
          hasAnswer: true,
          answer: {
            answer: 10,
          },
        }),
        MockContentFactory.createDateContent({
          hasAnswer: true,
          answer: {
            answer: {
              start: 5,
              end: 10,
            },
          },
        }),
      ];

      const validated = validContentWithAnswer.map((con) =>
        ResponseContentValidationService.validateAnswerFormat(con),
      );

      expect(validated.map((i) => i.isValid)).toEqual([false, false]);
      expect(validated[0].errors.length).toBe(1);
      expect(validated[1].errors.length).toBe(1);
    });

    test("returns isValid true when content has no answer or hasAnswer is false", () => {
      const contentNoAnswer = MockContentFactory.createMinimalContent(
        QuestionType.MultipleChoice,
        {
          hasAnswer: false,
        },
      );
      const res =
        ResponseContentValidationService.validateAnswerFormat(contentNoAnswer);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    test("validates MultipleChoice, Selection, CheckBox, MultipleSelection properly", () => {
      // Valid number answer
      const mcValid = MockContentFactory.createMultipleChoiceContent({
        hasAnswer: true,
        answer: { answer: 2 },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(mcValid).isValid,
      ).toBe(true);

      // Valid array answer
      const cbValid = MockContentFactory.createCheckboxContent({
        hasAnswer: true,
        answer: { answer: [0, 1, 2] },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(cbValid).isValid,
      ).toBe(true);

      // Invalid: string instead of number
      const mcInvalid = MockContentFactory.createMultipleChoiceContent({
        hasAnswer: true,
        answer: { answer: "0" as never },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(mcInvalid)
          .isValid,
      ).toBe(false);

      // Invalid: array with non-numbers
      const cbInvalid = MockContentFactory.createCheckboxContent({
        hasAnswer: true,
        answer: { answer: [0, "abc" as never] },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(cbInvalid)
          .isValid,
      ).toBe(false);
    });

    test("validates Text, ShortAnswer, Paragraph properly", () => {
      const textValid = MockContentFactory.createShortAnswerContent({
        hasAnswer: true,
        answer: { answer: "Valid text response" },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(textValid)
          .isValid,
      ).toBe(true);

      const textInvalid = MockContentFactory.createShortAnswerContent({
        hasAnswer: true,
        answer: { answer: 12345 as never },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(textInvalid)
          .isValid,
      ).toBe(false);
    });

    test("validates Number properly", () => {
      const numValid = MockContentFactory.createNumberContent({
        hasAnswer: true,
        answer: { answer: 42 },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(numValid).isValid,
      ).toBe(true);

      const numInvalid = MockContentFactory.createNumberContent({
        hasAnswer: true,
        answer: { answer: "42" as never },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(numInvalid)
          .isValid,
      ).toBe(false);
    });

    test("validates Date properly", () => {
      const dateStringValid = MockContentFactory.createDateContent({
        hasAnswer: true,
        answer: { answer: "2024-05-01" },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(dateStringValid)
          .isValid,
      ).toBe(true);

      const dateObjValid = MockContentFactory.createDateContent({
        hasAnswer: true,
        answer: { answer: new Date("2024-05-01") as never },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(dateObjValid)
          .isValid,
      ).toBe(true);

      const dateInvalidString = MockContentFactory.createDateContent({
        hasAnswer: true,
        answer: { answer: "not-a-valid-date" },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(dateInvalidString)
          .isValid,
      ).toBe(false);
    });

    test("validates RangeDate properly", () => {
      const rangeDateValid = MockContentFactory.createRangeDateContent({
        hasAnswer: true,
        answer: {
          answer: {
            start: "2024-01-01",
            end: "2024-12-31",
          } as never,
        },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(rangeDateValid)
          .isValid,
      ).toBe(true);

      // Inverted date range
      const rangeDateInverted = MockContentFactory.createRangeDateContent({
        hasAnswer: true,
        answer: {
          answer: {
            start: "2024-12-31",
            end: "2024-01-01",
          } as never,
        },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(rangeDateInverted)
          .isValid,
      ).toBe(false);
    });

    test("validates RangeNumber properly", () => {
      const rangeNumValid = MockContentFactory.createRangeNumberContent({
        hasAnswer: true,
        answer: {
          answer: { start: 10, end: 50 },
        },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(rangeNumValid)
          .isValid,
      ).toBe(true);

      // Inverted range
      const rangeNumInverted = MockContentFactory.createRangeNumberContent({
        hasAnswer: true,
        answer: {
          answer: { start: 100, end: 50 },
        },
      });
      expect(
        ResponseContentValidationService.validateAnswerFormat(rangeNumInverted)
          .isValid,
      ).toBe(false);
    });

    test("supports 3-argument signature (questionType, answer, content)", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        questionId: "5",
      });

      const validResult = ResponseContentValidationService.validateAnswerFormat(
        QuestionType.MultipleChoice,
        0,
        content,
      );
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toEqual([]);

      const invalidResult =
        ResponseContentValidationService.validateAnswerFormat(
          QuestionType.MultipleChoice,
          "invalid" as never,
          content,
        );
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors[0].questionId).toBe("Question 5");
    });
  });

  describe("isAnswerisempty", () => {
    test("identifies null, undefined, empty string, and empty array as empty", () => {
      expect(
        ResponseContentValidationService.isAnswerisempty(null as never),
      ).toBe(true);
      expect(
        ResponseContentValidationService.isAnswerisempty(undefined as never),
      ).toBe(true);
      expect(ResponseContentValidationService.isAnswerisempty("")).toBe(true);
      expect(ResponseContentValidationService.isAnswerisempty("   ")).toBe(
        true,
      );
      expect(ResponseContentValidationService.isAnswerisempty([])).toBe(true);
    });

    test("identifies numbers (including 0), booleans, and non-empty strings/arrays as not empty", () => {
      expect(ResponseContentValidationService.isAnswerisempty(0)).toBe(false);
      expect(ResponseContentValidationService.isAnswerisempty(42)).toBe(false);
      expect(ResponseContentValidationService.isAnswerisempty(false)).toBe(
        false,
      );
      expect(ResponseContentValidationService.isAnswerisempty(true)).toBe(
        false,
      );
      expect(ResponseContentValidationService.isAnswerisempty("answer")).toBe(
        false,
      );
      expect(ResponseContentValidationService.isAnswerisempty([0])).toBe(false);
    });

    test("handles range objects properly for emptiness", () => {
      // Both start and end empty
      expect(
        ResponseContentValidationService.isAnswerisempty({
          start: null,
          end: undefined,
        } as never),
      ).toBe(true);
      expect(
        ResponseContentValidationService.isAnswerisempty({
          start: "  ",
          end: "",
        } as never),
      ).toBe(true);

      // Valid range with numbers or dates
      expect(
        ResponseContentValidationService.isAnswerisempty({
          start: 0,
          end: 10,
        }),
      ).toBe(false);
      expect(
        ResponseContentValidationService.isAnswerisempty({
          start: "2024-01-01",
          end: "2024-12-31",
        }),
      ).toBe(false);
    });
  });

  describe("calculateResponseTotalScore", () => {
    test("calculates total score for top-level questions and ignores conditional questions", () => {
      const topLevelQ1 = MockContentFactory.createMultipleChoiceContent({
        score: 10,
      });
      const topLevelQ2 = MockContentFactory.createMultipleChoiceContent({
        score: 15,
      });
      const childQ = MockContentFactory.createMultipleChoiceContent({
        score: 5,
        parentcontent: {
          qId: topLevelQ1._id!.toString(),
          optIdx: 0,
        },
      });

      const responseSet = [
        { question: topLevelQ1, response: 0, score: 10 },
        { question: topLevelQ2, response: 1, score: 15 },
        { question: childQ, response: 0, score: 5 }, // child question score should be ignored
        { question: undefined as never, response: 0, score: 20 }, // no question should be ignored
      ];

      const total =
        ResponseContentValidationService.calculateResponseTotalScore(
          responseSet,
        );
      expect(total).toBe(25);

      expect(
        ResponseContentValidationService.calcualteResponseTotalScore(
          responseSet,
        ),
      ).toBe(25);
    });
  });

  describe("calculateResponseScore", () => {
    test("returns 0 if correctAnswer is missing or maxScore is 0", () => {
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "test",
          "" as never,
          QuestionType.ShortAnswer,
          10,
        ),
      ).toBe(0);
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "test",
          "test",
          QuestionType.ShortAnswer,
          0,
        ),
      ).toBe(0);
    });

    test("returns 0 for Text question type (manual grading only)", () => {
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "user text",
          "correct text",
          QuestionType.Text,
          10,
        ),
      ).toBe(0);
    });

    test("scores choice questions with exact and partial matching", () => {
      const maxScore = 10;
      // Exact match
      expect(
        ResponseContentValidationService.calculateResponseScore(
          [0, 1],
          [0, 1],
          QuestionType.CheckBox,
          maxScore,
        ),
      ).toBe(10);

      // Partial match (intersection: 1, union: 2 -> 50% -> 5)
      expect(
        ResponseContentValidationService.calculateResponseScore(
          [0],
          [0, 1],
          QuestionType.CheckBox,
          maxScore,
        ),
      ).toBe(5);

      // No match
      expect(
        ResponseContentValidationService.calculateResponseScore(
          [2],
          [0, 1],
          QuestionType.CheckBox,
          maxScore,
        ),
      ).toBe(0);
    });

    test("scores ShortAnswer and Paragraph with exact and text similarity", () => {
      const maxScore = 20;

      // Exact match (case and whitespace insensitive)
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "  Hello World  ",
          "hello world",
          QuestionType.ShortAnswer,
          maxScore,
        ),
      ).toBe(20);

      // High similarity (> 0.8)
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "the quick brown fox jumps over the lazy dog",
          "the quick brown fox jumps over lazy dog",
          QuestionType.Paragraph,
          maxScore,
        ),
      ).toBe(20);

      // Low similarity
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "completely different text",
          "the quick brown fox",
          QuestionType.ShortAnswer,
          maxScore,
        ),
      ).toBe(0);
    });

    test("scores Number questions correctly", () => {
      expect(
        ResponseContentValidationService.calculateResponseScore(
          42,
          42,
          QuestionType.Number,
          10,
        ),
      ).toBe(10);

      expect(
        ResponseContentValidationService.calculateResponseScore(
          40,
          42,
          QuestionType.Number,
          10,
        ),
      ).toBe(0);
    });

    test("scores Date questions correctly", () => {
      expect(
        ResponseContentValidationService.calculateResponseScore(
          "2024-05-01T00:00:00.000Z",
          "2024-05-01T00:00:00.000Z",
          QuestionType.Date,
          15,
        ),
      ).toBe(15);

      expect(
        ResponseContentValidationService.calculateResponseScore(
          "2024-05-01",
          "2024-05-02",
          QuestionType.Date,
          15,
        ),
      ).toBe(0);
    });

    test("scores RangeDate and RangeNumber questions correctly", () => {
      // RangeNumber match
      expect(
        ResponseContentValidationService.calculateResponseScore(
          { start: 10, end: 20 },
          { start: 10, end: 20 },
          QuestionType.RangeNumber,
          10,
        ),
      ).toBe(10);

      // RangeNumber mismatch
      expect(
        ResponseContentValidationService.calculateResponseScore(
          { start: 10, end: 20 },
          { start: 10, end: 30 },
          QuestionType.RangeNumber,
          10,
        ),
      ).toBe(0);

      // RangeDate match
      expect(
        ResponseContentValidationService.calculateResponseScore(
          { start: "2024-01-01", end: "2024-12-31" },
          { start: "2024-01-01", end: "2024-12-31" },
          QuestionType.RangeDate,
          10,
        ),
      ).toBe(10);
    });
  });
});
