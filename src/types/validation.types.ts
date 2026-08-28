import { QuestionType } from "../model/Content.model";

export interface ErrorValidatePropsType {
  _id?: string;
  qIdx?: number;
  questionId: string;
  page: number;
  message?: ValidationErrorCodeType;
}

export interface ValidationResult {
  isValid?: boolean;
  errors?: ErrorValidatePropsType[];
  warnings?: ErrorValidatePropsType[];
  missingAnswers?: ErrorValidatePropsType[];
  missingScores?: ErrorValidatePropsType[];
  wrongScores?: ErrorValidatePropsType[];
}

export interface ScoringAnalysis {
  isAutoScoreable: boolean;
  scoredQuestions: number;
  autoScorableQuestions: number;
  manualGradingQuestions: number;
}

export enum ValidationErrorCodeEnum {
  format = "FORMAT",
  answerformat = "ANSFORMAT",
  score = "SCORE",
  type = "TYPE",
  default = "DEFAULT",
  invalid = "INVALID",
  warning = "WARNING",
}

export interface ValidationErrorCodeType {
  name: ValidationErrorCodeEnum;
  message: string;
}

export const PredefinedErrorMessage = (
  custom: {
    target?: ValidationErrorCodeEnum;
    customMess?: string;
  } = {},
): Record<ValidationErrorCodeEnum, ValidationErrorCodeType> => {
  const errors: Record<ValidationErrorCodeEnum, ValidationErrorCodeType> = {
    [ValidationErrorCodeEnum.default]: {
      name: ValidationErrorCodeEnum.default,
      message: "Default Content Detected",
    },
    [ValidationErrorCodeEnum.format]: {
      name: ValidationErrorCodeEnum.format,
      message: "Invalid Format",
    },
    [ValidationErrorCodeEnum.answerformat]: {
      name: ValidationErrorCodeEnum.answerformat,
      message: "Invalid answer key",
    },
    [ValidationErrorCodeEnum.invalid]: {
      name: ValidationErrorCodeEnum.invalid,
      message: "Invalid Question",
    },
    [ValidationErrorCodeEnum.type]: {
      name: ValidationErrorCodeEnum.type,
      message: "Wrong Question Type",
    },
    [ValidationErrorCodeEnum.score]: {
      name: ValidationErrorCodeEnum.score,
      message: "Invalid Score",
    },
    [ValidationErrorCodeEnum.warning]: {
      name: ValidationErrorCodeEnum.warning,
      message: "Warning",
    },
  };

  if (custom.target && custom.customMess) {
    errors[custom.target] = {
      name: custom.target,
      message: custom.customMess,
    };
  }

  return errors;
};
