"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseContentValidationService = exports.ResponseContentValidateErrorCode = void 0;
const Content_model_1 = require("../model/Content.model");
const validation_types_1 = require("../types/validation.types");
const helper_1 = require("../utilities/helper");
exports.ResponseContentValidateErrorCode = [
    {
        name: validation_types_1.ValidationErrorCodeEnum.format,
        message: "Invalid format",
    },
    {
        name: validation_types_1.ValidationErrorCodeEnum.answerformat,
        message: "Invalid answer format",
    },
];
class ResponseContentValidationService {
    //Check the valid of question answers and scores
    /**
     * Normalizes a choice answer to a plain number array.
     * Handles both Array<number> and {key: number | number[], val: ...} (ResponseAnswerReturnType) formats.
     */
    static normalizeChoiceAnswer(answer) {
        if (Array.isArray(answer))
            return answer;
        if (answer !== null &&
            typeof answer === "object" &&
            !Array.isArray(answer) &&
            "key" in answer) {
            const key = answer.key;
            if (Array.isArray(key))
                return key;
            if (typeof key === "number")
                return [key];
        }
        return null;
    }
    static validateAnswerFormat(questionType, answer, content) {
        const errors = [];
        const questionId = `Question ${content.questionId}`;
        const { _id, page, qIdx } = content;
        const errorProps = {
            _id: _id?.toString(),
            qIdx,
            page: page ?? 1,
            questionId,
            message: (0, validation_types_1.PredefinedErrorMessage)()[validation_types_1.ValidationErrorCodeEnum.answerformat],
        };
        switch (questionType) {
            case Content_model_1.QuestionType.MultipleChoice:
            case Content_model_1.QuestionType.Selection:
            case Content_model_1.QuestionType.CheckBox:
            case Content_model_1.QuestionType.MultipleSelection:
                if (this.normalizeChoiceAnswer(answer) === null) {
                    errors.push(errorProps);
                }
                break;
            case Content_model_1.QuestionType.Text:
            case Content_model_1.QuestionType.ShortAnswer:
            case Content_model_1.QuestionType.Paragraph:
                if (typeof answer !== "string") {
                    errors.push(errorProps);
                }
                break;
            case Content_model_1.QuestionType.Number:
                if (typeof answer !== "number") {
                    errors.push(errorProps);
                }
                break;
            case Content_model_1.QuestionType.Date:
                if (typeof answer !== "string") {
                    errors.push(errorProps);
                }
                break;
            case Content_model_1.QuestionType.RangeDate:
                {
                    if (!this.isValidRangeObject(answer)) {
                        errors.push(errorProps);
                    }
                    //Verify if range date value is correct format
                    if (!(0, helper_1.isRangeValueValid)(answer, true)) {
                        errors.push(errorProps);
                    }
                }
                break;
            case Content_model_1.QuestionType.RangeNumber:
                {
                    const localAnswer = answer;
                    if (!this.isValidRangeObject(answer) ||
                        typeof localAnswer.start !== "number" ||
                        typeof localAnswer.end !== "number") {
                        errors.push(errorProps);
                    }
                    if (!(0, helper_1.isRangeValueValid)(localAnswer)) {
                        errors.push(errorProps);
                    }
                }
                break;
            default:
                errors.push(errorProps);
        }
        return { isValid: errors.length === 0, errors };
    }
    static isAnswerisempty(answer) {
        if (answer === null || answer === undefined) {
            return true;
        }
        if (typeof answer === "string") {
            return answer.trim() === "";
        }
        if (typeof answer === "number") {
            return false;
        }
        if (typeof answer === "boolean") {
            return false;
        }
        if (Array.isArray(answer)) {
            return answer.length === 0;
        }
        if (typeof answer === "object" && answer !== null) {
            const rangeAnswer = answer;
            if ("start" in rangeAnswer && "end" in rangeAnswer) {
                const startEmpty = rangeAnswer.start === null ||
                    rangeAnswer.start === undefined ||
                    (typeof rangeAnswer.start === "string" &&
                        rangeAnswer.start.trim() === "");
                const endEmpty = rangeAnswer.end === null ||
                    rangeAnswer.end === undefined ||
                    (typeof rangeAnswer.end === "string" &&
                        rangeAnswer.end.trim() === "");
                return startEmpty && endEmpty;
            }
        }
        return false;
    }
    static isValidRangeObject(obj) {
        return obj && typeof obj === "object" && "start" in obj && "end" in obj;
    }
    static calcualteResponseTotalScore(responseSet) {
        let totalscore = 0;
        for (let r = 0; r < responseSet.length; r++) {
            const res = responseSet[r];
            //?Ignore the response have no saved question and question with parentContent
            if (res.question) {
                const ques = res.question;
                if (!ques.parentcontent) {
                    totalscore += res.score ?? 0;
                }
            }
        }
        return totalscore;
    }
    static calculateResponseScore(userAnswer, correctAnswer, questionType, maxScore) {
        if (!correctAnswer || maxScore === 0)
            return 0;
        switch (questionType) {
            case Content_model_1.QuestionType.Text:
                return 0;
            case Content_model_1.QuestionType.MultipleChoice:
            case Content_model_1.QuestionType.CheckBox:
            case Content_model_1.QuestionType.Selection: {
                const normalizedUser = this.normalizeChoiceAnswer(userAnswer);
                const normalizedCorrect = this.normalizeChoiceAnswer(correctAnswer);
                if (!normalizedUser || !normalizedCorrect)
                    return 0;
                return this.calculateChoiceQuestionScore(normalizedUser, normalizedCorrect, maxScore);
            }
            case Content_model_1.QuestionType.ShortAnswer:
            case Content_model_1.QuestionType.Paragraph:
                return this.calculateTextScore(userAnswer, correctAnswer, maxScore);
            case Content_model_1.QuestionType.Number:
                return userAnswer === correctAnswer ? maxScore : 0;
            case Content_model_1.QuestionType.Date:
                return this.calculateDateScore(userAnswer, correctAnswer, maxScore);
            case Content_model_1.QuestionType.RangeDate:
            case Content_model_1.QuestionType.RangeNumber:
                return this.calculateRangeScore(userAnswer, correctAnswer, maxScore);
            default:
                return 0;
        }
    }
    /**
     * Calculate score for array-based answers (multiple choice, checkbox, selection)
     */
    static calculateChoiceQuestionScore(userAnswer, correctAnswer, maxScore) {
        //Verify answer format
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer))
            return 0;
        const userSet = new Set(userAnswer);
        const correctSet = new Set(correctAnswer);
        const intersection = new Set([...userSet].filter((x) => correctSet.has(x)));
        const union = new Set([...userSet, ...correctSet]);
        if (intersection.size === correctSet.size &&
            userSet.size === correctSet.size) {
            return maxScore;
        }
        const similarity = intersection.size / union.size;
        return Math.round(maxScore * similarity);
    }
    /**
     * Calculate score for text-based answers
     */
    static calculateTextScore(userAnswer, correctAnswer, maxScore) {
        if (typeof userAnswer !== "string" || typeof correctAnswer !== "string")
            return 0;
        const userText = userAnswer.trim().toLowerCase();
        const correctText = correctAnswer.trim().toLowerCase();
        if (userText === correctText)
            return maxScore;
        const similarity = this.calculateTextSimilarity(userText, correctText);
        return similarity > 0.8 ? maxScore : 0;
    }
    /**
     * Calculate score for date answers
     */
    static calculateDateScore(userAnswer, correctAnswer, maxScore) {
        const userDate = new Date(userAnswer);
        const correctDate = new Date(correctAnswer);
        if (isNaN(userDate.getTime()) || isNaN(correctDate.getTime()))
            return 0;
        return userDate.getTime() === correctDate.getTime() ? maxScore : 0;
    }
    /**
     * Calculate score for range answers
     */
    static calculateRangeScore(userAnswer, correctAnswer, maxScore) {
        if (!this.isValidRangeObject(userAnswer) ||
            !this.isValidRangeObject(correctAnswer))
            return 0;
        const userStart = userAnswer.start;
        const userEnd = userAnswer.end;
        const correctStart = correctAnswer.start;
        const correctEnd = correctAnswer.end;
        return userStart === correctStart && userEnd === correctEnd ? maxScore : 0;
    }
    //Partial text match return partial score for paragrah and short answer
    static calculateTextSimilarity(text1, text2) {
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }
}
exports.ResponseContentValidationService = ResponseContentValidationService;
exports.default = ResponseContentValidationService;
