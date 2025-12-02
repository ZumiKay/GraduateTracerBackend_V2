import { ContentType } from "../../model/Content.model";

export interface GetAnalyticsParamType {
  formId: string;
  page?: string;
  questionId?: string;
  period?: string;
}

export interface QuestionAnalyticDataType {
  optIdx?: number;
  responseCount: number; //Count the amount of respndent
  responseAverage: number; //Computed the average respondent to the total of respondents
  correctionRate?: number; //Computed the percent of correct answer
  commonScores?: Array<number>; //Extracted common score from responses
  noAnswerCount?: number;
  noAnswerRate?: number;
}

export interface AnalyticsReturnQuestionData extends ContentType {
  analytics: {
    [x: string]: Array<QuestionAnalyticDataType> | QuestionAnalyticDataType;
  };
}
