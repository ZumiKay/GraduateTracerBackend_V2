/**
 * Analytics Types for Choice Question Graph Visualization
 * Supports Multiple Graph Types: Bar Chart, Pie Chart, Horizontal Bar, Doughnut
 */

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

/**
 * Distribution data for a single choice option
 */
export interface ChoiceDistribution {
  choiceIdx: number;
  choiceContent: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Bar Chart Data Structure
 * Used for vertical and horizontal bar charts
 */
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

/**
 * Pie/Doughnut Chart Data Structure
 */
export interface PieChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

/**
 * Main Analytics Response for a Single Choice Question
 * Contains all available graph formats
 */
export interface MultiGraphAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  totalResponses: number;
  availableGraphTypes: GraphType[];
  barChart?: BarChartData;
  pieChart?: PieChartData;
  horizontalBarChart?: BarChartData;
  doughnutChart?: PieChartData;
  rawData: ChoiceDistribution[];
}

/**
 * API Response Format
 */
export interface ChoiceQuestionAnalyticsResponse {
  success: boolean;
  code: number;
  message: string;
  data: MultiGraphAnalytics[];
}

/**
 * Request Query Parameters
 */
export interface AnalyticsQueryParams {
  formId: string;
  questionId?: string; // Optional: specific question ID, otherwise all choice questions
}
