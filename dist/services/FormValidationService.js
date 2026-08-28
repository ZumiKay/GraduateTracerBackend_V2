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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormValidationService = exports.formValidationErrorByContentType = exports.formValidationErrorByContentTypes = void 0;
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importStar(require("../model/Form.model"));
const helper_1 = require("../utilities/helper");
const ResponseContentValidationService_1 = __importDefault(require("./ResponseContentValidationService"));
const formHelpers_1 = require("../utilities/formHelpers");
const scoreHelper_1 = require("../utilities/scoreHelper");
const mongoose_1 = require("mongoose");
const validation_types_1 = require("../types/validation.types");
const form_query_controller_1 = require("../controller/form/form.query.controller");
exports.formValidationErrorByContentTypes = {
    [Content_model_1.QuestionType.Text]: (content) => {
        const errors = [];
        if (content.isBonusScore ||
            content.useChildScoreSum ||
            (content.score && content.score > 0)) {
            errors.push((0, validation_types_1.PredefinedErrorMessage)()[validation_types_1.ValidationErrorCodeEnum.invalid]);
        }
        return errors;
    },
    [Content_model_1.QuestionType.MultipleChoice]: (content) => {
        const errors = [];
        if (!content.multiple ||
            !Array.isArray(content.multiple) ||
            content.multiple.length === 0) {
            errors.push((0, validation_types_1.PredefinedErrorMessage)({
                target: validation_types_1.ValidationErrorCodeEnum.format,
                customMess: "Multiple choice question requires at least one choice option",
            })[validation_types_1.ValidationErrorCodeEnum.format]);
        }
        else {
            const hasEmptyChoice = content.multiple.some((c) => !c.content || c.content.trim() === "");
            if (hasEmptyChoice) {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.format,
                    customMess: "Choice options cannot be empty",
                })[validation_types_1.ValidationErrorCodeEnum.format]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.MultipleSelection]: (content) => {
        const errors = [];
        const options = content.checkbox;
        if (!options || !Array.isArray(options) || options.length === 0) {
            errors.push((0, validation_types_1.PredefinedErrorMessage)({
                target: validation_types_1.ValidationErrorCodeEnum.format,
                customMess: "Multiple selection question requires choice options",
            })[validation_types_1.ValidationErrorCodeEnum.format]);
        }
        return errors;
    },
    [Content_model_1.QuestionType.CheckBox]: (content) => {
        const errors = [];
        const options = content.checkbox;
        if (!options || !Array.isArray(options) || options.length === 0) {
            errors.push((0, validation_types_1.PredefinedErrorMessage)({
                target: validation_types_1.ValidationErrorCodeEnum.format,
                customMess: "Checkbox question requires choice options",
            })[validation_types_1.ValidationErrorCodeEnum.format]);
        }
        return errors;
    },
    [Content_model_1.QuestionType.Selection]: (content) => {
        const errors = [];
        const options = content.selection;
        if (!options || !Array.isArray(options) || options.length === 0) {
            errors.push((0, validation_types_1.PredefinedErrorMessage)({
                target: validation_types_1.ValidationErrorCodeEnum.format,
                customMess: "Selection question requires choice options",
            })[validation_types_1.ValidationErrorCodeEnum.format]);
        }
        else {
            const hasEmptyChoice = options.some((c) => !c.content || c.content.trim() === "");
            if (hasEmptyChoice) {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.format,
                    customMess: "Choice options cannot be empty",
                })[validation_types_1.ValidationErrorCodeEnum.format]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.Number]: (content) => {
        const errors = [];
        if (content.answer && content.answer.answer !== undefined) {
            if (typeof content.answer.answer !== "number") {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.answerformat,
                    customMess: "Number question answer must be a number",
                })[validation_types_1.ValidationErrorCodeEnum.answerformat]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.Date]: (content) => {
        const errors = [];
        if (!content.date || typeof content.date !== "string") {
            errors.push((0, validation_types_1.PredefinedErrorMessage)({ target: validation_types_1.ValidationErrorCodeEnum.format })[validation_types_1.ValidationErrorCodeEnum.format]);
        }
        return errors;
    },
    [Content_model_1.QuestionType.RangeDate]: (content) => {
        const errors = [];
        const range = content.rangedate || content.range;
        if (range && range.start && range.end) {
            const start = new Date(range.start);
            const end = new Date(range.end);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.answerformat,
                    customMess: "RangeDate start and end must be valid dates",
                })[validation_types_1.ValidationErrorCodeEnum.answerformat]);
            }
            else if (start > end) {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.format,
                    customMess: "RangeDate start date must be before or equal to end date",
                })[validation_types_1.ValidationErrorCodeEnum.format]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.RangeNumber]: (content) => {
        const errors = [];
        const range = content.rangenumber || content.range;
        if (range && range.start !== undefined && range.end !== undefined) {
            if (typeof range.start !== "number" || typeof range.end !== "number") {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.answerformat,
                    customMess: "RangeNumber start and end must be numbers",
                })[validation_types_1.ValidationErrorCodeEnum.answerformat]);
            }
            else if (range.start > range.end) {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.format,
                    customMess: "RangeNumber start must be less than or equal to end",
                })[validation_types_1.ValidationErrorCodeEnum.format]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.ShortAnswer]: (content) => {
        const errors = [];
        if (content.answer && content.answer.answer !== undefined) {
            if (typeof content.answer.answer !== "string") {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.answerformat,
                    customMess: "ShortAnswer answer key must be a text string",
                })[validation_types_1.ValidationErrorCodeEnum.answerformat]);
            }
        }
        return errors;
    },
    [Content_model_1.QuestionType.Paragraph]: (content) => {
        const errors = [];
        if (content.answer && content.answer.answer !== undefined) {
            if (typeof content.answer.answer !== "string") {
                errors.push((0, validation_types_1.PredefinedErrorMessage)({
                    target: validation_types_1.ValidationErrorCodeEnum.answerformat,
                    customMess: "Paragraph answer key must be a text string",
                })[validation_types_1.ValidationErrorCodeEnum.answerformat]);
            }
        }
        return errors;
    },
};
exports.formValidationErrorByContentType = exports.formValidationErrorByContentTypes;
class FormValidationService {
    static formValidationErrorByContentTypes = exports.formValidationErrorByContentTypes;
    static formValidationErrorByContentType = exports.formValidationErrorByContentType;
    static ValidationResultInitial = {
        isValid: true,
        errors: [],
        warnings: [],
        missingAnswers: [],
        missingScores: [],
        wrongScores: [],
    };
    static validationFormHandler = async (req, res) => {
        const { formId, action, page, p } = req.query;
        if (!formId || !mongoose_1.Types.ObjectId.isValid(formId) || !action)
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        const currentPage = Number(page || p) || 1;
        try {
            let result;
            if (action === form_query_controller_1.GetFilterTypeEnum.detail) {
                result = await FormValidationService.getFormOverviewDataById({
                    formId: new mongoose_1.Types.ObjectId(formId),
                    p: currentPage,
                });
            }
            else if (action === form_query_controller_1.GetFilterTypeEnum.solution) {
                const currentForm = await Form_model_1.default.findById(formId)
                    .select(formHelpers_1.projections.detail)
                    .lean();
                if (!currentForm)
                    return res.status(404).json((0, helper_1.ReturnCode)(404));
                const currentContents = await Content_model_1.default.find({ formId }).lean();
                if (!currentContents.length)
                    return res.status(204).json((0, helper_1.ReturnCode)(204));
                result = {
                    validation: this.validateForm(currentForm, currentContents, currentPage, action),
                };
            }
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: result,
            });
        }
        catch (error) {
            console.log("Error Validate Form", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    /**Validation individual question for both question and solution */
    static validateContent({ content, parentScore, useChildSum, siblingSumScore, validateContentDetail, }) {
        const errors = [];
        const warnings = [];
        const missingAnswers = [];
        const missingScores = [];
        const wrongScores = [];
        const errorItem = {
            _id: content._id?.toString(),
            qIdx: content.qIdx,
            questionId: `Question ${content.questionId || content.qIdx}`,
            page: content.page ?? 1,
        };
        if (validateContentDetail) {
            //Validate for quiz form type
            const allQuestionType = new Set([
                ...Array.from(scoreHelper_1.MAYBE_AUTO_SCORABLE_TYPES),
                ...Array.from(scoreHelper_1.AUTO_SCORABLE_TYPES),
                ...Array.from(scoreHelper_1.DISPLAY_ONLY_TYPES),
            ]);
            if (!allQuestionType.has(content.type)) {
                return { isValid: false, errors: [errorItem] };
            }
            const typeValidator = exports.formValidationErrorByContentTypes[content.type];
            if (typeValidator) {
                const typeErrors = typeValidator(content);
                if (typeErrors.length > 0) {
                    typeErrors.forEach((typeError) => {
                        errors.push({ ...errorItem, message: typeError });
                    });
                }
            }
        }
        else {
            //validate child conditioned question score must equal parent score
            if (content.score && content.parentcontent && parentScore) {
                if (useChildSum && siblingSumScore !== undefined) {
                    const extractSiblingSum = Math.abs(siblingSumScore - content.score);
                    extractSiblingSum + content.score > parentScore &&
                        wrongScores.push({
                            ...errorItem,
                            message: (0, validation_types_1.PredefinedErrorMessage)()[validation_types_1.ValidationErrorCodeEnum.score],
                        });
                }
                else {
                    content.score > parentScore &&
                        wrongScores.push({
                            ...errorItem,
                            message: (0, validation_types_1.PredefinedErrorMessage)()[validation_types_1.ValidationErrorCodeEnum.score],
                        });
                }
            }
            // Validate answer format based on question type
            if (content.answer &&
                content.answer.answer &&
                content.type !== Content_model_1.QuestionType.ShortAnswer &&
                content.type !== Content_model_1.QuestionType.Paragraph) {
                const answerValidation = ResponseContentValidationService_1.default.validateAnswerFormat(content.type, content.answer.answer, content);
                if (!answerValidation.isValid) {
                    errors.push(...answerValidation.errors.map(() => errorItem));
                }
            }
            //Add warning
            if (scoreHelper_1.AUTO_SCORABLE_TYPES.has(content.type)) {
                if (!content.score || !content.answer) {
                    warnings.push({
                        ...errorItem,
                        message: (0, validation_types_1.PredefinedErrorMessage)({
                            target: validation_types_1.ValidationErrorCodeEnum.warning,
                            customMess: "Missing Score or Answer",
                        })[validation_types_1.ValidationErrorCodeEnum.warning],
                    });
                }
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
    /**
     * Validates entire form for quiz form requirements (For solution tab only)
     * @param formId type string
     * @returns
     *  - canReturnScoreAutomatically,
        - totalValidQuestions
        - totalInvalidQuestions
        - totalScore
        - validationResults,
     */
    static validateForm(form, contents, page = 1, type) {
        const validationResults = [];
        let totalValidQuestions = 0;
        let totalInvalidQuestions = 0;
        for (const content of (0, helper_1.AddQuestionNumbering)({ questions: contents })) {
            if (content.type === Content_model_1.QuestionType.Text) {
                continue;
            }
            //Validate question with condition
            const parentQ = contents.find((ques) => ques?._id?.toString() === content.parentcontent?.qId ||
                ques.qIdx === content.parentcontent?.qIdx);
            const siblingSumScore = contents
                .filter((c) => c.parentcontent?.qId === parentQ?._id?.toString())
                .reduce((sum, c) => sum + (c.score || 0), 0);
            const result = this.validateContent({
                content,
                useChildSum: parentQ?.useChildScoreSum,
                siblingSumScore,
                validateContentDetail: type === form_query_controller_1.GetFilterTypeEnum.detail,
            });
            validationResults.push(result);
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
            form.setting?.returnscore === Form_model_1.returnscore.partial;
        // Combine all validation results
        const combinedResults = {
            isValid: totalInvalidQuestions === 0,
            errors: validationResults.flatMap((r) => r.errors ?? []),
            warnings: validationResults.flatMap((r) => r.warnings ?? []),
            missingAnswers: validationResults.flatMap((r) => r.missingAnswers ?? []),
            missingScores: validationResults.flatMap((r) => r.missingScores ?? []),
            wrongScores: validationResults.flatMap((r) => r.wrongScores ?? []),
        };
        const scoringAnalysis = (0, scoreHelper_1.getFormScoringAnalysis)({ questions: contents });
        const initialCurrentPageScoreAnalysis = (0, scoreHelper_1.getFormScoringAnalysis)({
            questions: contents.filter((q) => q.page === page),
        });
        //Current page question
        return {
            canReturnScoreAutomatically,
            totalValidQuestions,
            totalInvalidQuestions,
            validationResults: combinedResults,
            scoringAnalysis,
            initialCurrentPageScoreAnalysis,
        };
    }
    static getValidationMessageByQId = (issue, questionId) => issue
        .filter((i) => i._id === questionId || i.qIdx === questionId)
        .map((i) => i.message);
    static getFormOverviewDataById = async ({ formId, p, }) => {
        const [summary] = await Content_model_1.default.aggregate([
            { $match: { formId } },
            {
                $group: {
                    _id: formId,
                    totalQuestions: { $sum: 1 },
                    totalConditions: {
                        $sum: {
                            $cond: [{ $ifNull: ["$parentcontent", false] }, 1, 0],
                        },
                    },
                    currentPageTotalScores: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $not: { $ifNull: ["$parentcontent", false] } },
                                        { $eq: ["$page", p] },
                                    ],
                                },
                                { $ifNull: ["$score", 0] },
                                0,
                            ],
                        },
                    },
                    totalScores: {
                        //Totalscore of top-level question
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$type", Content_model_1.QuestionType.Text] },
                                        { $not: { $ifNull: ["$parentcontent", false] } },
                                    ],
                                },
                                { $ifNull: ["$score", 0] },
                                0,
                            ],
                        },
                    },
                    ...(p &&
                        p > 1 && {
                        lastQuestionIdx: {
                            $max: {
                                $cond: [
                                    {
                                        $lt: ["$page", p],
                                    },
                                    "$qIdx",
                                    0,
                                ],
                            },
                        },
                    }),
                },
            },
        ]);
        return summary;
    };
}
exports.FormValidationService = FormValidationService;
