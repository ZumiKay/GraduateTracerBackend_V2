import { GetAnswerKeyForQuestion } from "../helper";
import {
  QuestionType,
  ContentType,
  ChoiceQuestionType,
  AnswerKey,
} from "../../model/Content.model";
import { Types } from "mongoose";

describe("GetAnswerKeyForQuestion Tests", () => {
  // Helper function to create mock content title
  const createMockTitle = () => ({
    type: "doc",
    content: [{ type: "text", text: "Test Question" }],
  });

  // Test data setup
  const mockFormId = new Types.ObjectId();

  describe("Multiple Choice Questions", () => {
    const mockMultipleChoiceQuestion: ContentType = {
      _id: "q1",
      title: createMockTitle(),
      type: QuestionType.MultipleChoice,
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
      const result = GetAnswerKeyForQuestion(
        mockMultipleChoiceQuestion
      ) as ChoiceQuestionType;

      expect(result).toBeDefined();
      expect(result?.idx).toBe(1);
      expect(result?.content).toBe("Option B");
    });

    it("should return undefined when answer key is missing", () => {
      const questionWithoutAnswer = {
        ...mockMultipleChoiceQuestion,
        answer: undefined,
      };

      const result = GetAnswerKeyForQuestion(questionWithoutAnswer);

      expect(result).toBeUndefined();
    });

    it("should return undefined when multiple choices array is missing", () => {
      const questionWithoutChoices = {
        ...mockMultipleChoiceQuestion,
        multiple: undefined,
      };

      const result = GetAnswerKeyForQuestion(questionWithoutChoices);

      expect(result).toBeUndefined();
    });

    it("should return undefined when answer index doesn't match any choice", () => {
      const questionWithInvalidAnswer = {
        ...mockMultipleChoiceQuestion,
        answer: {
          answer: 99, // Invalid index
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(questionWithInvalidAnswer);

      expect(result).toBeUndefined();
    });
  });

  describe("Selection Questions", () => {
    const mockSelectionQuestion: ContentType = {
      _id: "q2",
      title: createMockTitle(),
      type: QuestionType.Selection,
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
      const result = GetAnswerKeyForQuestion(
        mockSelectionQuestion
      ) as ChoiceQuestionType;

      expect(result).toBeDefined();
      expect(result?.idx).toBe(2);
      expect(result?.content).toBe("Choice C");
    });

    it("should handle selection with no matching answer", () => {
      const questionWithInvalidAnswer = {
        ...mockSelectionQuestion,
        answer: {
          answer: 5, // Invalid index
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(questionWithInvalidAnswer);

      expect(result).toBeUndefined();
    });
  });

  describe("Checkbox Questions", () => {
    const mockCheckboxQuestion: ContentType = {
      _id: "q3",
      title: createMockTitle(),
      type: QuestionType.CheckBox,
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
      const result = GetAnswerKeyForQuestion(mockCheckboxQuestion) as Array<{
        key: number;
        val: string;
      }>;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({ key: 0, val: "Option 1" });
      expect(result[1]).toEqual({ key: 2, val: "Option 3" });
    });

    it("should handle single checkbox selection", () => {
      const singleCheckboxQuestion = {
        ...mockCheckboxQuestion,
        answer: {
          answer: [1], // Only one correct answer
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(singleCheckboxQuestion) as Array<{
        key: number;
        val: string;
      }>;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ key: 1, val: "Option 2" });
    });

    it("should filter out invalid indices for checkbox question", () => {
      const questionWithInvalidIndices = {
        ...mockCheckboxQuestion,
        answer: {
          answer: [0, 5, 2, 10], // Indices 5 and 10 are invalid
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(
        questionWithInvalidIndices
      ) as Array<{ key: number; val: string }>;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2); // Only valid indices should be returned
      expect(result[0]).toEqual({ key: 0, val: "Option 1" });
      expect(result[1]).toEqual({ key: 2, val: "Option 3" });
    });

    it("should return empty array when no valid indices found", () => {
      const questionWithNoValidIndices = {
        ...mockCheckboxQuestion,
        answer: {
          answer: [10, 20, 30], // All invalid indices
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(
        questionWithNoValidIndices
      ) as Array<{ key: number; val: string }>;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should return undefined when checkbox array is missing", () => {
      const questionWithoutCheckbox = {
        ...mockCheckboxQuestion,
        checkbox: undefined,
      };

      const result = GetAnswerKeyForQuestion(questionWithoutCheckbox);

      expect(result).toBeUndefined();
    });

    it("should return undefined when answer is not an array", () => {
      const questionWithInvalidAnswer = {
        ...mockCheckboxQuestion,
        answer: {
          answer: "not an array", // Invalid answer type
          isCorrect: true,
        },
      };

      const result = GetAnswerKeyForQuestion(questionWithInvalidAnswer);

      expect(result).toBeUndefined();
    });
  });

  describe("Non-Choice Questions", () => {
    it("should return answer as-is for short answer questions", () => {
      const shortAnswerQuestion: ContentType = {
        _id: "q4",
        title: createMockTitle(),
        type: QuestionType.ShortAnswer,
        qIdx: 4,
        formId: mockFormId,
        answer: {
          answer: "Correct text answer",
          isCorrect: true,
        },
        score: 10,
      };

      const result = GetAnswerKeyForQuestion(shortAnswerQuestion) as AnswerKey;

      expect(result).toEqual({
        answer: "Correct text answer",
        isCorrect: true,
      });
    });

    it("should return answer as-is for paragraph questions", () => {
      const paragraphQuestion: ContentType = {
        _id: "q5",
        title: createMockTitle(),
        type: QuestionType.Paragraph,
        qIdx: 5,
        formId: mockFormId,
        answer: {
          answer: "This is a long paragraph answer with multiple sentences.",
          isCorrect: true,
        },
        score: 20,
      };

      const result = GetAnswerKeyForQuestion(paragraphQuestion) as AnswerKey;

      expect(result).toEqual({
        answer: "This is a long paragraph answer with multiple sentences.",
        isCorrect: true,
      });
    });

    it("should return answer as-is for number questions", () => {
      const numberQuestion: ContentType = {
        _id: "q6",
        title: createMockTitle(),
        type: QuestionType.Number,
        qIdx: 6,
        formId: mockFormId,
        answer: {
          answer: 42,
          isCorrect: true,
        },
        score: 5,
      };

      const result = GetAnswerKeyForQuestion(numberQuestion) as AnswerKey;

      expect(result).toEqual({
        answer: 42,
        isCorrect: true,
      });
    });

    it("should return answer as-is for date questions", () => {
      const testDate = new Date("2024-01-15");
      const dateQuestion: ContentType = {
        _id: "q7",
        title: createMockTitle(),
        type: QuestionType.Date,
        qIdx: 7,
        formId: mockFormId,
        answer: {
          answer: testDate,
          isCorrect: true,
        },
        score: 5,
      };

      const result = GetAnswerKeyForQuestion(dateQuestion) as AnswerKey;

      expect(result).toEqual({
        answer: testDate,
        isCorrect: true,
      });
    });

    it("should return answer as-is for range number questions", () => {
      const rangeNumberQuestion: ContentType = {
        _id: "q8",
        title: createMockTitle(),
        type: QuestionType.RangeNumber,
        qIdx: 8,
        formId: mockFormId,
        answer: {
          answer: { start: 10, end: 50 },
          isCorrect: true,
        },
        score: 15,
      };

      const result = GetAnswerKeyForQuestion(rangeNumberQuestion) as AnswerKey;

      expect(result).toEqual({
        answer: { start: 10, end: 50 },
        isCorrect: true,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should return undefined when content has no answer", () => {
      const questionWithoutAnswer: ContentType = {
        _id: "q9",
        title: createMockTitle(),
        type: QuestionType.MultipleChoice,
        qIdx: 9,
        formId: mockFormId,
        multiple: [
          { idx: 0, content: "Option A" },
          { idx: 1, content: "Option B" },
        ],
        // No answer property
        score: 10,
      };

      const result = GetAnswerKeyForQuestion(questionWithoutAnswer);

      expect(result).toBeUndefined();
    });

    it("should handle undefined answer property gracefully", () => {
      const questionWithUndefinedAnswer: ContentType = {
        _id: "q10",
        title: createMockTitle(),
        type: QuestionType.ShortAnswer,
        qIdx: 10,
        formId: mockFormId,
        answer: undefined,
        score: 5,
      };

      const result = GetAnswerKeyForQuestion(questionWithUndefinedAnswer);

      expect(result).toBeUndefined();
    });

    it("should handle question with empty string answer", () => {
      const questionWithEmptyAnswer: ContentType = {
        _id: "q11",
        title: createMockTitle(),
        type: QuestionType.Text,
        qIdx: 11,
        formId: mockFormId,
        answer: {
          answer: "",
          isCorrect: true,
        },
        score: 5,
      };

      const result = GetAnswerKeyForQuestion(
        questionWithEmptyAnswer
      ) as AnswerKey;

      expect(result).toEqual({
        answer: "",
        isCorrect: true,
      });
    });

    it("should handle question with zero as answer", () => {
      const questionWithZeroAnswer: ContentType = {
        _id: "q12",
        title: createMockTitle(),
        type: QuestionType.Number,
        qIdx: 12,
        formId: mockFormId,
        answer: {
          answer: 0,
          isCorrect: true,
        },
        score: 5,
      };

      const result = GetAnswerKeyForQuestion(
        questionWithZeroAnswer
      ) as AnswerKey;

      expect(result).toEqual({
        answer: 0,
        isCorrect: true,
      });
    });
  });

  describe("Type Validation", () => {
    it("should handle all supported question types", () => {
      const supportedTypes = [
        QuestionType.MultipleChoice,
        QuestionType.CheckBox,
        QuestionType.Selection,
        QuestionType.ShortAnswer,
        QuestionType.Paragraph,
        QuestionType.Text,
        QuestionType.Number,
        QuestionType.Date,
        QuestionType.RangeDate,
        QuestionType.RangeNumber,
      ];

      supportedTypes.forEach((type) => {
        const question: ContentType = {
          _id: `q_${type}`,
          title: createMockTitle(),
          type: type,
          qIdx: 1,
          formId: mockFormId,
          answer: {
            answer:
              type === QuestionType.CheckBox
                ? [0]
                : type === QuestionType.MultipleChoice ||
                  type === QuestionType.Selection
                ? 0
                : "test answer",
            isCorrect: true,
          },
          score: 10,
        };

        // Add required choice arrays for choice-based questions
        if (type === QuestionType.MultipleChoice) {
          question.multiple = [{ idx: 0, content: "Option A" }];
        } else if (type === QuestionType.CheckBox) {
          question.checkbox = [{ idx: 0, content: "Option A" }];
        } else if (type === QuestionType.Selection) {
          question.selection = [{ idx: 0, content: "Option A" }];
        }

        // Function should not throw errors for any supported type
        expect(() => GetAnswerKeyForQuestion(question)).not.toThrow();
      });
    });
  });
});
