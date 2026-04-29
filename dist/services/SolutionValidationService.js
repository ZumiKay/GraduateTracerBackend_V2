"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolutionValidationService = void 0;
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importStar(require("../model/Form.model"));
const mongoose_1 = require("mongoose");
const helper_1 = require("../utilities/helper");
const scoreHelper_1 = require("../utilities/scoreHelper");
class SolutionValidationService {
    //Check the valid of question answers and scores
    /**
     * @params
     * - content: Contenttype (questionId is required)
     * - parentScore: number
     *
     * @returns
     * - errors
     * - warnings
     * - missingAnswers
     * - missingScores
     * - wrongScores
     */
    static validateContent(content, parentScore) {
        const errors = [];
        const warnings = [];
        const missingAnswers = [];
        const missingScores = [];
        const wrongScores = [];
        const questionTitle = `Question ${content.questionId}`;
        if (content.type === Content_model_1.QuestionType.Text) {
            return {
                isValid: true,
                errors: [],
                warnings: [],
                missingAnswers: [],
                missingScores: [],
                wrongScores: [],
            };
        }
        // Check if content has answer
        if ((!content.answer ||
            content.answer.answer === null ||
            content.answer.answer === undefined) &&
            content.type !== Content_model_1.QuestionType.ShortAnswer &&
            content.type !== Content_model_1.QuestionType.Paragraph) {
            missingAnswers.push(questionTitle);
        }
        // Check if content has score
        if (content.score === null ||
            content.score === undefined ||
            content.score === 0) {
            missingScores.push(questionTitle);
        }
        //validate child conditioned question score
        if (content.score && content.parentcontent && parentScore) {
            const isValid = content.score > parentScore;
            if (isValid) {
                wrongScores.push(questionTitle);
            }
        }
        // Validate answer format based on question type
        if (content.answer &&
            content.answer.answer &&
            content.type !== Content_model_1.QuestionType.ShortAnswer &&
            content.type !== Content_model_1.QuestionType.Paragraph) {
            const answerValidation = this.validateAnswerFormat(content.type, content.answer.answer, content);
            if (!answerValidation.isValid) {
                errors.push(...answerValidation.errors);
            }
        }
        // Check if required question has proper setup
        if (content.require && (!content.answer || !content.score)) {
            //Required Score only for short answer and paragraph question type
            if (content.type === Content_model_1.QuestionType.ShortAnswer ||
                content.type === Content_model_1.QuestionType.Paragraph) {
                if (!content.score)
                    errors.push(`Required ${questionTitle} must have scores`);
            }
            else {
                errors.push(`Required ${questionTitle} must have both answer and score`);
            }
        }
        const isValid = errors.length === 0 &&
            missingAnswers.length === 0 &&
            missingScores.length === 0 &&
            wrongScores.length === 0;
        return {
            isValid,
            errors,
            warnings,
            missingAnswers,
            missingScores,
            wrongScores,
        };
    }
    static validateAnswerFormat(questionType, answer, content) {
        const errors = [];
        switch (questionType) {
            case Content_model_1.QuestionType.MultipleChoice:
            case Content_model_1.QuestionType.Selection:
            case Content_model_1.QuestionType.CheckBox:
                if (!Array.isArray(answer)) {
                    errors.push(`Choice Question ${content.qIdx} have invalid answer`);
                }
                break;
            case Content_model_1.QuestionType.Text:
            case Content_model_1.QuestionType.ShortAnswer:
            case Content_model_1.QuestionType.Paragraph:
                if (typeof answer !== "string") {
                    errors.push(`Question ${content.qIdx} Text answer must be a string`);
                }
                break;
            case Content_model_1.QuestionType.Number:
                if (typeof answer !== "number") {
                    errors.push(`Question ${content.qIdx} number answer must be a number`);
                }
                break;
            case Content_model_1.QuestionType.Date:
                if (typeof answer !== "string") {
                    errors.push(`Question ${content.qIdx} have invalid answer`);
                }
                break;
            case Content_model_1.QuestionType.RangeDate:
                {
                    if (!this.isValidRangeObject(answer)) {
                        errors.push("Range date answer must have valid start and end dates");
                    }
                    //Verify if range date value is correct format
                    if (!(0, helper_1.isRangeValueValid)(answer, true)) {
                        errors.push(`Question ${content.qIdx} have invalid answer`);
                    }
                }
                break;
            case Content_model_1.QuestionType.RangeNumber:
                {
                    const localAnswer = answer;
                    if (!this.isValidRangeObject(answer) ||
                        typeof localAnswer.start !== "number" ||
                        typeof localAnswer.end !== "number") {
                        errors.push("Range number answer must have valid start and end numbers");
                    }
                    if (!(0, helper_1.isRangeValueValid)(localAnswer)) {
                        errors.push(`Question ${content.qIdx} have invalid answer`);
                    }
                }
                break;
            default:
                errors.push(`Unsupported question type: ${questionType}`);
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
    /**
     * Validates entire form for quiz requirements
     * @param formId type string
     * @returns
     *  - canReturnScoreAutomatically,
        - totalValidQuestions
        - totalInvalidQuestions
        - totalScore
        - validationResults,
     */
    static validateForm(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                throw new Error("Form not found");
            }
            const contents = yield Content_model_1.default.find({
                formId: new mongoose_1.Types.ObjectId(formId),
            }).lean();
            const validationResults = [];
            let totalValidQuestions = 0;
            let totalInvalidQuestions = 0;
            let totalScore = 0;
            for (const content of (0, helper_1.AddQuestionNumbering)({ questions: contents })) {
                if (content.type === Content_model_1.QuestionType.Text) {
                    //Validate Text Display Only question
                    const result = this.validateContent(content);
                    validationResults.push(result);
                    continue;
                }
                //Validate question with condition
                const parentScore = (_a = contents.find((ques) => { var _a; return ques._id.toString() === ((_a = content.parentcontent) === null || _a === void 0 ? void 0 : _a.qId); })) === null || _a === void 0 ? void 0 : _a.score;
                const result = this.validateContent(content, parentScore);
                validationResults.push(result);
                if (!content.parentcontent)
                    totalScore += content.score || 0;
                if (result.isValid) {
                    totalValidQuestions++;
                }
                else {
                    totalInvalidQuestions++;
                }
            }
            const scorableQuestions = contents.filter((content) => content.type !== Content_model_1.QuestionType.Text);
            const canReturnScoreAutomatically = form.type === Form_model_1.TypeForm.Quiz &&
                totalInvalidQuestions === 0 &&
                scorableQuestions.length > 0 &&
                ((_b = form.setting) === null || _b === void 0 ? void 0 : _b.returnscore) === Form_model_1.returnscore.partial;
            // Combine all validation results into aggregated arrays
            const combinedResults = {
                errors: validationResults.flatMap((r) => r.errors),
                warnings: validationResults.flatMap((r) => r.warnings),
                missingAnswers: validationResults.flatMap((r) => r.missingAnswers),
                missingScores: validationResults.flatMap((r) => r.missingScores),
                wrongScores: validationResults.flatMap((r) => r.wrongScores),
            };
            // Get detailed scoring analysis
            const scoringAnalysis = (0, scoreHelper_1.getFormScoringAnalysis)({ questions: contents });
            return {
                canReturnScoreAutomatically,
                totalValidQuestions,
                totalInvalidQuestions,
                totalScore,
                validationResults: combinedResults,
                scoringAnalysis,
            };
        });
    }
    static getFormValidationErrors(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            const summary = yield this.validateForm(formId);
            const errors = [];
            if (summary.totalInvalidQuestions > 0) {
                errors.push(`${summary.totalInvalidQuestions} question(s) have validation errors`);
            }
            const { missingAnswers, missingScores } = summary.validationResults;
            if (missingAnswers.length > 0) {
                errors.push(`Missing answers: ${missingAnswers.length} question(s)`);
            }
            if (missingScores.length > 0) {
                errors.push(`Missing scores: ${missingScores.length} question(s)`);
            }
            return errors;
        });
    }
    static calcualteResponseTotalScore(responseSet) {
        var _a;
        let totalscore = 0;
        for (let r = 0; r < responseSet.length; r++) {
            const res = responseSet[r];
            //Ignore the response have no saved question and question with parentContent
            if (res.question) {
                const ques = res.question;
                if (!ques.parentcontent) {
                    totalscore += (_a = res.score) !== null && _a !== void 0 ? _a : 0;
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
                return this.calculateChoiceQuestionScore(userAnswer, correctAnswer, maxScore);
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
        const userStart = new Date(userAnswer.start).getTime() || userAnswer.start;
        const userEnd = new Date(userAnswer.end).getTime() || userAnswer.end;
        const correctStart = new Date(correctAnswer.start).getTime() || correctAnswer.start;
        const correctEnd = new Date(correctAnswer.end).getTime() || correctAnswer.end;
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
exports.SolutionValidationService = SolutionValidationService;
exports.default = SolutionValidationService;
