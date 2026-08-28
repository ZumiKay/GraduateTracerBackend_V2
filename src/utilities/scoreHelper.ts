import { ContentType, QuestionType } from "../model/Content.model";

// Question types that are always automatically scored (objective types)
export const AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.MultipleChoice,
  QuestionType.MultipleSelection,
  QuestionType.CheckBox,
  QuestionType.Selection,
  QuestionType.Number,
  QuestionType.Date,
  QuestionType.RangeDate,
  QuestionType.RangeNumber,
]);

// Question types that can be auto-scored IF they have both answer key and score
export const MAYBE_AUTO_SCORABLE_TYPES: Set<QuestionType> = new Set([
  QuestionType.ShortAnswer,
  QuestionType.Paragraph,
]);

// Question types that are display only (no scoring)
export const DISPLAY_ONLY_TYPES: Set<QuestionType> = new Set([
  QuestionType.Text,
]);

const canTypeBeAutoScored = (type: QuestionType): boolean => {
  return AUTO_SCORABLE_TYPES.has(type) || MAYBE_AUTO_SCORABLE_TYPES.has(type);
};

const isQuestionAutoScorable = (question: ContentType): boolean => {
  //Must have valid type
  if (!canTypeBeAutoScored(question.type)) {
    return false;
  }

  // Must have an answer key defined
  if (!question.answer) {
    return false;
  }

  return true;
};

const isQuestionManualGrading = (question: ContentType): boolean => {
  if (DISPLAY_ONLY_TYPES.has(question.type)) {
    return false;
  }

  // ShortAnswer and Paragraph require manual grading only if they don't have answer keys
  if (MAYBE_AUTO_SCORABLE_TYPES.has(question.type)) {
    return (
      !question.answer && question.score !== undefined && question.score > 0
    );
  }

  return false;
};

/**  Count question score
 * @description
 * [] Scored question
 * [] Autoscored questin
 * [] Manually score question
 */
export const getFormScoringAnalysis = ({
  questions,
}: {
  questions: Array<ContentType>;
}): {
  isAutoScoreable: boolean;
  scoredQuestions: number;
  autoScorableQuestions: number;
  manualGradingQuestions: number;
} => {
  const scoredQuestions = questions.filter((q) => q.score && q.score > 0);
  const autoScorableQuestions = scoredQuestions.filter(isQuestionAutoScorable);
  const manualGradingQuestions = questions.filter(isQuestionManualGrading);

  return {
    isAutoScoreable:
      scoredQuestions.length > 0 &&
      scoredQuestions.every(isQuestionAutoScorable),
    scoredQuestions: scoredQuestions.length,
    autoScorableQuestions: autoScorableQuestions.length,
    manualGradingQuestions: manualGradingQuestions.length,
  };
};
