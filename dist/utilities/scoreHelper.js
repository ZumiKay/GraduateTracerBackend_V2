"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormScoringAnalysis = exports.DISPLAY_ONLY_TYPES = exports.MAYBE_AUTO_SCORABLE_TYPES = exports.AUTO_SCORABLE_TYPES = void 0;
const Content_model_1 = require("../model/Content.model");
// Question types that are always automatically scored (objective types)
exports.AUTO_SCORABLE_TYPES = new Set([
    Content_model_1.QuestionType.MultipleChoice,
    Content_model_1.QuestionType.MultipleSelection,
    Content_model_1.QuestionType.CheckBox,
    Content_model_1.QuestionType.Selection,
    Content_model_1.QuestionType.Number,
    Content_model_1.QuestionType.Date,
    Content_model_1.QuestionType.RangeDate,
    Content_model_1.QuestionType.RangeNumber,
]);
// Question types that can be auto-scored IF they have both answer key and score
exports.MAYBE_AUTO_SCORABLE_TYPES = new Set([
    Content_model_1.QuestionType.ShortAnswer,
    Content_model_1.QuestionType.Paragraph,
]);
// Question types that are display only (no scoring)
exports.DISPLAY_ONLY_TYPES = new Set([
    Content_model_1.QuestionType.Text,
]);
const canTypeBeAutoScored = (type) => {
    return exports.AUTO_SCORABLE_TYPES.has(type) || exports.MAYBE_AUTO_SCORABLE_TYPES.has(type);
};
const isQuestionAutoScorable = (question) => {
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
const isQuestionManualGrading = (question) => {
    if (exports.DISPLAY_ONLY_TYPES.has(question.type)) {
        return false;
    }
    // ShortAnswer and Paragraph require manual grading only if they don't have answer keys
    if (exports.MAYBE_AUTO_SCORABLE_TYPES.has(question.type)) {
        return (!question.answer && question.score !== undefined && question.score > 0);
    }
    return false;
};
/**  Count question score
 * @description
 * [] Scored question
 * [] Autoscored questin
 * [] Manually score question
 */
const getFormScoringAnalysis = ({ questions, }) => {
    const scoredQuestions = questions.filter((q) => q.score && q.score > 0);
    const autoScorableQuestions = scoredQuestions.filter(isQuestionAutoScorable);
    const manualGradingQuestions = questions.filter(isQuestionManualGrading);
    return {
        isAutoScoreable: scoredQuestions.length > 0 &&
            scoredQuestions.every(isQuestionAutoScorable),
        scoredQuestions: scoredQuestions.length,
        autoScorableQuestions: autoScorableQuestions.length,
        manualGradingQuestions: manualGradingQuestions.length,
    };
};
exports.getFormScoringAnalysis = getFormScoringAnalysis;
