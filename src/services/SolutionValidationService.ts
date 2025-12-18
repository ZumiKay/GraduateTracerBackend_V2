import Content, {
  ContentType,
  QuestionType,
  RangeType,
} from "../model/Content.model";
import Form, { TypeForm, returnscore } from "../model/Form.model";
import { Types } from "mongoose";
import { ResponseAnswerType, ResponseSetType } from "../model/Response.model";
import { AddQuestionNumbering, isRangeValueValid } from "../utilities/helper";
import { getFormScoringAnalysis } from "../utilities/scoreHelper";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingAnswers: string[];
  missingScores: string[];
  wrongScores: string[];
}

export interface CombinedValidationResults {
  errors: string[];
  warnings: string[];
  missingAnswers: string[];
  missingScores: string[];
  wrongScores: string[];
}

export interface ScoringAnalysis {
  isAutoScoreable: boolean;
  totalQuestions: number;
  scoredQuestions: number;
  autoScorableQuestions: number;
  manualGradingQuestions: number;
  missingAnswerKeys: Array<{ qIdx: number; title: string; type: QuestionType }>;
  unsupportedTypes: Array<{ qIdx: number; title: string; type: QuestionType }>;
}

export interface FormValidationSummary {
  canReturnScoreAutomatically: boolean;
  totalValidQuestions: number;
  totalInvalidQuestions: number;
  totalScore: number;
  validationResults: CombinedValidationResults;
  scoringAnalysis?: ScoringAnalysis;
}

export class SolutionValidationService {
  //Check the valid of question answers and scores

