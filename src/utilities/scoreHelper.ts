import { ContentType, QuestionType } from "../model/Content.model";

// Question types that are always automatically scored (objective types)
const AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.MultipleChoice,
  QuestionType.CheckBox,
  QuestionType.Selection,
  QuestionType.Number,
  QuestionType.Date,
  QuestionType.RangeDate,
  QuestionType.RangeNumber,
]);

// Question types that can be auto-scored IF they have both answer key and score
const MAYBE_AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.ShortAnswer,
  QuestionType.Paragraph,
]);

// Question types that are display only (no scoring)
const DISPLAY_ONLY_TYPES: Set<QuestionType> = new Set([QuestionType.Text]);

const canTypeBeAutoScored = (type: QuestionType): boolean => {
  return AUTO_SCORABLE_TYPES.has(type) || MAYBE_AUTO_SCORABLE_TYPES.has(type);
};

const isQuestionAutoScorable = (question: ContentType): boolean => {
  if (!canTypeBeAutoScored(question.type)) {
    return false;
  }

  // Must have a score assigned
  if (!question.score || question.score <= 0) {
    return false;
  }

  // Must have an answer key defined
  if (!question.answer?.answer) {
    return false;
  }

  return true;
};

const isQuestionManualGrading = (question: ContentType): boolean => {
  // Display only types are never graded
  if (DISPLAY_ONLY_TYPES.has(question.type)) {
    return false;
  }

  // ShortAnswer and Paragraph require manual grading only if they don't have answer keys
  if (MAYBE_AUTO_SCORABLE_TYPES.has(question.type)) {
    return !question.answer?.answer && !!question.score && question.score > 0;
  }

  return false;
};

export const IsFormAutoScoreable = ({
  questions,
}: {
  questions: Array<ContentType>;
}): boolean => {
  if (!questions || questions.length === 0) {
    return false;
  }

  const scoredQuestions = questions.filter((q) => q.score && q.score > 0);

  // If no questions have scores
  if (scoredQuestions.length === 0) {
    return false;
  }

  // Check if all scored questions are auto-scorable
  return scoredQuestions.every(isQuestionAutoScorable);
};

export const getFormScoringAnalysis = ({
  questions,
}: {
  questions: Array<ContentType>;
}): {
  isAutoScoreable: boolean;
  totalQuestions: number;
  scoredQuestions: number;
  autoScorableQuestions: number;
  manualGradingQuestions: number;
  missingAnswerKeys: Array<{ qIdx: number; title: string; type: QuestionType }>;
  unsupportedTypes: Array<{ qIdx: number; title: string; type: QuestionType }>;
} => {
  const scoredQuestions = questions.filter((q) => q.score && q.score > 0);
  const autoScorableQuestions = scoredQuestions.filter(isQuestionAutoScorable);
  const manualGradingQuestions = questions.filter(isQuestionManualGrading);

  const missingAnswerKeys = scoredQuestions
    .filter((q) => canTypeBeAutoScored(q.type) && !q.answer?.answer)
    .map((q) => ({
      qIdx: q.qIdx,
      title: typeof q.title === "string" ? q.title : q.title?.text || "",
      type: q.type,
    }));

  const unsupportedTypes = scoredQuestions
    .filter((q) => !canTypeBeAutoScored(q.type))
    .map((q) => ({
      qIdx: q.qIdx,
      title: typeof q.title === "string" ? q.title : q.title?.text || "",
      type: q.type,
    }));

  return {
    isAutoScoreable:
      scoredQuestions.length > 0 &&
      scoredQuestions.every(isQuestionAutoScorable),
    totalQuestions: questions.length,
    scoredQuestions: scoredQuestions.length,
    autoScorableQuestions: autoScorableQuestions.length,
    manualGradingQuestions: manualGradingQuestions.length,
    missingAnswerKeys,
    unsupportedTypes,
  };
};
