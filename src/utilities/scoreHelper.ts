import { ContentType, QuestionType } from "../model/Content.model";

// Question types that are always automatically scored (objective types)
const ALWAYS_AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.MultipleChoice,
  QuestionType.CheckBox,
  QuestionType.Selection,
  QuestionType.Number,
  QuestionType.Date,
  QuestionType.RangeDate,
  QuestionType.RangeNumber,
]);

// Question types that can be auto-scored IF they have both answer key and score
const CONDITIONALLY_AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.ShortAnswer,
  QuestionType.Paragraph,
]);

// Question types that are display only (no scoring)
const DISPLAY_ONLY_TYPES: Set<QuestionType> = new Set([QuestionType.Text]);

/**
 * Checks if a question type can potentially be auto-scored
 */
const canTypeBeAutoScored = (type: QuestionType): boolean => {
  return (
    ALWAYS_AUTO_SCORABLE_TYPES.has(type) ||
    CONDITIONALLY_AUTO_SCORABLE_TYPES.has(type)
  );
};

/**
 * Checks if a single question is auto-scorable
 * A question is auto-scorable if:
 * 1. It has a type that supports automatic scoring (including ShortAnswer/Paragraph with answer keys)
 * 2. It has both a score value and an answer key defined
 */
const isQuestionAutoScorable = (question: ContentType): boolean => {
  // Check if question type supports auto-scoring
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

/**
 * Checks if a question requires manual grading
 * Only returns true for questions that don't have answer keys set
 */
const isQuestionManualGrading = (question: ContentType): boolean => {
  // Display only types are never graded
  if (DISPLAY_ONLY_TYPES.has(question.type)) {
    return false;
  }

  // ShortAnswer and Paragraph require manual grading only if they don't have answer keys
  if (CONDITIONALLY_AUTO_SCORABLE_TYPES.has(question.type)) {
    return !question.answer?.answer && !!question.score && question.score > 0;
  }

  return false;
};

/**
 * Determines if a form can be auto-scored
 * Returns true if ALL scorable questions (questions with score > 0) have valid answer keys
 * and are of auto-scorable types
 */
export const IsFormAutoScoreable = ({
  questions,
}: {
  questions: Array<ContentType>;
}): boolean => {
  if (!questions || questions.length === 0) {
    return false;
  }

  // Filter questions that have scores assigned (these need to be gradable)
  const scoredQuestions = questions.filter((q) => q.score && q.score > 0);

  // If no questions have scores, form is not scorable
  if (scoredQuestions.length === 0) {
    return false;
  }

  // Check if all scored questions are auto-scorable
  return scoredQuestions.every(isQuestionAutoScorable);
};

/**
 * Get detailed scoring analysis for a form
 * Useful for debugging or providing feedback to form creators
 */
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
