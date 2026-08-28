import { Types } from "mongoose";
import {
  ResponseAnswerReturnType,
  ResponseAnswerType,
} from "../model/Response.model";

export enum GraphType {
  BAR = "bar",
  PIE = "pie",
  LINE = "line",
  DOUGHNUT = "doughnut",
  HORIZONTAL_BAR = "horizontalBar",
}

export enum QuestionType {
  MultipleChoice = "multiple",
  CheckBox = "checkbox",
  Text = "texts",
  Number = "number",
  Date = "date",
  RangeDate = "rangedate",
  Selection = "selection",
  RangeNumber = "rangenumber",
  ShortAnswer = "shortanswer",
  Paragraph = "paragraph",
}

export interface ChoiceDistribution {
  choiceIdx: number;
  choiceContent: string;
  count: number;
  percentage: number;
  color: string;
}

export interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

export interface PieChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

export interface ChartDatasetsType {
  labels: string[];
  datasets: Array<{
    label?: string;
    data: Array<number>;
    backgroundColor: Array<string>;
    borderColor: Array<string>;
    borderWidth: number;
  }>;
}

export interface ChartDataType {
  answer: string;
  answerIdx: number;
  count: number;
  percentage: string;
}

export interface MultiGraphAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  answerCounts?: Record<string, number>;
  ranges?: (ResponseAnswerType | ResponseAnswerReturnType)[];
  totalResponses: number;
  chartData?: Array<ChartDataType>;
  availableGraphTypes: Array<GraphType>;
  barChart?: ChartDatasetsType;
  pieChart?: ChartDatasetsType;
  horizontalBarChart?: ChartDatasetsType;
  doughnutChart?: ChartDatasetsType;
  rawData?: Array<ChoiceDistribution>;
}

export interface ChoiceQuestionAnalyticsResponse {
  success: boolean;
  code: number;
  message: string;
  data: MultiGraphAnalytics[];
}

export interface AnalyticsQueryParams {
  formId: string;
  questionId?: string;
}
