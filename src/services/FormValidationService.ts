import { Request, Response } from "express";
import Content, { ContentType, QuestionType } from "../model/Content.model";
import Form, {
  FormType,
  returnscore,
  SummaryFormType,
  TypeForm,
} from "../model/Form.model";
import { AddQuestionNumbering, ReturnCode } from "../utilities/helper";
import SolutionValidationService from "./ResponseContentValidationService";
import { projections } from "../utilities/formHelpers";
import {
  AUTO_SCORABLE_TYPES,
  DISPLAY_ONLY_TYPES,
  getFormScoringAnalysis,
  MAYBE_AUTO_SCORABLE_TYPES,
} from "../utilities/scoreHelper";
import { Types } from "mongoose";
import {
  ErrorValidatePropsType,
  PredefinedErrorMessage,
  ScoringAnalysis,
  ValidationErrorCodeEnum,
  ValidationErrorCodeType,
  ValidationResult,
} from "../types/validation.types";
import { GetFilterTypeEnum } from "../controller/form/form.query.controller";

export interface ValidationPropsType {
  questionId: string;
  message?: string;
}

export interface FormValidationSummary {
  initialCurrentPageScoreAnalysis?: ScoringAnalysis;
  canReturnScoreAutomatically: boolean;
  totalValidQuestions: number;
  totalInvalidQuestions: number;
  validationResults: ValidationResult;
  scoringAnalysis?: ScoringAnalysis;
}

export const formValidationErrorByContentTypes: Record<
  QuestionType,
  (content: ContentType) => Array<ValidationErrorCodeType>
