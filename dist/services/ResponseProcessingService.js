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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseProcessingService = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importStar(require("../model/Response.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importStar(require("../model/Form.model"));
const SolutionValidationService_1 = __importDefault(require("./SolutionValidationService"));
const EmailService_1 = __importDefault(require("./EmailService"));
const User_model_1 = __importDefault(require("../model/User.model"));
const RespondentTrackingService_1 = require("./RespondentTrackingService");
class ResponseProcessingService {
    static processNormalFormSubmission(responseData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const { formId, responseset, respondentEmail, respondentName } = responseData;
            const form = yield Form_model_1.default.findById(formId).select("_id setting").lean();
            if (!form)
                throw new Error("Form not found");
            if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.email) && !respondentEmail) {
                throw new Error("Email is required for this form");
            }
            let isUser = undefined;
            if (respondentEmail) {
                isUser = (_b = (yield User_model_1.default.findOne({ email: respondentEmail }))) === null || _b === void 0 ? void 0 : _b._id;
            }
            //Verify if user already responded for single response form
            if ((_c = form.setting) === null || _c === void 0 ? void 0 : _c.submitonce) {
                const trackingResult = yield RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists(responseData);
                if (trackingResult.hasResponded) {
                    throw new Error("Form already submitted");
                }
            }
            //Check response format
            const contents = yield Content_model_1.default.find({ formId: formId }).lean();
            contents.forEach((question) => {
                const response = responseset.find((i) => i.question === question._id.toString());
                //Verify required question
                if (question.require) {
                    if (!response ||
                        SolutionValidationService_1.default.isAnswerisempty(response.response))
                        throw new Error("Require");
                }
                if (!response) {
                    throw new Error("Question not found");
                }
                const toverify = SolutionValidationService_1.default.validateAnswerFormat(question.type, response.response, question);
                if (!toverify.isValid)
                    throw new Error("Format");
            });
            //Save response
            yield Response_model_1.default.create(Object.assign(Object.assign({ formId: new mongoose_1.Types.ObjectId(formId), responseset, submittedAt: new Date(), completionStatus: Response_model_1.ResponseCompletionStatus.completed, respondentFingerprint: responseData.respondentFingerprint, deviceInfo: responseData.deviceInfo, respondentIP: responseData.respondentIP, fingerprintStrength: responseData.fingerprintStrength }, (((_d = form.setting) === null || _d === void 0 ? void 0 : _d.email) && {
                respondentEmail,
                respondentName,
                respondentType: isUser ? Response_model_1.RespondentType.user : Response_model_1.RespondentType.guest,
            })), { userId: isUser }));
            return {
                message: "Form Submitted",
            };
        });
    }
    static processFormSubmission(submissionData, form) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { formId, responseset, respondentEmail, respondentName } = submissionData;
            if (!responseset || responseset.length === 0) {
                throw new Error("Invalid Response Data");
            }
            if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.email) && !respondentEmail) {
                throw new Error("Email is required for this form");
            }
            //Verify if user alr respond for single response form
            if ((_b = form.setting) === null || _b === void 0 ? void 0 : _b.submitonce) {
                const hasResponse = yield Response_model_1.default.findOne({
                    respondentEmail,
                    formId,
                });
                if (hasResponse) {
                    throw new Error("Form already exisited");
                }
            }
            const user = yield User_model_1.default.findOne({
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
            if (((_c = form.setting) === null || _c === void 0 ? void 0 : _c.returnscore) === Form_model_1.returnscore.partial) {
                const addscore = yield this.addScore(responseset);
                isAutoScored = true;
                // Check if all questions have no score
                isNonScore = addscore.isNonScore || false;
                scoredResponses = addscore.response;
            }
            else {
                const contents = yield Content_model_1.default.find({ formId: formId }).lean();
                contents.forEach((question) => {
                    const response = responseset === null || responseset === void 0 ? void 0 : responseset.find((i) => question._id.equals(i.question));
                    //Verify required question
                    if (question.require) {
                        if (!response ||
                            SolutionValidationService_1.default.isAnswerisempty(response.response))
                            throw new Error("Require");
                    }
                    if (!response) {
                        throw new Error("Question not found");
                    }
                    const toverify = SolutionValidationService_1.default.validateAnswerFormat(question.type, response.response, question);
                    if (!toverify.isValid)
                        throw new Error("Format");
                });
            }
            // Calculate total score
            totalScore =
                SolutionValidationService_1.default.calcualteResponseTotalScore(scoredResponses);
            // Determine completion status based on auto-scoring and scoring method
            let completionStatus = Response_model_1.ResponseCompletionStatus.submitted;
            if (isNonScore) {
                completionStatus = Response_model_1.ResponseCompletionStatus.noscore;
            }
            else if (isAutoScored) {
                // Check if there are any manual scoring responses
                const hasManualScoring = scoredResponses.some((i) => i.scoringMethod === Response_model_1.ScoringMethod.MANUAL);
                completionStatus = hasManualScoring
                    ? Response_model_1.ResponseCompletionStatus.partial
                    : Response_model_1.ResponseCompletionStatus.autoscore;
            }
            // Create response data
            const responseData = {
                formId: new mongoose_1.Types.ObjectId(formId),
                responseset: scoredResponses,
                maxScore: form.totalscore,
                totalScore,
                submittedAt: new Date(),
                completionStatus: completionStatus,
                respondentType: user ? Response_model_1.RespondentType.user : Response_model_1.RespondentType.guest,
                respondentEmail: user ? user.email : respondentEmail,
                respondentName: respondentName,
                userId: user === null || user === void 0 ? void 0 : user._id,
            };
            if (user === null || user === void 0 ? void 0 : user._id) {
                responseData.userId = new mongoose_1.Types.ObjectId(user._id);
            }
            const savedResponse = yield Response_model_1.default.create(responseData);
            // Send results email if auto-scored
            if (isAutoScored && respondentEmail && !isNonScore) {
                const emailService = new EmailService_1.default();
                const email = user ? user.email : respondentEmail;
                if (email) {
                    yield emailService.sendResponseResults({
                        to: email,
                        formTitle: form.title,
                        totalScore,
                        maxScore: form.totalscore || 0,
                        responseId: savedResponse._id.toString(),
                        isAutoScored: true,
                    });
                }
            }
            const isHavePartialScore = scoredResponses.some((i) => i.scoringMethod === Response_model_1.ScoringMethod.MANUAL) ||
                isNonScore;
            return {
                isNonScore,
                totalScore,
                respondentEmail,
                responseId: savedResponse._id.toString(),
                maxScore: form.totalscore || 0,
                message: !isAutoScored
                    ? "Score will be return by form owner"
                    : isHavePartialScore
                        ? "Totalscore is partial only might change when form owner return your score."
                        : "This your final score",
            };
        });
    }
    /**
     *Add Score Method
     *@Feature
     * - Verify answer format
     * - If all question have no score return isNonScore
     * - Only avaliable if form returntype is PARTIAL
     */
    static addScore(response) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (response.length === 0) {
                return { response };
            }
            try {
                //Fetch all content responsible in the qids
                const content = yield Content_model_1.default.find({
                    _id: {
                        $in: response.map((i) => new mongoose_1.Types.ObjectId(i.question)),
                    },
                }).lean();
                if (content.length === 0) {
                    return { response };
                }
                let result = [];
                let hasAnyScore = false;
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
                            SolutionValidationService_1.default.isAnswerisempty(userresponse.response)) {
                            throw new Error("Require");
                        }
                    }
                    //Verify answer format and validity
                    const isVerify = SolutionValidationService_1.default.validateAnswerFormat(question.type, userresponse.response, question);
                    if (!isVerify.isValid) {
                        throw new Error(isVerify.errors.join("||"));
                    }
                    const maxScore = question.score || 0;
                    // Track if any question has a score
                    if (maxScore > 0) {
                        hasAnyScore = true;
                    }
                    //Automically Score All Scoreable Questions
                    if (question.answer && ((_a = question.answer) === null || _a === void 0 ? void 0 : _a.answer)) {
                        const partialScored = SolutionValidationService_1.default.calculateResponseScore(userresponse.response, question.answer.answer, question.type, maxScore);
                        result.push(Object.assign(Object.assign({}, userresponse), { score: partialScored, scoringMethod: Response_model_1.ScoringMethod.AUTO }));
                    }
                    //If unscoreable mark to score manually
                    else
                        result.push(Object.assign(Object.assign({}, userresponse), { scoringMethod: Response_model_1.ScoringMethod.MANUAL }));
                }
                // isNonScore is true when NO questions have scores (all maxScore = 0)
                const isNonScore = !hasAnyScore;
                return { response: result, isNonScore };
            }
            catch (error) {
                console.error("AddScore Error:", error);
                return { response };
            }
        });
    }
    static updateResponseScores(_a) {
        return __awaiter(this, arguments, void 0, function* ({ responseId, scores, }) {
            // Validate input
            if (!scores || !Array.isArray(scores) || scores.length === 0) {
                throw new Error("Invalid scores data");
            }
            // Find response - not using lean() to maintain _id on subdocuments
            const response = yield Response_model_1.default.findById(responseId).select("responseset totalScore maxScore formId");
            if (!response) {
                throw new Error("Response not found");
            }
            // Create a map for efficient lookup
            const [questionScoreMap, questionCommentMap] = [
                new Map(scores.map((s) => [s.questionId.toString(), s.score])),
                new Map(scores.map((c) => [c.questionId.toString(), c.comment])),
            ];
            let updatedTotalScore = 0;
            let updatedCount = 0;
            // Update scores and comment in the responseset array
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
            // Update totalScore and completionStatus
            response.totalScore = updatedTotalScore;
            response.completionStatus = Response_model_1.ResponseCompletionStatus.completed;
            // Save all changes in a single operation with optimized write concern
            yield response.save({ validateBeforeSave: false });
            return {
                success: true,
                updatedScores: updatedCount,
                totalScore: updatedTotalScore,
            };
        });
    }
    /**
     * Batch update scores for multiple responses
     * More efficient when updating multiple responses at once
     */
    static batchUpdateResponseScores(updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.allSettled(updates.map((update) => this.updateResponseScores({
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
                results: results.map((r, idx) => {
                    var _a;
                    return ({
                        responseId: updates[idx].responseId,
                        status: r.status,
                        data: r.status === "fulfilled" ? r.value : undefined,
                        error: r.status === "rejected" ? (_a = r.reason) === null || _a === void 0 ? void 0 : _a.message : undefined,
                    });
                }),
            };
        });
    }
    /**
     * Recalculate total score for a response
     * Useful for fixing inconsistencies or after data migration
     */
    static recalculateResponseTotalScore(responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield Response_model_1.default.findById(responseId).select("responseset totalScore");
            if (!response) {
                throw new Error("Response not found");
            }
            const calculatedTotal = response.responseset.reduce((sum, item) => sum + (item.score || 0), 0);
            if (calculatedTotal !== response.totalScore) {
                response.totalScore = calculatedTotal;
                yield response.save({ validateBeforeSave: false });
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
        });
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
            const question = questionSet.find((i) => { var _a; return ((_a = i._id) === null || _a === void 0 ? void 0 : _a.toString()) === response.question.toString(); });
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
    static validateFormSubmission(submissionData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { formId, responseset } = submissionData;
            // Check if form exists
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return { errormess: "Form not found" };
            }
            // Check if form accepts responses
            if (!((_a = form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses)) {
                return { errormess: "Form is no longer accepting responses" };
            }
            // Get form questions
            const questions = yield Content_model_1.default.find({ formId }).lean();
            if (!questions || questions.length === 0) {
                return { errormess: "No questions found for this form" };
            }
            // Validate response set
            const validationResult = this.validateResponset({
                responseSet: responseset,
                questionSet: questions,
            });
            return validationResult;
        });
    }
    /**
     * Checks if a response already exists for a user/form combination
     */
    static checkExistingResponse(formId, userId, guestEmail) {
        return __awaiter(this, void 0, void 0, function* () {
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
            return yield Response_model_1.default.findOne(query).lean();
        });
    }
    /**
     * Calculates the maximum possible score for a form
     */
    static getFormMaxScore(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            const questions = yield Content_model_1.default.find({ formId }).select("score").lean();
            return questions.reduce((total, question) => total + (question.score || 0), 0);
        });
    }
    /**
     * Gets response statistics for a specific form
     */
    static getResponseStatistics(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            const totalResponses = yield Response_model_1.default.countDocuments({ formId });
            const completedResponses = yield Response_model_1.default.countDocuments({
                formId,
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
            });
            const responses = yield Response_model_1.default.find({ formId })
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
        });
    }
}
exports.ResponseProcessingService = ResponseProcessingService;
