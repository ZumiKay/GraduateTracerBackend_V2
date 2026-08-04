import { ContentType, QuestionType, RangeType } from "../model/Content.model";
import { ResponseAnswerType, ResponseSetType } from "../model/Response.model";
import {
  ErrorValidatePropsType,
  PredefinedErrorMessage,
  ValidationErrorCodeEnum,
  ValidationErrorCodeType,
} from "../types/validation.types";
import { isRangeValueValid } from "../utilities/helper";

export const ResponseContentValidateErrorCode: Array<ValidationErrorCodeType> =
  [
    {
      name: ValidationErrorCodeEnum.format,
      message: "Invalid format",
    },
    {
      name: ValidationErrorCodeEnum.answerformat,
      message: "Invalid answer format",
    },
  ];

export class ResponseContentValidationService {
  //Check the valid of question answers and scores

  static validateAnswerFormat(
    questionType: QuestionType,
    answer: ResponseAnswerType,
    content: ContentType,
  ): { isValid: boolean; errors: Array<ErrorValidatePropsType> } {
    const errors: Array<ErrorValidatePropsType> = [];

    const questionId = `Question ${content.questionId}`;
    const { _id, page, qIdx } = content;

    const errorProps: ErrorValidatePropsType = {
      _id: _id?.toString(),
      qIdx,
      page: page ?? 1,
      questionId,
      message: PredefinedErrorMessage()[ValidationErrorCodeEnum.answerformat],
    };

    switch (questionType) {
      case QuestionType.MultipleChoice:
      case QuestionType.Selection:
      case QuestionType.CheckBox:
      case QuestionType.MultipleSelection:
        if (
          Array.isArray(answer)
            ? answer.some((i) => isNaN(i))
            : isNaN(answer as never)
        ) {
          errors.push(errorProps);
        }
        break;

      case QuestionType.Text:
      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        if (typeof answer !== "string") {
          errors.push(errorProps);
        }
        break;

      case QuestionType.Number:
        if (typeof answer !== "number") {
          errors.push(errorProps);
        }
        break;

      case QuestionType.Date:
        if (typeof answer !== "string") {
          errors.push(errorProps);
        }
        break;

      case QuestionType.RangeDate:
        {
          if (!this.isValidRangeObject(answer)) {
            errors.push(errorProps);
          }

          //Verify if range date value is correct format
          if (!isRangeValueValid(answer as RangeType<string>, true)) {
            errors.push(errorProps);
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
            errors.push(errorProps);
          }
          if (!isRangeValueValid(localAnswer)) {
            errors.push(errorProps);
          }
        }
        break;

      default:
        errors.push(errorProps);
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

  static calcualteResponseTotalScore(
    responseSet: Array<ResponseSetType>,
  ): number {
    let totalscore = 0;

    for (let r = 0; r < responseSet.length; r++) {
      const res = responseSet[r];

      //?Ignore the response have no saved question and question with parentContent
      if (res.question) {
        const ques = res.question as ContentType;
        if (!ques.parentcontent) {
          totalscore += res.score ?? 0;
        }
      }
    }

    return totalscore;
  }

  private static normalizeChoiceAnswer = (answer: ResponseAnswerType) => {
    return answer as number[];
  };

  static calculateResponseScore(
    userAnswer: ResponseAnswerType,
    correctAnswer: ResponseAnswerType,
    questionType: QuestionType,
    maxScore: number,
  ): number {
    if (!correctAnswer || maxScore === 0) return 0;

    switch (questionType) {
      case QuestionType.Text:
        return 0;

      case QuestionType.MultipleChoice:
      case QuestionType.CheckBox:
      case QuestionType.Selection: {
        const normalizedUser = this.normalizeChoiceAnswer(userAnswer);
        const normalizedCorrect = this.normalizeChoiceAnswer(correctAnswer);
        if (!normalizedUser || !normalizedCorrect) return 0;
        return this.calculateChoiceQuestionScore(
          normalizedUser,
          normalizedCorrect,
          maxScore,
        );
      }

      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        return this.calculateTextScore(
          userAnswer as string,
          correctAnswer as string,
          maxScore,
        );

      case QuestionType.Number:
        return userAnswer === correctAnswer ? maxScore : 0;

      case QuestionType.Date:
        return this.calculateDateScore(
          userAnswer as string,
          correctAnswer as string,
          maxScore,
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
    maxScore: number,
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
    maxScore: number,
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
    maxScore: number,
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
    maxScore: number,
  ): number {
    if (
      !this.isValidRangeObject(userAnswer) ||
      !this.isValidRangeObject(correctAnswer)
    )
      return 0;

    const userStart = userAnswer.start;
    const userEnd = userAnswer.end;
    const correctStart = correctAnswer.start;
    const correctEnd = correctAnswer.end;

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

export default ResponseContentValidationService;