> = {
  [QuestionType.Text]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    if (
      content.isBonusScore ||
      content.useChildScoreSum ||
      (content.score && content.score > 0)
    ) {
      errors.push(PredefinedErrorMessage()[ValidationErrorCodeEnum.invalid]);
    }
    return errors;
  },

  [QuestionType.MultipleChoice]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    if (
      !content.multiple ||
      !Array.isArray(content.multiple) ||
      content.multiple.length === 0
    ) {
      errors.push(
        PredefinedErrorMessage({
          target: ValidationErrorCodeEnum.format,
          customMess:
            "Multiple choice question requires at least one choice option",
        })[ValidationErrorCodeEnum.format],
      );
    } else {
      const hasEmptyChoice = content.multiple.some(
        (c) => !c.content || c.content.trim() === "",
      );
      if (hasEmptyChoice) {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.format,
            customMess: "Choice options cannot be empty",
          })[ValidationErrorCodeEnum.format],
        );
      }
    }
    return errors;
  },

  [QuestionType.MultipleSelection]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    const options = content.checkbox;
    if (!options || !Array.isArray(options) || options.length === 0) {
      errors.push(
        PredefinedErrorMessage({
          target: ValidationErrorCodeEnum.format,
          customMess: "Multiple selection question requires choice options",
        })[ValidationErrorCodeEnum.format],
      );
    }
    return errors;
  },

  [QuestionType.CheckBox]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    const options = content.checkbox;
    if (!options || !Array.isArray(options) || options.length === 0) {
      errors.push(
        PredefinedErrorMessage({
          target: ValidationErrorCodeEnum.format,
          customMess: "Checkbox question requires choice options",
        })[ValidationErrorCodeEnum.format],
      );
    }
    return errors;
  },

  [QuestionType.Selection]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    const options = content.selection;
    if (!options || !Array.isArray(options) || options.length === 0) {
      errors.push(
        PredefinedErrorMessage({
          target: ValidationErrorCodeEnum.format,
          customMess: "Selection question requires choice options",
        })[ValidationErrorCodeEnum.format],
      );
    } else {
      const hasEmptyChoice = options.some(
        (c) => !c.content || c.content.trim() === "",
      );
      if (hasEmptyChoice) {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.format,
            customMess: "Choice options cannot be empty",
          })[ValidationErrorCodeEnum.format],
        );
      }
    }
    return errors;
  },

  [QuestionType.Number]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    if (content.answer && content.answer.answer !== undefined) {
      if (typeof content.answer.answer !== "number") {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.answerformat,
            customMess: "Number question answer must be a number",
          })[ValidationErrorCodeEnum.answerformat],
        );
      }
    }
    return errors;
  },

  [QuestionType.Date]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];

    if (!content.date || typeof content.date !== "string") {
      errors.push(
        PredefinedErrorMessage({ target: ValidationErrorCodeEnum.format })[
          ValidationErrorCodeEnum.format
        ],
      );
    }

    return errors;
  },

  [QuestionType.RangeDate]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    const range = content.rangedate || content.range;
    if (range && range.start && range.end) {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.answerformat,
            customMess: "RangeDate start and end must be valid dates",
          })[ValidationErrorCodeEnum.answerformat],
        );
      } else if (start > end) {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.format,
            customMess:
              "RangeDate start date must be before or equal to end date",
          })[ValidationErrorCodeEnum.format],
        );
      }
    }
    return errors;
  },

  [QuestionType.RangeNumber]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    const range = content.rangenumber || content.range;
    if (range && range.start !== undefined && range.end !== undefined) {
      if (typeof range.start !== "number" || typeof range.end !== "number") {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.answerformat,
            customMess: "RangeNumber start and end must be numbers",
          })[ValidationErrorCodeEnum.answerformat],
        );
      } else if (range.start > range.end) {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.format,
            customMess: "RangeNumber start must be less than or equal to end",
          })[ValidationErrorCodeEnum.format],
        );
      }
    }
    return errors;
  },

  [QuestionType.ShortAnswer]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    if (content.answer && content.answer.answer !== undefined) {
      if (typeof content.answer.answer !== "string") {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.answerformat,
            customMess: "ShortAnswer answer key must be a text string",
          })[ValidationErrorCodeEnum.answerformat],
        );
      }
    }
    return errors;
  },

  [QuestionType.Paragraph]: (
    content: ContentType,
  ): Array<ValidationErrorCodeType> => {
    const errors: Array<ValidationErrorCodeType> = [];
    if (content.answer && content.answer.answer !== undefined) {
      if (typeof content.answer.answer !== "string") {
        errors.push(
          PredefinedErrorMessage({
            target: ValidationErrorCodeEnum.answerformat,
            customMess: "Paragraph answer key must be a text string",
          })[ValidationErrorCodeEnum.answerformat],
        );
      }
    }
    return errors;
  },
};

export const formValidationErrorByContentType =
  formValidationErrorByContentTypes;

export class FormValidationService {
  public static formValidationErrorByContentTypes =
    formValidationErrorByContentTypes;
  public static formValidationErrorByContentType =
    formValidationErrorByContentType;

