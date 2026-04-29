"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormScoringAnalysis = exports.IsFormAutoScoreable = void 0;
const Content_model_1 = require("../model/Content.model");
// Question types that are always automatically scored (objective types)
const ALWAYS_AUTO_SCORABLE_TYPES = new Set([
    Content_model_1.QuestionType.MultipleChoice,
    Content_model_1.QuestionType.CheckBox,
    Content_model_1.QuestionType.Selection,
    Content_model_1.QuestionType.Number,
    Content_model_1.QuestionType.Date,
    Content_model_1.QuestionType.RangeDate,
    Content_model_1.QuestionType.RangeNumber,
]);
// Question types that can be auto-scored IF they have both answer key and score
const CONDITIONALLY_AUTO_SCORABLE_TYPES = new Set([
    Content_model_1.QuestionType.ShortAnswer,
    Content_model_1.QuestionType.Paragraph,
]);
// Question types that are display only (no scoring)
const DISPLAY_ONLY_TYPES = new Set([Content_model_1.QuestionType.Text]);
/**
 * Checks if a question type can potentially be auto-scored
 */
const canTypeBeAutoScored = (type) => {
    return (ALWAYS_AUTO_SCORABLE_TYPES.has(type) ||
        CONDITIONALLY_AUTO_SCORABLE_TYPES.has(type));
};
/**
 * Checks if a single question is auto-scorable
 * A question is auto-scorable if:
 * 1. It has a type that supports automatic scoring (including ShortAnswer/Paragraph with answer keys)
 * 2. It has both a score value and an answer key defined
 */
const isQuestionAutoScorable = (question) => {
    var _a;
    // Check if question type supports auto-scoring
    if (!canTypeBeAutoScored(question.type)) {
        return false;
    }
    // Must have a score assigned
    if (!question.score || question.score <= 0) {
        return false;
    }
    // Must have an answer key defined
    if (!((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer)) {
        return false;
    }
    return true;
};
/**
 * Checks if a question requires manual grading
 * Only returns true for questions that don't have answer keys set
 */
const isQuestionManualGrading = (question) => {
    var _a;
    // Display only types are never graded
    if (DISPLAY_ONLY_TYPES.has(question.type)) {
        return false;
    }
    // ShortAnswer and Paragraph require manual grading only if they don't have answer keys
    if (CONDITIONALLY_AUTO_SCORABLE_TYPES.has(question.type)) {
        return !((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer) && !!question.score && question.score > 0;
    }
    return false;
};
/**
 * Determines if a form can be auto-scored
 * Returns true if ALL scorable questions (questions with score > 0) have valid answer keys
 * and are of auto-scorable types
 */
const IsFormAutoScoreable = ({ questions, }) => {
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
exports.IsFormAutoScoreable = IsFormAutoScoreable;
/**
 * Get detailed scoring analysis for a form
 * Useful for debugging or providing feedback to form creators
 */
const getFormScoringAnalysis = ({ questions, }) => {
    const scoredQuestions = questions.filter((q) => q.score && q.score > 0);
    const autoScorableQuestions = scoredQuestions.filter(isQuestionAutoScorable);
    const manualGradingQuestions = questions.filter(isQuestionManualGrading);
    const missingAnswerKeys = scoredQuestions
        .filter((q) => { var _a; return canTypeBeAutoScored(q.type) && !((_a = q.answer) === null || _a === void 0 ? void 0 : _a.answer); })
        .map((q) => {
        var _a;
        return ({
            qIdx: q.qIdx,
            title: typeof q.title === "string" ? q.title : ((_a = q.title) === null || _a === void 0 ? void 0 : _a.text) || "",
            type: q.type,
        });
    });
    const unsupportedTypes = scoredQuestions
        .filter((q) => !canTypeBeAutoScored(q.type))
        .map((q) => {
        var _a;
        return ({
            qIdx: q.qIdx,
            title: typeof q.title === "string" ? q.title : ((_a = q.title) === null || _a === void 0 ? void 0 : _a.text) || "",
            type: q.type,
        });
    });
    return {
        isAutoScoreable: scoredQuestions.length > 0 &&
            scoredQuestions.every(isQuestionAutoScorable),
        totalQuestions: questions.length,
        scoredQuestions: scoredQuestions.length,
        autoScorableQuestions: autoScorableQuestions.length,
        manualGradingQuestions: manualGradingQuestions.length,
        missingAnswerKeys,
        unsupportedTypes,
    };
};
exports.getFormScoringAnalysis = getFormScoringAnalysis;
