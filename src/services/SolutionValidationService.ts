import Content, { ContentType, QuestionType } from "../model/Content.model";
import Form, { TypeForm, returnscore } from "../model/Form.model";
import { Types } from "mongoose";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingAnswers: string[];
  missingScores: string[];
}

export interface FormValidationSummary {
  canReturnScoreAutomatically: boolean;
  totalValidQuestions: number;
  totalInvalidQuestions: number;
  totalScore: number;
  validationResults: ValidationResult[];
}

export class SolutionValidationService {
  //Check the valid of question answers and scores
  static validateContent(
    content: ContentType,
    parentScore?: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingAnswers: string[] = [];
    const missingScores: string[] = [];
    const questionTitle = content.qIdx
      ? `Question ${content.qIdx}`
      : `Condition of Question ${content.parentcontent?.qIdx}`;

    if (content.type === QuestionType.Text) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        missingAnswers: [],
        missingScores: [],
      };
    }

    // Check if content has answer
    if (
      !content.answer ||
      content.answer.answer === null ||
      content.answer.answer === undefined
    ) {
      missingAnswers.push(`Question "${content.title}" has no answer key`);
    }

    // Check if content has score
    if (
      content.score === null ||
      content.score === undefined ||
      content.score === 0
    ) {
      missingScores.push(`${questionTitle} has no score assigned`);
    }

    //validate conditioned question score
    if (content.score && content.parentcontent && parentScore) {
      const isValid = content.score > parentScore;
      if (!isValid) {
        missingScores.push(`${questionTitle} has wrong score`);
      }
    }

    // Validate answer format based on question type
    if (content.answer && content.answer.answer) {
      const answerValidation = this.validateAnswerFormat(
        content.type,
        content.answer.answer,
        content
      );
      if (!answerValidation.isValid) {
        errors.push(...answerValidation.errors);
      }
    }

    // Check if required question has proper setup
    if (content.require && (!content.answer || !content.score)) {
      errors.push(`Required ${questionTitle} must have both answer and score`);
    }

    const isValid =
      errors.length === 0 &&
      missingAnswers.length === 0 &&
      missingScores.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingAnswers,
      missingScores,
    };
  }

  private static validateAnswerFormat(
    questionType: QuestionType,
    answer: any,
    content: ContentType
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (questionType) {
      case QuestionType.MultipleChoice:
        if (!Array.isArray(answer) || answer.length === 0) {
          errors.push(
            "Multiple choice answer must be an array with at least one selection"
          );
        } else {
          const maxIndex = (content.multiple?.length || 0) - 1;
          const invalidIndices = answer.filter(
            (idx: number) => idx > maxIndex || idx < 0
          );
          if (invalidIndices.length > 0) {
            errors.push(`Invalid answer indices: ${invalidIndices.join(", ")}`);
          }
        }
        break;

      case QuestionType.CheckBox:
        if (!Array.isArray(answer)) {
          errors.push("Checkbox answer must be an array");
        } else {
          const maxIndex = (content.checkbox?.length || 0) - 1;
          const invalidIndices = answer.filter(
            (idx: number) => idx > maxIndex || idx < 0
          );
          if (invalidIndices.length > 0) {
            errors.push(
              `Invalid checkbox indices: ${invalidIndices.join(", ")}`
            );
          }
        }
        break;

      case QuestionType.Text:
      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        if (typeof answer !== "string") {
          errors.push("Text answer must be a string");
        }
        break;

      case QuestionType.Number:
        if (typeof answer !== "number") {
          errors.push("Number answer must be a number");
        }
        break;

      case QuestionType.Date:
        if (!(answer instanceof Date) && !this.isValidDateString(answer)) {
          errors.push("Date answer must be a valid date");
        }
        break;

      case QuestionType.RangeDate:
        if (
          !this.isValidRangeObject(answer) ||
          !this.isValidDateString(answer.start) ||
          !this.isValidDateString(answer.end)
        ) {
          errors.push("Range date answer must have valid start and end dates");
        }
        break;

      case QuestionType.RangeNumber:
        if (
          !this.isValidRangeObject(answer) ||
          typeof answer.start !== "number" ||
          typeof answer.end !== "number"
        ) {
          errors.push(
            "Range number answer must have valid start and end numbers"
          );
        }
        break;

      case QuestionType.Selection:
        if (!Array.isArray(answer) || answer.length === 0) {
          errors.push(
            "Selection answer must be an array with at least one selection"
          );
        }
        break;

      default:
        errors.push(`Unsupported question type: ${questionType}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  private static isValidDateString(date: any): boolean {
    if (date instanceof Date) return !isNaN(date.getTime());
    if (typeof date === "string") {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }
    return false;
  }

  private static isValidRangeObject(obj: any): boolean {
    return obj && typeof obj === "object" && "start" in obj && "end" in obj;
  }

  /**
   * Validates entire form for quiz requirements
   */
  static async validateForm(formId: string): Promise<FormValidationSummary> {
    const form = await Form.findById(formId);
    if (!form) {
      throw new Error("Form not found");
    }

    const contents = await Content.find({
      formId: new Types.ObjectId(formId),
    }).lean();
    const validationResults: ValidationResult[] = [];
    let totalValidQuestions = 0;
    let totalInvalidQuestions = 0;
    let totalScore = 0;

    for (const content of contents) {
      if (content.type === QuestionType.Text) {
        const result = this.validateContent(content);
        validationResults.push(result);
        continue;
      }

      const parentScore = contents.find(
        (ques) => ques._id.toString() === content.parentcontent?.qId
      )?.score;
      const result = this.validateContent(content, parentScore);
      validationResults.push(result);

      if (!content.parentcontent) totalScore += content.score || 0;

      if (result.isValid) {
        totalValidQuestions++;
      } else {
        totalInvalidQuestions++;
      }
    }

    const scorableQuestions = contents.filter(
      (content) => content.type !== QuestionType.Text
    );

    const canReturnScoreAutomatically =
      form.type === TypeForm.Quiz &&
      totalInvalidQuestions === 0 &&
      scorableQuestions.length > 0 &&
      form.setting?.returnscore === returnscore.partial;

    return {
      canReturnScoreAutomatically,
      totalValidQuestions,
      totalInvalidQuestions,
      totalScore,
      validationResults,
    };
  }

  static async getFormValidationErrors(formId: string): Promise<string[]> {
    const summary = await this.validateForm(formId);
    const errors: string[] = [];

    if (summary.totalInvalidQuestions > 0) {
      errors.push(
        `${summary.totalInvalidQuestions} question(s) have validation errors`
      );
    }

    const allMissingAnswers = summary.validationResults.flatMap(
      (r) => r.missingAnswers
    );
    const allMissingScores = summary.validationResults.flatMap(
      (r) => r.missingScores
    );

    if (allMissingAnswers.length > 0) {
      errors.push(`Missing answers: ${allMissingAnswers.length} question(s)`);
    }

    if (allMissingScores.length > 0) {
      errors.push(`Missing scores: ${allMissingScores.length} question(s)`);
    }

    return errors;
  }

  static calculateResponseScore(
    userAnswer: any,
    correctAnswer: any,
    questionType: QuestionType,
    maxScore: number
  ): number {
    if (!correctAnswer || maxScore === 0) return 0;

    switch (questionType) {
      case QuestionType.Text:
        return 0;

      case QuestionType.MultipleChoice:
      case QuestionType.CheckBox: {
        return this.calculateArrayScore(userAnswer, correctAnswer, maxScore);
      }

      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        return this.calculateTextScore(userAnswer, correctAnswer, maxScore);

      case QuestionType.Number:
        return userAnswer === correctAnswer ? maxScore : 0;

      case QuestionType.Date:
        return this.calculateDateScore(userAnswer, correctAnswer, maxScore);

      case QuestionType.RangeDate:
      case QuestionType.RangeNumber:
        return this.calculateRangeScore(userAnswer, correctAnswer, maxScore);

      case QuestionType.Selection:
        return this.calculateArrayScore(userAnswer, correctAnswer, maxScore);

      default:
        return 0;
    }
  }

  /**
   * Calculate score for array-based answers (multiple choice, checkbox, selection)
   */
  private static calculateArrayScore(
    userAnswer: number[],
    correctAnswer: number[],
    maxScore: number
  ): number {
    if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) return 0;

    const userSet = new Set(userAnswer);
    const correctSet = new Set(correctAnswer);

    const intersection = new Set([...userSet].filter((x) => correctSet.has(x)));
    const union = new Set([...userSet, ...correctSet]);

    if (
      intersection.size === correctSet.size &&
      userSet.size === correctSet.size
    ) {
      return maxScore;
    }

    const similarity = intersection.size / union.size;
    return Math.round(maxScore * similarity);
  }

  /**
   * Calculate score for text-based answers
   */
  private static calculateTextScore(
    userAnswer: string,
    correctAnswer: string,
    maxScore: number
  ): number {
    if (typeof userAnswer !== "string" || typeof correctAnswer !== "string")
      return 0;

    const userText = userAnswer.trim().toLowerCase();
    const correctText = correctAnswer.trim().toLowerCase();

    if (userText === correctText) return maxScore;

    const similarity = this.calculateTextSimilarity(userText, correctText);
    return similarity > 0.8 ? maxScore : 0;
  }

  /**
   * Calculate score for date answers
   */
  private static calculateDateScore(
    userAnswer: string,
    correctAnswer: string,
    maxScore: number
  ): number {
    const userDate = new Date(userAnswer);
    const correctDate = new Date(correctAnswer);

    if (isNaN(userDate.getTime()) || isNaN(correctDate.getTime())) return 0;

    return userDate.getTime() === correctDate.getTime() ? maxScore : 0;
  }

  /**
   * Calculate score for range answers
   */
  private static calculateRangeScore(
    userAnswer: any,
    correctAnswer: any,
    maxScore: number
  ): number {
    if (
      !this.isValidRangeObject(userAnswer) ||
      !this.isValidRangeObject(correctAnswer)
    )
      return 0;

    const userStart = new Date(userAnswer.start).getTime() || userAnswer.start;
    const userEnd = new Date(userAnswer.end).getTime() || userAnswer.end;
    const correctStart =
      new Date(correctAnswer.start).getTime() || correctAnswer.start;
    const correctEnd =
      new Date(correctAnswer.end).getTime() || correctAnswer.end;

    return userStart === correctStart && userEnd === correctEnd ? maxScore : 0;
  }

  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}

export default SolutionValidationService;
