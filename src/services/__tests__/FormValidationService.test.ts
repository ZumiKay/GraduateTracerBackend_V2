import { Types } from "mongoose";
import { QuestionType } from "../../model/Content.model";
import { TypeForm, returnscore } from "../../model/Form.model";
import { MockContentFactory } from "../../utilities/mockdata";
import {
  FormValidationService,
  formValidationErrorByContentTypes,
} from "../FormValidationService";
import { ValidationErrorCodeEnum } from "../../types/validation.types";
import { GetFilterTypeEnum } from "../../controller/form/form.query.controller";

const formId = new Types.ObjectId();

function makeForm(
  overrides: Partial<{
    type: string;
    setting: Record<string, unknown>;
  }> = {},
) {
  return {
    _id: new Types.ObjectId(),
    type: TypeForm.Quiz,
    setting: { returnscore: returnscore.partial },
    totalpage: 1,
    contentIds: [],
    title: "Test Form",
    ...overrides,
  } as never;
}

describe("formValidationErrorByContentTypes", () => {
  describe("QuestionType.Text", () => {
    it("returns an error when a text question has a score", () => {
      const content = MockContentFactory.createTextContent({
        formId,
        score: 5,
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.Text](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.invalid);
    });

    it("returns an error when a text question has isBonusScore set", () => {
      const content = MockContentFactory.createTextContent({
        formId,
        isBonusScore: true,
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.Text](content);
      expect(errors).toHaveLength(1);
    });
  });

  describe("QuestionType.MultipleChoice", () => {
    it("returns no errors when options are present and non-empty", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.MultipleChoice](content);
      expect(errors).toHaveLength(0);
    });

    it("returns an error when multiple is empty", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        multiple: [],
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.MultipleChoice](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.format);
    });

    it("returns an error when a choice option has empty content", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        multiple: [{ idx: 0, content: "" }],
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.MultipleChoice](content);
      expect(errors).toHaveLength(1);
    });
  });

  describe("QuestionType.CheckBox", () => {
    it("returns no errors when checkbox options are present", () => {
      const content = MockContentFactory.createCheckboxContent({ formId });
      const errors =
        formValidationErrorByContentTypes[QuestionType.CheckBox](content);
      expect(errors).toHaveLength(0);
    });

    it("returns an error when checkbox options are empty", () => {
      const content = MockContentFactory.createCheckboxContent({
        formId,
        checkbox: [],
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.CheckBox](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.format);
    });
  });

  describe("QuestionType.Number", () => {
    it("returns no errors when answer is a valid number", () => {
      const content = MockContentFactory.createNumberContent({ formId });
      const errors =
        formValidationErrorByContentTypes[QuestionType.Number](content);
      expect(errors).toHaveLength(0);
    });

    it("returns an error when answer is not a number", () => {
      const content = MockContentFactory.createNumberContent({
        formId,
        answer: { _id: new Types.ObjectId(), answer: "not-a-number" as never },
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.Number](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.answerformat);
    });
  });

  describe("QuestionType.RangeNumber", () => {
    it("returns no errors for a valid range", () => {
      const content = MockContentFactory.createRangeNumberContent({
        formId,
        rangenumber: { start: 0, end: 100 },
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.RangeNumber](content);
      expect(errors).toHaveLength(0);
    });

    it("returns an error when start > end", () => {
      const content = MockContentFactory.createRangeNumberContent({
        formId,
        rangenumber: { start: 100, end: 0 },
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.RangeNumber](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.format);
    });
  });

  describe("QuestionType.RangeDate", () => {
    it("returns no errors for a valid date range", () => {
      const content = MockContentFactory.createRangeDateContent({
        formId,
        rangedate: { start: "2024-01-01", end: "2024-12-31" } as never,
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.RangeDate](content);
      expect(errors).toHaveLength(0);
    });

    it("returns an error when start date is after end date", () => {
      const content = MockContentFactory.createRangeDateContent({
        formId,
        rangedate: { start: "2024-12-31", end: "2024-01-01" } as never,
      });
      const errors =
        formValidationErrorByContentTypes[QuestionType.RangeDate](content);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe(ValidationErrorCodeEnum.format);
    });
  });
});

describe("FormValidationService.validateContent", () => {
  describe("Solution Tab only", () => {
    it("is valid for a question with no parent or score constraints", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 1,
      });
      const result = FormValidationService.validateContent({ content });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("adds a warning when an auto-scorable question is missing score or answer", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 1,
        score: 0,
        answer: undefined,
      });
      const result = FormValidationService.validateContent({ content });
      expect(result.warnings).toHaveLength(1);
    });

    it("is valid when child score equals parentScore", () => {
      const parentId = new Types.ObjectId().toString();
      const content = MockContentFactory.createMinimalContent(
        QuestionType.MultipleChoice,
        {
          formId,
          qIdx: 2,
          score: 10,
          parentcontent: {
            _id: new Types.ObjectId().toString(),
            qId: parentId,
            qIdx: 1,
            optIdx: 0,
          },
        },
      );
      const result = FormValidationService.validateContent({
        content,
        parentScore: 10,
      });
      expect(result.wrongScores).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });

    it("flags wrongScores when useChildSum sibling total exceeds parentScore", () => {
      const parentId = new Types.ObjectId().toString();
      const content = MockContentFactory.createMinimalContent(
        QuestionType.MultipleChoice,
        {
          formId,
          qIdx: 3,
          score: 8,
          parentcontent: {
            _id: new Types.ObjectId().toString(),
            qId: parentId,
            qIdx: 1,
            optIdx: 0,
          },
        },
      );
      // siblingSumScore = 5, content.score = 8, total = 13 > parentScore (10)
      const result = FormValidationService.validateContent({
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
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 1,
        multiple: [],
      });
      const result = FormValidationService.validateContent({
        content,
        validateContentDetail: true,
      });
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("is valid for a MultipleChoice question with valid options", () => {
      const content = MockContentFactory.createMultipleChoiceContent({
        formId,
        qIdx: 1,
      });
      const result = FormValidationService.validateContent({
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
      MockContentFactory.createTextContent({ formId, qIdx: 0 }),
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 1 }),
    ];
    const result = FormValidationService.validateForm(
      makeForm(),
      contents,
      1,
      GetFilterTypeEnum.solution,
    );
    // Only 1 non-text question evaluated
    expect(result.totalValidQuestions + result.totalInvalidQuestions).toBe(1);
  });

  it("returns canReturnScoreAutomatically=true for a fully valid Quiz with partial return", () => {
    const contents = [
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
    ];
    const result = FormValidationService.validateForm(
      makeForm(),
      contents,
      1,
      GetFilterTypeEnum.solution,
    );
    expect(result.canReturnScoreAutomatically).toBe(true);
    expect(result.totalInvalidQuestions).toBe(0);
  });

  it("returns canReturnScoreAutomatically=false for a Normal form", () => {
    const contents = [
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
    ];
    const result = FormValidationService.validateForm(
      makeForm({ type: TypeForm.Normal }),
      contents,
      1,
      GetFilterTypeEnum.solution,
    );
    expect(result.canReturnScoreAutomatically).toBe(false);
  });

  it("returns canReturnScoreAutomatically=false when returnscore is manual", () => {
    const contents = [
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
    ];
    const result = FormValidationService.validateForm(
      makeForm({ setting: { returnscore: returnscore.manual } }),
      contents,
      1,
      GetFilterTypeEnum.solution,
    );
    expect(result.canReturnScoreAutomatically).toBe(false);
  });

  it("aggregates warnings across multiple auto-scorable questions missing answers", () => {
    const q1 = MockContentFactory.createMultipleChoiceContent({
      formId,
      qIdx: 0,
      score: 0,
      answer: undefined,
    });
    const q2 = MockContentFactory.createCheckboxContent({
      formId,
      qIdx: 1,
      score: 0,
      answer: undefined,
    });
    const result = FormValidationService.validateForm(
      makeForm(),
      [q1, q2],
      1,
      GetFilterTypeEnum.solution,
    );
    expect(result.validationResults.warnings!.length).toBeGreaterThanOrEqual(2);
  });

  it("includes scoringAnalysis and initialCurrentPageScoreAnalysis in result", () => {
    const contents = [
      MockContentFactory.createMultipleChoiceContent({ formId, qIdx: 0 }),
    ];
    const result = FormValidationService.validateForm(
      makeForm(),
      contents,
      1,
      GetFilterTypeEnum.solution,
    );
    expect(result.scoringAnalysis).toBeDefined();
    expect(result.initialCurrentPageScoreAnalysis).toBeDefined();
  });
});

describe("FormValidationService.getValidationMessageByQId", () => {
  const qId = new Types.ObjectId().toString();
  const issues = [
    {
      _id: qId,
      qIdx: 1,
      questionId: "Question 1",
      page: 1,
      message: {
        name: ValidationErrorCodeEnum.score,
        message: "Invalid Score",
      },
    },
    {
      _id: new Types.ObjectId().toString(),
      qIdx: 2,
      questionId: "Question 2",
      page: 1,
      message: {
        name: ValidationErrorCodeEnum.format,
        message: "Invalid Format",
      },
    },
  ];

  it("returns messages matching by _id", () => {
    const result = FormValidationService.getValidationMessageByQId(issues, qId);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe(ValidationErrorCodeEnum.score);
  });

  it("returns messages matching by qIdx", () => {
    const result = FormValidationService.getValidationMessageByQId(issues, 2);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe(ValidationErrorCodeEnum.format);
  });

  it("returns an empty array when no match is found", () => {
    const result = FormValidationService.getValidationMessageByQId(
      issues,
      "nonexistent-id",
    );
    expect(result).toHaveLength(0);
  });
});