  /**
   * @params
   * - content: Contenttype (questionId is required)
   * - parentScore: number
   *
   * @returns
   * - errors
   * - warnings
   * - missingAnswers
   * - missingScores
   * - wrongScores
   */
  static validateContent(
    content: ContentType,
    parentScore?: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingAnswers: string[] = [];
    const missingScores: string[] = [];
    const wrongScores: string[] = [];

    const questionTitle = `Question ${content.questionId}`;

    if (content.type === QuestionType.Text) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        missingAnswers: [],
        missingScores: [],
        wrongScores: [],
      };
    }

    // Check if content has answer
    if (
      (!content.answer ||
        content.answer.answer === null ||
        content.answer.answer === undefined) &&
      content.type !== QuestionType.ShortAnswer &&
      content.type !== QuestionType.Paragraph
    ) {
      missingAnswers.push(questionTitle);
    }

    // Check if content has score
    if (
      content.score === null ||
      content.score === undefined ||
      content.score === 0
    ) {
      missingScores.push(questionTitle);
    }

    //validate child conditioned question score
    if (content.score && content.parentcontent && parentScore) {
      const isValid = content.score > parentScore;
      if (isValid) {
        wrongScores.push(questionTitle);
      }
    }

    // Validate answer format based on question type
    if (
      content.answer &&
      content.answer.answer &&
      content.type !== QuestionType.ShortAnswer &&
      content.type !== QuestionType.Paragraph
    ) {
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
      //Required Score only for short answer and paragraph question type
      if (
        content.type === QuestionType.ShortAnswer ||
        content.type === QuestionType.Paragraph
      ) {
        if (!content.score)
          errors.push(`Required ${questionTitle} must have scores`);
      } else {
        errors.push(
          `Required ${questionTitle} must have both answer and score`
        );
      }
    }

    const isValid =
      errors.length === 0 &&
      missingAnswers.length === 0 &&
      missingScores.length === 0 &&
      wrongScores.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingAnswers,
      missingScores,
      wrongScores,
    };
  }

  static validateAnswerFormat(
    questionType: QuestionType,
    answer: ResponseAnswerType,
    content: ContentType
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (questionType) {
      case QuestionType.MultipleChoice:
      case QuestionType.Selection:
        if (typeof answer !== "number") {
          errors.push(`Multiple Question ${content.qIdx} have invalid answer`);
        }
        break;

      case QuestionType.CheckBox:
        if (!Array.isArray(answer)) {
          errors.push(`Checkbox Question ${content.qIdx} have invalid answer`);
        } else {
          //Verify integrity of check answer
          const maxIndex = (content.checkbox?.length || 0) - 1;
          const invalidIndices = answer.filter(
            (idx: number) => idx > maxIndex || idx < 0
          );
          if (invalidIndices.length > 0) {
            errors.push(
              `Question ${
                content.qIdx
              } Invalid checkbox indices: ${invalidIndices.join(", ")}`
            );
          }
        }
        break;

      case QuestionType.Text:
      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        if (typeof answer !== "string") {
          errors.push(`Question ${content.qIdx} Text answer must be a string`);
        }
        break;

      case QuestionType.Number:
        if (typeof answer !== "number") {
          errors.push(
            `Question ${content.qIdx} number answer must be a number`
          );
        }
        break;

      case QuestionType.Date:
        if (typeof answer !== "string") {
          errors.push(`Question ${content.qIdx} have invalid answer`);
        }
        break;

      case QuestionType.RangeDate:
        {
          if (!this.isValidRangeObject(answer)) {
            errors.push(
              "Range date answer must have valid start and end dates"
            );
          }

          //Verify if range date value is correct format
          if (!isRangeValueValid(answer as RangeType<string>, true)) {
            errors.push(`Question ${content.qIdx} have invalid answer`);
          }
        }
        break;

      case QuestionType.RangeNumber:
        {
          const localAnswer = answer as RangeType<number>;
          if (
            !this.isValidRangeObject(answer) ||
            typeof localAnswer.start !== "number" ||
            typeof localAnswer.end !== "number"
          ) {
            errors.push(
              "Range number answer must have valid start and end numbers"
            );
          }
          if (!isRangeValueValid(localAnswer)) {
            errors.push(`Question ${content.qIdx} have invalid answer`);
          }
        }
        break;

      default:
        errors.push(`Unsupported question type: ${questionType}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  static isAnswerisempty(answer: ResponseAnswerType): boolean {
    if (answer === null || answer === undefined) {
      return true;
    }

    if (typeof answer === "string") {
      return answer.trim() === "";
    }

    if (typeof answer === "number") {
      return false;
    }

    if (typeof answer === "boolean") {
      return false;
    }

    if (Array.isArray(answer)) {
      return answer.length === 0;
    }

    if (typeof answer === "object" && answer !== null) {
      const rangeAnswer = answer as RangeType<any>;
      if ("start" in rangeAnswer && "end" in rangeAnswer) {
        const startEmpty =
          rangeAnswer.start === null ||
          rangeAnswer.start === undefined ||
          (typeof rangeAnswer.start === "string" &&
            rangeAnswer.start.trim() === "");
        const endEmpty =
          rangeAnswer.end === null ||
          rangeAnswer.end === undefined ||
          (typeof rangeAnswer.end === "string" &&
            rangeAnswer.end.trim() === "");
        return startEmpty && endEmpty;
      }
    }

    return false;
  }

  private static isValidRangeObject(obj: any): boolean {
    return obj && typeof obj === "object" && "start" in obj && "end" in obj;
  }

  /**
   * Validates entire form for quiz requirements
   * @param formId type string
   * @returns 
   *  - canReturnScoreAutomatically,
      - totalValidQuestions
      - totalInvalidQuestions
      - totalScore
      - validationResults, 
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

    for (const content of AddQuestionNumbering({ questions: contents })) {
      if (content.type === QuestionType.Text) {
        //Validate Text Display Only question
        const result = this.validateContent(content);
        validationResults.push(result);
        continue;
      }

      //Validate question with condition
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

    // Combine all validation results into aggregated arrays
    const combinedResults: CombinedValidationResults = {
      errors: validationResults.flatMap((r) => r.errors),
      warnings: validationResults.flatMap((r) => r.warnings),
      missingAnswers: validationResults.flatMap((r) => r.missingAnswers),
      missingScores: validationResults.flatMap((r) => r.missingScores),
      wrongScores: validationResults.flatMap((r) => r.wrongScores),
    };

    // Get detailed scoring analysis
    const scoringAnalysis = getFormScoringAnalysis({ questions: contents });

    return {
      canReturnScoreAutomatically,
      totalValidQuestions,
      totalInvalidQuestions,
      totalScore,
      validationResults: combinedResults,
      scoringAnalysis,
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

    const { missingAnswers, missingScores } = summary.validationResults;

    if (missingAnswers.length > 0) {
      errors.push(`Missing answers: ${missingAnswers.length} question(s)`);
    }

    if (missingScores.length > 0) {
      errors.push(`Missing scores: ${missingScores.length} question(s)`);
    }

    return errors;
  }
  static calcualteResponseTotalScore(
    responseSet: Array<ResponseSetType>
  ): number {
    let totalscore = 0;

    for (let r = 0; r < responseSet.length; r++) {
      const res = responseSet[r];

      //Ignore the response have no saved question and question with parentContent
      if (res.question) {
        const ques = res.question as ContentType;
        if (!ques.parentcontent) {
          totalscore += res.score ?? 0;
        }
      }
    }

    return totalscore;
  }

  static calculateResponseScore(
    userAnswer: ResponseAnswerType,
    correctAnswer: ResponseAnswerType,
    questionType: QuestionType,
    maxScore: number
  ): number {
    if (!correctAnswer || maxScore === 0) return 0;

    switch (questionType) {
      case QuestionType.Text:
        return 0;

      case QuestionType.MultipleChoice:
      case QuestionType.CheckBox:
      case QuestionType.Selection: {
        return this.calculateChoiceQuestionScore(
          userAnswer as Array<number>,
          correctAnswer as Array<number>,
          maxScore
        );
      }

      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        return this.calculateTextScore(
          userAnswer as string,
          correctAnswer as string,
          maxScore
        );

      case QuestionType.Number:
        return userAnswer === correctAnswer ? maxScore : 0;

      case QuestionType.Date:
        return this.calculateDateScore(
          userAnswer as string,
          correctAnswer as string,
          maxScore
        );

      case QuestionType.RangeDate:
      case QuestionType.RangeNumber:
        return this.calculateRangeScore(userAnswer, correctAnswer, maxScore);

      default:
        return 0;
    }
  }

  /**
   * Calculate score for array-based answers (multiple choice, checkbox, selection)
   */
  private static calculateChoiceQuestionScore(
    userAnswer: number[],
    correctAnswer: number[],
    maxScore: number
  ): number {
    //Verify answer format
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

  //Partial text match return partial score for paragrah and short answer
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