  static ValidationResultInitial: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    missingAnswers: [],
    missingScores: [],
    wrongScores: [],
  };
  public static validationFormHandler = async (req: Request, res: Response) => {
    const { formId, action, page, p } = req.query as {
      formId?: string;
      action?: GetFilterTypeEnum;
      page?: string;
      p?: string;
    };

    if (!formId || !Types.ObjectId.isValid(formId) || !action)
      return res.status(400).json(ReturnCode(400));

    const currentPage = Number(page || p) || 1;

    try {
      let result:
        | { validation: FormValidationSummary }
        | SummaryFormType
        | undefined;

      if (action === GetFilterTypeEnum.detail) {
        result = await FormValidationService.getFormOverviewDataById({
          formId: new Types.ObjectId(formId),
          p: currentPage,
        });
      } else if (action === GetFilterTypeEnum.solution) {
        const currentForm = await Form.findById(formId)
          .select(projections.detail)
          .lean();
        if (!currentForm) return res.status(404).json(ReturnCode(404));

        const currentContents = await Content.find({ formId }).lean();
        if (!currentContents.length)
          return res.status(204).json(ReturnCode(204));

        result = {
          validation: this.validateForm(
            currentForm,
            currentContents,
            currentPage,
            action,
          ),
        };
      }
      return res.status(200).json({
        ...ReturnCode(200),
        data: result,
      });
    } catch (error) {
      console.log("Error Validate Form", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  /**Validation individual question for both question and solution */
  static validateContent({
    content,
    parentScore,
    useChildSum,
    siblingSumScore,
    validateContentDetail,
  }: {
    content: ContentType;
    parentScore?: number;
    useChildSum?: boolean;
    siblingSumScore?: number;
    validateContentDetail?: boolean;
  }): ValidationResult {
    const errors: ErrorValidatePropsType[] = [];
    const warnings: ErrorValidatePropsType[] = [];
    const missingAnswers: ErrorValidatePropsType[] = [];
    const missingScores: ErrorValidatePropsType[] = [];
    const wrongScores: ErrorValidatePropsType[] = [];

    const errorItem: ErrorValidatePropsType = {
      _id: content._id?.toString(),
      qIdx: content.qIdx,
      questionId: `Question ${content.questionId || content.qIdx}`,
      page: content.page ?? 1,
    };

    if (validateContentDetail) {
      //Validate for quiz form type
      const allQuestionType = new Set<QuestionType>([
        ...Array.from(MAYBE_AUTO_SCORABLE_TYPES),
        ...Array.from(AUTO_SCORABLE_TYPES),
        ...Array.from(DISPLAY_ONLY_TYPES),
      ]);
      if (!allQuestionType.has(content.type)) {
        return { isValid: false, errors: [errorItem] };
      }

      const typeValidator = formValidationErrorByContentTypes[content.type];
      if (typeValidator) {
        const typeErrors = typeValidator(content);
        if (typeErrors.length > 0) {
          typeErrors.forEach((typeError) => {
            errors.push({ ...errorItem, message: typeError });
          });
        }
      }
    } else {
      //validate child conditioned question score must equal parent score
      if (content.score && content.parentcontent && parentScore) {
        if (useChildSum && siblingSumScore !== undefined) {
          const extractSiblingSum = Math.abs(siblingSumScore - content.score);
          extractSiblingSum + content.score > parentScore &&
            wrongScores.push({
              ...errorItem,
              message: PredefinedErrorMessage()[ValidationErrorCodeEnum.score],
            });
        } else {
          content.score > parentScore &&
            wrongScores.push({
              ...errorItem,
              message: PredefinedErrorMessage()[ValidationErrorCodeEnum.score],
            });
        }
      }

      // Validate answer format based on question type
      if (
        content.answer &&
        content.answer.answer &&
        content.type !== QuestionType.ShortAnswer &&
        content.type !== QuestionType.Paragraph
      ) {
        const answerValidation = SolutionValidationService.validateAnswerFormat(
          content.type,
          content.answer.answer,
          content,
        );
        if (!answerValidation.isValid) {
          errors.push(...answerValidation.errors.map(() => errorItem));
        }
      }

      //Add warning

      if (
        MAYBE_AUTO_SCORABLE_TYPES.union(AUTO_SCORABLE_TYPES).has(content.type)
      ) {
        if (!content.score || !content.answer) {
          warnings.push({
            ...errorItem,
            message: PredefinedErrorMessage({
              target: ValidationErrorCodeEnum.warning,
              customMess: "Missing Score or Answer",
            })[ValidationErrorCodeEnum.warning],
          });
        }
      }
    }

    console.log({ errors, missingAnswers, missingScores, wrongScores });
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

  /**
   * Validates entire form for quiz form requirements (For solution tab only)
   * @param formId type string
   * @returns 
   *  - canReturnScoreAutomatically,
      - totalValidQuestions
      - totalInvalidQuestions
      - totalScore
      - validationResults, 
   */
  static validateForm(
    form: FormType,
    contents: Array<ContentType>,
    page: number = 1,
    type: GetFilterTypeEnum,
  ): FormValidationSummary {
    const validationResults: ValidationResult[] = [];
    let totalValidQuestions = 0;
    let totalInvalidQuestions = 0;

    for (const content of AddQuestionNumbering({ questions: contents })) {
      if (content.type === QuestionType.Text) {
        continue;
      }

      //Validate question with condition
      const parentQ = contents.find(
        (ques) =>
          ques?._id?.toString() === content.parentcontent?.qId ||
          ques.qIdx === content.parentcontent?.qIdx,
      );

      const siblingSumScore = contents
        .filter((c) => c.parentcontent?.qId === parentQ?._id?.toString())
        .reduce((sum, c) => sum + (c.score || 0), 0);

      const result = this.validateContent({
        content,
        useChildSum: parentQ?.useChildScoreSum,
        siblingSumScore,
        validateContentDetail: type === GetFilterTypeEnum.detail,
      });
      validationResults.push(result);

      if (result.isValid) {
        totalValidQuestions++;
      } else {
        totalInvalidQuestions++;
      }
    }

    const scorableQuestions = contents.filter(
      (content) => content.type !== QuestionType.Text,
    );

    const canReturnScoreAutomatically =
      form.type === TypeForm.Quiz &&
      totalInvalidQuestions === 0 &&
      scorableQuestions.length > 0 &&
      form.setting?.returnscore === returnscore.partial;

    // Combine all validation results
    const combinedResults: ValidationResult = {
      isValid: totalInvalidQuestions === 0,
      errors: validationResults.flatMap((r) => r.errors ?? []),
      warnings: validationResults.flatMap((r) => r.warnings ?? []),
      missingAnswers: validationResults.flatMap((r) => r.missingAnswers ?? []),
      missingScores: validationResults.flatMap((r) => r.missingScores ?? []),
      wrongScores: validationResults.flatMap((r) => r.wrongScores ?? []),
    };

    const scoringAnalysis = getFormScoringAnalysis({ questions: contents });
    const initialCurrentPageScoreAnalysis = getFormScoringAnalysis({
      questions: contents.filter((q) => q.page === page),
    });

    //Current page question

    return {
      canReturnScoreAutomatically,
      totalValidQuestions,
      totalInvalidQuestions,
      validationResults: combinedResults,
      scoringAnalysis,
      initialCurrentPageScoreAnalysis,
    };
  }

  static getValidationMessageByQId = (
    issue: ErrorValidatePropsType[],
    questionId: string | number,
  ) =>
    issue
      .filter((i) => i._id === questionId || i.qIdx === questionId)
      .map((i) => i.message);

  static getFormOverviewDataById = async ({
    formId,
    p,
  }: {
    formId: Types.ObjectId;
    p?: number;
  }): Promise<SummaryFormType> => {
    const [summary] = await Content.aggregate([
      { $match: { formId } },
      {
        $group: {
          _id: formId,
          totalQuestions: { $sum: 1 },
          totalConditions: {
            $sum: {
              $cond: [{ $ifNull: ["$parentcontent", false] }, 1, 0],
            },
          },

          currentPageTotalScores: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $ifNull: ["$parentcontent", false] } },
                    { $eq: ["$page", p] },
                  ],
                },
                { $ifNull: ["$score", 0] },
                0,
              ],
            },
          },

          totalScores: {
            //Totalscore of top-level question
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$type", QuestionType.Text] },
                    { $not: { $ifNull: ["$parentcontent", false] } },
                  ],
                },
                { $ifNull: ["$score", 0] },
                0,
              ],
            },
          },
          ...(p &&
            p > 1 && {
              lastQuestionIdx: {
                $max: {
                  $cond: [
                    {
                      $lt: ["$page", p],
                    },
                    "$qIdx",
                    0,
                  ],
                },
              },
            }),
        },
      },
    ]);

    return summary as SummaryFormType;
  };
}
