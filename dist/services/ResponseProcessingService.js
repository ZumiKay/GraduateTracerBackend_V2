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
exports.ResponseProcessingService = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importStar(require("../model/Response.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importStar(require("../model/Form.model"));
const ResponseContentValidationService_1 = __importDefault(require("./ResponseContentValidationService"));
const EmailService_1 = __importDefault(require("./EmailService"));
const User_model_1 = __importDefault(require("../model/User.model"));
const RespondentTrackingService_1 = require("./RespondentTrackingService");
class ResponseProcessingService {
    static async processNormalFormSubmission(responseData) {
        const { formId, responseset, respondentEmail, respondentName } = responseData;
        const form = await Form_model_1.default.findById(formId).select("_id setting").lean();
        if (!form)
            throw new Error("Form not found");
        if (form.setting?.email && !respondentEmail) {
            throw new Error("Email is required for this form");
        }
        let isUser = undefined;
        if (respondentEmail) {
            isUser = (await User_model_1.default.findOne({ email: respondentEmail }))?._id;
        }
        //Verify if user already responded for single response form
        if (form.setting?.submitonce) {
            const trackingResult = await RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists(responseData);
            if (trackingResult.hasResponded) {
                throw new Error("Form already submitted");
            }
        }
        //Check response format
        const contents = await Content_model_1.default.find({ formId: formId }).lean();
        contents.forEach((question) => {
            const response = responseset.find((i) => i.question === question._id.toString());
            //Verify required question
            if (question.require) {
                if (!response ||
                    ResponseContentValidationService_1.default.isAnswerisempty(response.response))
                    throw new Error("Require");
            }
            if (!response) {
                throw new Error("Question not found");
            }
            const toverify = ResponseContentValidationService_1.default.validateAnswerFormat(question.type, response.response, question);
            if (!toverify.isValid)
                throw new Error("Format");
        });
        //Save response
        await Response_model_1.default.create({
            formId: new mongoose_1.Types.ObjectId(formId),
            responseset,
            submittedAt: new Date(),
            completionStatus: Response_model_1.ResponseCompletionStatus.completed,
            respondentFingerprint: responseData.respondentFingerprint,
            deviceInfo: responseData.deviceInfo,
            respondentIP: responseData.respondentIP,
            fingerprintStrength: responseData.fingerprintStrength,
            ...(form.setting?.email && {
                respondentEmail,
                respondentName,
                respondentType: isUser ? Response_model_1.RespondentType.user : Response_model_1.RespondentType.guest,
            }),
            userId: isUser,
            completionTime: responseData.completionTime,
        });
        return {
            message: "Form Submitted",
        };
    }
    /** Process Quiz Type Form
     * @description
     * - Validate Responses
     * - Add Score
     * - Send Copy of Response
     * - Save Response to DB
     */
    static async processFormSubmission(submissionData, form) {
        const { formId, responseset, respondentEmail, respondentName } = submissionData;
        if (!responseset || responseset.length === 0) {
            throw new Error("Invalid Response Data");
        }
        if (form.setting?.email && !respondentEmail) {
            throw new Error("Email is required for this form");
        }
        //Verify if user alr respond for single response form
        if (form.setting?.submitonce) {
            const trackingResult = await RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists(submissionData);
            if (trackingResult.hasResponded) {
                throw new Error("Form already submitted");
            }
        }
        const user = await User_model_1.default.findOne({
            email: submissionData.respondentEmail,
        })
            .lean()
            .select("_id email");
        //*Score calculate process
        let scoredResponses = [];
        let totalScore = 0;
        let isAutoScored = false;
        let isNonScore = false;
        // Auto-score
        let hasUnansweredScoredQuestion = false;
        if (form.setting?.returnscore === Form_model_1.returnscore.partial) {
            const addscore = await this.addScore(responseset);
            isAutoScored = true;
            // Check if all questions have no score
            isNonScore = addscore.isNonScore || false;
            hasUnansweredScoredQuestion =
                addscore.hasUnansweredScoredQuestion || false;
            scoredResponses = addscore.response;
        }
        else {
            const contents = await Content_model_1.default.find({ formId: formId }).lean();
            contents.forEach((question) => {
                const response = responseset?.find((i) => question._id.equals(i.question));
                //Verify required question
                if (question.require) {
                    if (!response ||
                        ResponseContentValidationService_1.default.isAnswerisempty(response.response))
                        throw new Error("Require");
                }
                if (!response) {
                    throw new Error("Question not found");
                }
                const toverify = ResponseContentValidationService_1.default.validateAnswerFormat(question.type, response.response, question);
                if (!toverify.isValid)
                    throw new Error("Format");
            });
        }
        totalScore =
            ResponseContentValidationService_1.default.calculateResponseTotalScore(scoredResponses);
        //?Condition question extraScore procession
        let extraScore;
        if (isAutoScored && scoredResponses.length > 0) {
            const allFormQuestions = await Content_model_1.default.find({ formId }).lean();
            const extraScoreQIds = new Set();
            for (const q of allFormQuestions) {
                if (!q.parentcontent)
                    continue;
                const parentQ = allFormQuestions.find((p) => p._id.toString() === (q.parentcontent.qId?.toString() ?? ""));
                //Extract extraScore question with parentQuestion flag isBonusScore
                if (parentQ && parentQ.isBonusScore && (parentQ.score ?? 0) === 0) {
                    extraScoreQIds.add(q._id.toString());
                }
            }
            if (extraScoreQIds.size > 0) {
                const scoredEntries = scoredResponses.filter((i) => typeof i.score === "number" && i.score > 0);
                const baseScore = Math.min(scoredEntries
                    .filter((i) => !extraScoreQIds.has(i.question.toString()))
                    .reduce((s, r) => s + (r.score ?? 0), 0), form.totalscore ?? 0);
                const extra = scoredEntries
                    .filter((i) => extraScoreQIds.has(i.question.toString()))
                    .reduce((s, r) => s + (r.score ?? 0), 0);
                totalScore = baseScore;
                if (extra > 0)
                    extraScore = extra;
            }
        }
        //Assign status to response
        let completionStatus = Response_model_1.ResponseCompletionStatus.submitted;
        if (isAutoScored) {
            const hasManualScoring = scoredResponses.some((i) => i.scoringMethod === Response_model_1.ScoringMethod.MANUAL);
            if (!hasManualScoring)
                completionStatus = Response_model_1.ResponseCompletionStatus.completed;
        }
        // Create response data
        const responseData = {
            formId: new mongoose_1.Types.ObjectId(formId),
            responseset: scoredResponses,
            maxScore: form.totalscore,
            totalScore,
            extraScore,
            submittedAt: new Date(),
            completionStatus: completionStatus,
            respondentType: user ? Response_model_1.RespondentType.user : Response_model_1.RespondentType.guest,
            respondentEmail: user ? user.email : respondentEmail,
            respondentName: respondentName,
            respondentFingerprint: submissionData.respondentFingerprint,
            deviceInfo: submissionData.deviceInfo,
            respondentIP: submissionData.respondentIP,
            fingerprintStrength: submissionData.fingerprintStrength,
            userId: user?._id,
            completionTime: submissionData.completionTime,
        };
        if (user?._id) {
            responseData.userId = new mongoose_1.Types.ObjectId(user._id);
        }
        const savedResponse = await Response_model_1.default.create(responseData);
        // Send results email if auto-scored
        if (isAutoScored && respondentEmail && !isNonScore) {
            const emailService = new EmailService_1.default();
            const email = user ? user.email : respondentEmail;
            if (email) {
                await emailService.sendResponseResults({
                    to: email,
                    formTitle: form.title,
                    totalScore,
                    maxScore: form.totalscore || 0,
                    responseId: savedResponse._id.toString(),
                    isAutoScored: true,
                });
            }
        }
        const isHavePartialScore = scoredResponses.some((i) => i.scoringMethod === Response_model_1.ScoringMethod.MANUAL);
        let message;
        if (!isAutoScored) {
            message = "Score will be return by form owner";
        }
        else if (isHavePartialScore && hasUnansweredScoredQuestion) {
            message =
                "Some questions were left unanswered and could not be auto-scored. This is not your final score — the form owner will review and complete your score.";
        }
        else if (isHavePartialScore) {
            message =
                "Totalscore is partial only might change when form owner return your score.";
        }
        else {
            message = "This your final score";
        }
        return {
            isNonScore,
            totalScore,
            extraScore,
            respondentEmail,
            responseId: savedResponse._id.toString(),
            maxScore: form.totalscore || 0,
            message,
            hasUnansweredScoredQuestion,
        };
    }
    /**
     *Add Score Method
     *@description
     * - Verify answer format
     * - All questions must have score and answer key to autoscored else isNonScore will be true
     * - Only avaliable if form returntype is PARTIAL
     */
    static async addScore(response) {
        if (response.length === 0) {
            return { response };
        }
        try {
            //Fetch all content responsible in the qids
            const content = await Content_model_1.default.find({
                _id: {
                    $in: response.map((i) => new mongoose_1.Types.ObjectId(i.question)),
                },
            }).lean();
            if (content.length === 0) {
                return { response };
            }
            let result = [];
            let hasAnyScore = false;
            let hasUnansweredScoredQuestion = false;
            //Scoring process
            for (let i = 0; i < content.length; i++) {
                const question = content[i];
                const userresponse = response.find((resp) => question._id.equals(resp.question));
                if (!userresponse) {
                    throw new Error("Question not found");
                }
                //Verify requried question
                if (question.require) {
                    if (!userresponse ||
                        ResponseContentValidationService_1.default.isAnswerisempty(userresponse.response)) {
                        throw new Error("Require");
                    }
                }
                const isEmpty = ResponseContentValidationService_1.default.isAnswerisempty(userresponse.response);
                // Only validate format when there is an answer
                if (!isEmpty) {
                    const isVerify = ResponseContentValidationService_1.default.validateAnswerFormat(question.type, userresponse.response, question);
                    if (!isVerify.isValid) {
                        throw new Error(isVerify.errors.join("||"));
                    }
                }
                const maxScore = question.score || 0;
                // Track if any question has a score
                if (maxScore > 0) {
                    hasAnyScore = true;
                }
                if (isEmpty && maxScore > 0 && question.answer?.answer) {
                    hasUnansweredScoredQuestion = true;
                    result.push({
                        ...userresponse,
                        score: 0,
                        scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                    });
                }
                //Automically Score All Scoreable Questions
                else if (!isEmpty && question.answer && question.answer?.answer) {
                    const partialScored = ResponseContentValidationService_1.default.calculateResponseScore(userresponse.response, question.answer.answer, question.type, maxScore);
                    result.push({
                        ...userresponse,
                        score: partialScored,
                        scoringMethod: Response_model_1.ScoringMethod.AUTO,
                    });
                }
                //If unscoreable mark to score manually
                else
                    result.push({
                        ...userresponse,
                        scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                    });
            }
            // isNonScore is true when NO questions have scores (all maxScore = 0)
            const isNonScore = !hasAnyScore;
            const isNeedManuallyScore = result.some((i) => i.scoringMethod === Response_model_1.ScoringMethod.MANUAL);
            return {
                response: result,
                isNonScore,
                isNeedManuallyScore,
                hasUnansweredScoredQuestion,
            };
        }
        catch (error) {
            console.error("AddScore Error:", error);
            throw error;
        }
    }
    static async updateResponseScores({ responseId, scores, }) {
        // Validate input
        if (!scores || !Array.isArray(scores) || scores.length === 0) {
            throw new Error("Invalid scores data");
        }
        const response = await Response_model_1.default.findById(responseId).select("responseset totalScore maxScore formId");
        if (!response) {
            throw new Error("Response not found");
        }
        const [questionScoreMap, questionCommentMap] = [
            new Map(scores.map((s) => [s.questionId.toString(), s.score])),
            new Map(scores.map((c) => [c.questionId.toString(), c.comment])),
        ];
        let updatedTotalScore = 0;
        let updatedCount = 0;
        response.responseset.forEach((responseItem) => {
            const questionId = typeof responseItem.question === "string"
                ? responseItem.question
                : responseItem.question.toString();
            const newScore = questionScoreMap.get(questionId);
            const newComment = questionCommentMap.get(questionId);
            if (newScore !== undefined || newComment) {
                if (newScore !== undefined) {
                    responseItem.score = newScore;
                    responseItem.scoringMethod = Response_model_1.ScoringMethod.MANUAL;
                }
                if (newComment)
                    responseItem.comment = newComment;
                updatedCount++;
            }
            // Calculate new total score
            updatedTotalScore += responseItem.score || 0;
        });
        if (updatedCount === 0) {
            return {
                success: true,
                message: "No matching questions found to update",
            };
        }
        response.totalScore = updatedTotalScore;
        response.completionStatus = Response_model_1.ResponseCompletionStatus.completed;
        await response.save({ validateBeforeSave: false });
        return {
            success: true,
            updatedScores: updatedCount,
            totalScore: updatedTotalScore,
        };
    }
    static async batchUpdateResponseScores(updates) {
        const results = await Promise.allSettled(updates.map((update) => this.updateResponseScores({
            responseId: update.responseId,
            scores: update.scores,
        })));
        const successful = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;
        return {
            success: failed === 0,
            total: updates.length,
            successful,
            failed,
            results: results.map((r, idx) => ({
                responseId: updates[idx].responseId,
                status: r.status,
                data: r.status === "fulfilled" ? r.value : undefined,
                error: r.status === "rejected" ? r.reason?.message : undefined,
            })),
        };
    }
    static async recalculateResponseTotalScore(responseId) {
        const response = await Response_model_1.default.findById(responseId).select("responseset totalScore");
        if (!response) {
            throw new Error("Response not found");
        }
        const calculatedTotal = response.responseset.reduce((sum, item) => sum + (item.score || 0), 0);
        if (calculatedTotal !== response.totalScore) {
            response.totalScore = calculatedTotal;
            await response.save({ validateBeforeSave: false });
            return {
                success: true,
                previousTotal: response.totalScore,
                newTotal: calculatedTotal,
                corrected: true,
            };
        }
        return {
            success: true,
            totalScore: calculatedTotal,
            corrected: false,
        };
    }
    static deepEqual(a, b) {
        if (a === b)
            return true;
        if (typeof a !== "object" || typeof b !== "object" || !a || !b)
            return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length)
            return false;
        return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) &&
            this.deepEqual(a[key], b[key]));
    }
    static validateResponset({ responseSet, questionSet, }) {
        if (responseSet.length === 0 || questionSet.length === 0) {
            return { errormess: "No responses or questions found" };
        }
        for (let i = 0; i < responseSet.length; i++) {
            const response = responseSet[i];
            const question = questionSet.find((i) => i._id?.toString() === response.question.toString());
            //If one of the response question is not found in the question set, return error reponse should alway have response question
            if (!question) {
                return { errormess: "Response format is inccorect" };
            }
            //Required Question
            const isRequired = question.require || false;
            if (isRequired) {
                const isEmptyResponse = response.response === null ||
                    response.response === undefined ||
                    (typeof response.response === "string" &&
                        response.response.trim() === "") ||
                    (Array.isArray(response.response) && response.response.length === 0);
                if (isEmptyResponse) {
                    return {
                        errormess: "Missing required question",
                    };
                }
                //Verify if the response type matches the question type
                const validationResult = this.validateResponseType(response, question);
                if (validationResult !== true) {
                    return validationResult;
                }
            }
        }
        return true;
    }
    static validateResponseType(response, question) {
        const { type } = question;
        const responseValue = response.response;
        switch (type) {
            case Content_model_1.QuestionType.Text:
            case Content_model_1.QuestionType.ShortAnswer:
            case Content_model_1.QuestionType.Paragraph:
            case Content_model_1.QuestionType.Date:
                if (typeof responseValue !== "string") {
                    return {
                        errormess: `Invalid response type for ${type} question. Expected string.`,
                    };
                }
                break;
            case Content_model_1.QuestionType.Number:
                if (typeof responseValue !== "number") {
                    return {
                        errormess: `Invalid response type for ${type} question. Expected number.`,
                    };
                }
                break;
            case Content_model_1.QuestionType.MultipleChoice:
            case Content_model_1.QuestionType.Selection:
                if (typeof responseValue !== "string" &&
                    typeof responseValue !== "number") {
                    return {
                        errormess: `Invalid response type for ${type} question. Expected string or number.`,
                    };
                }
                break;
            case Content_model_1.QuestionType.CheckBox:
                if (!Array.isArray(responseValue)) {
                    return {
                        errormess: "Invalid response type for checkbox question. Expected array.",
                    };
                }
                break;
            case Content_model_1.QuestionType.RangeDate:
                if (!Array.isArray(responseValue) ||
                    responseValue.length !== 2 ||
                    !responseValue.every((val) => typeof val === "string" || (val && typeof val === "object"))) {
                    return {
                        errormess: "Invalid response type for date range question. Expected array of 2 dates.",
                    };
                }
                break;
            case Content_model_1.QuestionType.RangeNumber:
                if (!Array.isArray(responseValue) ||
                    responseValue.length !== 2 ||
                    !responseValue.every((val) => typeof val === "number")) {
                    return {
                        errormess: "Invalid response type for number range question. Expected array of 2 numbers.",
                    };
                }
                break;
            default:
                // For any other question types, allow any response
                break;
        }
        return true;
    }
    /**
     * Validates form submission data before processing
     */
    static async validateFormSubmission(submissionData) {
        const { formId, responseset } = submissionData;
        const form = await Form_model_1.default.findById(formId);
        if (!form) {
            return { errormess: "Form not found" };
        }
        if (!form.setting?.acceptResponses) {
            return { errormess: "Form is no longer accepting responses" };
        }
        const questions = await Content_model_1.default.find({ formId }).lean();
        if (!questions || questions.length === 0) {
            return { errormess: "No questions found for this form" };
        }
        // Validate response set
        const validationResult = this.validateResponset({
            responseSet: responseset,
            questionSet: questions,
        });
        return validationResult;
    }
    static async checkExistingResponse(formId, userId, guestEmail) {
        const query = { formId };
        if (userId) {
            query.userId = new mongoose_1.Types.ObjectId(userId);
        }
        else if (guestEmail) {
            query["guest.email"] = guestEmail;
        }
        else {
            return null;
        }
        return await Response_model_1.default.findOne(query).lean();
    }
    static async getFormMaxScore(formId) {
        const questions = await Content_model_1.default.find({ formId }).select("score").lean();
        return questions.reduce((total, question) => total + (question.score || 0), 0);
    }
    static async getResponseStatistics(formId) {
        const totalResponses = await Response_model_1.default.countDocuments({ formId });
        const completedResponses = await Response_model_1.default.countDocuments({
            formId,
            completionStatus: Response_model_1.ResponseCompletionStatus.completed,
        });
        const responses = await Response_model_1.default.find({ formId })
            .select("totalScore")
            .lean();
        const scores = responses.map((r) => r.totalScore || 0);
        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        return {
            totalResponses,
            completedResponses,
            completionRate: totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0,
            averageScore,
            maxScore,
            minScore,
        };
    }
}
exports.ResponseProcessingService = ResponseProcessingService;
