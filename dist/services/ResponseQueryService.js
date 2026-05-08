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
exports.ResponseQueryService = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const ResponseValidationService_1 = require("./ResponseValidationService");
const fingerprint_1 = require("../utilities/fingerprint");
const helper_1 = require("../utilities/helper");
const formHelpers_1 = require("../utilities/formHelpers");
const bcrypt_1 = require("bcrypt");
class ResponseQueryService {
    static SUMMARY_SELECT_RESPONSE_FIELD = "_id respondentEmail respondentName respondentType submittedAt isCompleted completionStatus createdAt";
    static async fetchResponsesWithPagination(query, page, limit, sortOptions, selectFields, populate) {
        const skip = (page - 1) * limit;
        let queryBuilder = Response_model_1.default.find(query);
        if (populate) {
            queryBuilder = queryBuilder.populate(populate);
        }
        if (sortOptions) {
            queryBuilder = queryBuilder.sort(sortOptions);
        }
        queryBuilder = queryBuilder
            .select(selectFields || this.SUMMARY_SELECT_RESPONSE_FIELD)
            .skip(skip)
            .limit(limit)
            .lean();
        const [responses, totalCount] = await Promise.all([
            queryBuilder,
            Response_model_1.default.countDocuments(query),
        ]);
        // Extract formId from query if it exists
        const formId = query.formId;
        // Get response counts for each unique respondentEmail
        const responsesWithCount = await this.addResponseCountByEmail(responses, formId);
        return {
            responses: responsesWithCount,
            pagination: ResponseValidationService_1.ResponseValidationService.createPaginationResponse(page, limit, totalCount),
        };
    }
    /**
     * Add response count for each respondentEmail
     * @param responses - Array of response objects
     * @param formId - Form ID to filter responses by
     * @returns Responses with responseCount field added
     */
    static async addResponseCountByEmail(responses, formId) {
        if (!responses || responses.length === 0) {
            return responses;
        }
        // Extract unique respondent emails
        const emails = [
            ...new Set(responses
                .map((r) => r.respondentEmail)
                .filter((email) => !!email)),
        ];
        if (emails.length === 0) {
            // If no emails, return responses with count 0
            return responses.map((r) => ({ ...r, responseCount: 0 }));
        }
        // Build aggregation pipeline to count responses per email
        const emailCounts = await Response_model_1.default.aggregate([
            {
                $match: {
                    respondentEmail: { $in: emails },
                    ...(formId && { formId: formId }),
                },
            },
            {
                $group: {
                    _id: "$respondentEmail",
                    count: { $sum: 1 },
                },
            },
        ]);
        // Create a map for quick lookup
        const emailCountMap = new Map(emailCounts.map((item) => [item._id, item.count]));
        // Add responseCount to each response
        return responses.map((response) => ({
            ...response,
            responseCount: response.respondentEmail
                ? emailCountMap.get(response.respondentEmail) || 0
                : 0,
        }));
    }
    static async getResponsesByFormId(formId, page, limit) {
        return this.fetchResponsesWithPagination({ formId }, page, limit);
    }
    /**
    Get Response by UserId and With Pagination for multiple responses
    @RequestParam formId | page | resIdx | useId
    @page for navigate within form
    @resIdx resIdx for navigate user responses
    */
    static async getResponsebyUserIdWithPagination(req, res) {
        const { formId, page, resIdx, userId } = req.params;
        // Validate parameters
        if (!(0, mongoose_1.isValidObjectId)(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        }
        const pageNum = Number(page);
        const responseIdx = Number(resIdx);
        const limit = 1; // One response at a time based on resIdx
        if (isNaN(pageNum) || isNaN(responseIdx) || responseIdx < 0) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Invalid page or response index"));
        }
        try {
            const query = {
                formId: new mongoose_1.Types.ObjectId(formId),
                userId,
            };
            const totalCount = await Response_model_1.default.countDocuments(query);
            if (responseIdx >= totalCount) {
                return res
                    .status(404)
                    .json((0, helper_1.ReturnCode)(404, "Response index out of range"));
            }
            const response = await Response_model_1.default.findOne(query)
                .skip(responseIdx)
                .limit(limit)
                .lean();
            if (!response) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
            }
            const pagination = ResponseValidationService_1.ResponseValidationService.createPaginationResponse(responseIdx + 1, limit, totalCount);
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: {
                    response,
                    pagination,
                },
            });
        }
        catch (error) {
            console.log("Get response by userId", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    }
    static async getResponsesWithFilters(filters) {
        const query = ResponseValidationService_1.ResponseValidationService.buildFilterQuery(filters);
        const sortOptions = ResponseValidationService_1.ResponseValidationService.buildSortOptions(filters.sortBy, filters.sortOrder);
        // If group parameter is present, group by respondentEmail
        if (filters.group === "respondentEmail") {
            return this.getGroupedResponses(query, filters.page, filters.limit, sortOptions);
        }
        return this.fetchResponsesWithPagination(query, filters.page, filters.limit, sortOptions, this.SUMMARY_SELECT_RESPONSE_FIELD, ["userId email"]);
    }
    /**
     * Get responses grouped by respondent email
     */
    static async getGroupedResponses(query, page, limit, sortOptions) {
        const skip = (page - 1) * limit;
        // Aggregation pipeline to group responses by respondent email
        const pipeline = [
            { $match: query },
            {
                $group: {
                    _id: "$respondentEmail",
                    respondentEmail: { $first: "$respondentEmail" },
                    respondentName: { $first: "$respondentName" },
                    respondentType: { $first: "$respondentType" },
                    responseCount: { $sum: 1 },
                    responseIds: { $push: { $toString: "$_id" } },
                    lastSubmittedAt: { $max: "$submittedAt" },
                },
            },
        ];
        // Apply sorting
        if (sortOptions) {
            pipeline.push({ $sort: sortOptions });
        }
        else {
            // Default sort by last submission date
            pipeline.push({ $sort: { lastSubmittedAt: -1 } });
        }
        // Count total groups
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await Response_model_1.default.aggregate(countPipeline);
        const totalCount = countResult.length > 0 ? countResult[0].total : 0;
        // Add pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
        // Project final shape
        pipeline.push({
            $project: {
                _id: 0,
                respondentEmail: 1,
                respondentName: 1,
                respondentType: 1,
                responseCount: 1,
                responseIds: 1,
            },
        });
        const groupedResponses = await Response_model_1.default.aggregate(pipeline);
        return {
            responses: groupedResponses,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }
    static async getUserResponses({ page, limit, user, formId, }) {
        const query = {
            formId,
            $or: [{ user }, { respondentEmail: user }],
        };
        return this.fetchResponsesWithPagination(query, page, limit, {
            submittedAt: -1,
        });
    }
    static async getGuestResponses(formId) {
        return Response_model_1.default.find({
            formId,
            userId: null,
        }).lean();
    }
    static async getPublicFormData(formId, page = 1, req, res) {
        if (!mongoose_1.Types.ObjectId.isValid(formId)) {
            throw new Error("Invalid form ID");
        }
        const formObjectId = new mongoose_1.Types.ObjectId(formId);
        // Parallel execution for better performance
        const [form, contents] = await Promise.all([
            Form_model_1.default.findById(formObjectId)
                .select("title type setting totalpage totalscore")
                .lean(),
            Content_model_1.default.find({
                formId: formObjectId,
                page,
            })
                .select("_id qIdx title type text multiple selection checkbox rangedate rangenumber date require page conditional parentcontent score")
                .sort({ qIdx: 1 })
                .lean(),
        ]);
        if (!form) {
            throw new Error("Form not found");
        }
        if (form.setting?.acceptResponses === false) {
            throw new Error("Form is no longer accepting responses");
        }
        //Check if the user has submitted (Single Form)
        if (form.setting?.submitonce) {
            const existingResponse = await this.checkExistingResponse(formId, form.setting.email, req);
            if (existingResponse) {
                return {
                    ...form,
                    isResponsed: {
                        message: "You already submitted response",
                        ...existingResponse,
                        _id: undefined,
                        formId: undefined,
                        responseId: existingResponse._id,
                        maxScore: form.totalscore,
                    },
                };
            }
        }
        // Clean up content data
        const resultContents = contents.map((content) => ({
            ...content,
            parentcontent: content.parentcontent?.qId === content._id.toString()
                ? undefined
                : content.parentcontent,
            answer: undefined,
        }));
        // Get cumulative question count from previous pages for proper numbering
        const lastQuestionIdx = await (0, formHelpers_1.getLastQuestionIdx)(formObjectId, page);
        return {
            ...form,
            contentIds: undefined,
            contents: (0, helper_1.AddQuestionNumbering)({
                questions: resultContents,
                lastIdx: lastQuestionIdx,
            }),
        };
    }
    /**
     * Calculate IP match score based on multiple factors
     * Returns a score from 0-100 indicating confidence level
     */
    static calculateIPMatchScore(currentIP, storedHashedIP, deviceInfo, storedDeviceInfo) {
        let score = 0;
        // IP exact match (80 points) - Primary indicator, if IP matches it's very likely the same user
        const isIPMatch = (0, bcrypt_1.compareSync)(currentIP, storedHashedIP);
        if (isIPMatch) {
            score += 80;
        }
        // Platform match (10 points) - Secondary verification
        if (deviceInfo?.platform &&
            storedDeviceInfo?.platform &&
            deviceInfo.platform === storedDeviceInfo.platform) {
            score += 10;
        }
        // Timezone match (10 points) - Secondary verification
        if (deviceInfo?.timezone &&
            storedDeviceInfo?.timezone &&
            deviceInfo.timezone === storedDeviceInfo.timezone) {
            score += 10;
        }
        return score;
    }
    static async checkExistingResponse(formId, requireEmail, req) {
        const baseQuery = {
            formId: new mongoose_1.Types.ObjectId(formId),
        };
        // Define select fields based on requireEmail
        const selectFields = requireEmail
            ? "_id totalScore isCompleted submittedAt respondentEmail respondentName"
            : "_id totalScore completionStatus submittedAt respondentEmail responseName respondentIP deviceInfo";
        if (requireEmail) {
            // Email-based lookup (simpler path)
            const email = req?.body?.respondentEmail;
            if (!email)
                return null;
            return Response_model_1.default.findOne({
                ...baseQuery,
                respondentEmail: email,
            })
                .select(selectFields)
                .lean();
        }
        // Query all responses and calculate match scores for best match
        const deviceInfo = fingerprint_1.FingerprintService.extractFingerprintFromRequest(req);
        const respondentIP = fingerprint_1.FingerprintService.getClientIP(req);
        // Fetch all responses for this form
        const allResponses = await Response_model_1.default.find(baseQuery)
            .select(selectFields)
            .lean();
        if (!allResponses || allResponses.length === 0) {
            return null;
        }
        // Calculate match score for each response and find the best match
        let bestMatch = null;
        let highestScore = 0;
        for (const response of allResponses) {
            if (response.respondentIP) {
                const matchScore = this.calculateIPMatchScore(respondentIP, response.respondentIP, deviceInfo, response.deviceInfo);
                if (matchScore > highestScore) {
                    highestScore = matchScore;
                    bestMatch = response;
                }
            }
        }
        // Return best match if score is above 70% (IP match alone = 80%, so it will pass)
        return highestScore >= 70 ? bestMatch : null;
    }
    static async deleteResponse(responseId) {
        return Response_model_1.default.findByIdAndDelete(responseId);
    }
    static async bulkDeleteResponses(responseIds, formId) {
        if (!mongoose_1.Types.ObjectId.isValid(formId)) {
            throw new Error(`Invalid form ID: ${formId}`);
        }
        const { validObjectIds, invalidIds } = this.validateObjectIds(responseIds);
        if (invalidIds.length > 0) {
            throw new Error(`Invalid response ID(s): ${invalidIds.join(", ")}. Expected valid MongoDB ObjectIds.`);
        }
        if (validObjectIds.length === 0) {
            throw new Error("No valid response IDs provided");
        }
        const formObjectId = new mongoose_1.Types.ObjectId(formId);
        const responseCount = await Response_model_1.default.countDocuments({
            _id: { $in: validObjectIds },
            formId: formObjectId,
        });
        if (responseCount !== validObjectIds.length) {
            throw new Error("Some responses don't exist or don't belong to this form");
        }
        const deleteResult = await Response_model_1.default.deleteMany({
            _id: { $in: validObjectIds },
            formId: formObjectId,
        });
        return {
            deletedCount: deleteResult.deletedCount,
        };
    }
    static validateObjectIds(ids) {
        const validObjectIds = [];
        const invalidIds = [];
        for (const id of ids) {
            if ((0, mongoose_1.isValidObjectId)(id)) {
                validObjectIds.push(new mongoose_1.Types.ObjectId(id));
            }
            else {
                invalidIds.push(id);
            }
        }
        return { validObjectIds, invalidIds };
    }
    static async GetResponseById({ id, formId }) {
        const isResponse = await Response_model_1.default.findById(id)
            .select(`${this.SUMMARY_SELECT_RESPONSE_FIELD} responseset formId`)
            .lean();
        if (!isResponse)
            return null;
        const contents = await Content_model_1.default.find({
            formId,
        })
            .select("-rangedate -date -rangenumber")
            .sort({ qIdx: 1 })
            .lean();
        // Get response count for this respondent email
        let responseCount = 0;
        if (isResponse.respondentEmail && isResponse.formId) {
            responseCount = await Response_model_1.default.countDocuments({
                formId: isResponse.formId,
                respondentEmail: isResponse.respondentEmail,
            });
        }
        //All require question must have an max score
        const isScoreable = !contents.some((question) => question.require && !question.score);
        return {
            ...isResponse,
            responseCount,
            isScoreable,
            responseset: this.ResponsesetProcessQuestion((0, helper_1.AddQuestionNumbering)({
                questions: contents,
            }), isResponse.responseset),
        };
    }
    /**
     * Process questions with responses and optionally filter hidden conditional questions
     * @param questions - Array of questions
     * @param responseset - Array of responses
     * @param options - Optional configuration
     * @param options.filterHidden - If true, filter out conditional questions that don't match responses
     * @returns Processed response set with question details
     */
    static ResponsesetProcessQuestion(questions, responseset, options) {
        // Early validation with fast path
        const invalidQuestion = questions.find((q) => !q._id);
        if (invalidQuestion) {
            throw new Error("Invalid Question");
        }
        // Build response map once - O(n) instead of O(n*m) lookups
        const responseMap = new Map();
        for (let i = 0; i < responseset.length; i++) {
            const r = responseset[i];
            responseMap.set(r.question.toString(), r);
        }
        const filterHidden = options?.filterHidden ?? false;
        const questionsLength = questions.length;
        const result = [];
        // Pre-allocate estimated capacity
        result.length = 0;
        for (let i = 0; i < questionsLength; i++) {
            const question = questions[i];
            const questionId = question._id.toString();
            const existingResponse = responseMap.get(questionId);
            // Handle conditional question filtering
            if (filterHidden && question.parentcontent) {
                const parentResponse = responseMap.get(question.parentcontent.qId)?.response;
                if (parentResponse !== undefined) {
                    const shouldShow = this.shouldShowConditionalQuestion(parentResponse, question.parentcontent.optIdx);
                    if (!shouldShow && !existingResponse)
                        continue;
                }
                else if (!existingResponse) {
                    continue;
                }
            }
            // Cache title conversion - used in both branches
            const convertedTitle = (0, helper_1.contentTitleToString)(question.title);
            // Handle questions without responses
            if (!existingResponse) {
                result.push({
                    question: {
                        ...question,
                        title: convertedTitle,
                    },
                    response: "",
                });
                continue;
            }
            // Process response with question context
            const processedResponse = this.processResponseValue(question, existingResponse.response);
            // Process answer key for date types
            const processedAnswer = this.processAnswerKey(question);
            result.push({
                ...existingResponse,
                response: processedResponse,
                question: {
                    ...question,
                    answer: processedAnswer,
                    title: convertedTitle,
                },
            });
        }
        return result;
    }
    /**
     * Process response value based on question type
     *
     */
    static processResponseValue(question, response) {
        // Get choice options if this is a choice-based question
        const choiceOptions = question[question.type];
        // Handle choice questions
        if (Array.isArray(choiceOptions) && response !== undefined) {
            if (typeof response === "number") {
                const selectedOption = choiceOptions.find((opt) => opt.idx === response);
                return {
                    key: response,
                    val: selectedOption?.content,
                };
            }
            if (Array.isArray(response)) {
                const responseSet = new Set(response);
                const selectedContents = choiceOptions
                    .filter((opt) => responseSet.has(opt.idx))
                    .map((opt) => opt.content);
                return {
                    key: response,
                    val: selectedContents,
                };
            }
            // Pass through other response types
            return response;
        }
        // Format non-choice responses
        return (0, formHelpers_1.formatResponseValue)({
            response: response,
            questionType: question.type,
        });
    }
    /**
     * Process answer key for date-type questions
     * Returns formatted answer object or original answer
     */
    static processAnswerKey(question) {
        const questionType = question.type;
        const answer = question.answer;
        if (!answer) {
            return answer;
        }
        // Handle date questions
        if (questionType === Content_model_1.QuestionType.Date) {
            return {
                ...answer,
                answer: (0, helper_1.formatDateToDDMMYYYY)(answer.answer),
            };
        }
        // Handle range date questions
        if (questionType === Content_model_1.QuestionType.RangeDate) {
            const rangeAnswer = answer.answer;
            return {
                ...answer,
                answer: {
                    start: (0, helper_1.formatDateToDDMMYYYY)(rangeAnswer?.start),
                    end: (0, helper_1.formatDateToDDMMYYYY)(rangeAnswer?.end),
                },
            };
        }
        // Return original answer for other types
        return answer;
    }
    /**
     * Check if a conditional question should be shown based on parent response
     * @param parentResponse - The response value from the parent question
     * @param requiredOptIdx - The option index required to show the conditional question
     * @returns true if question should be shown, false otherwise
     */
    static shouldShowConditionalQuestion(parentResponse, requiredOptIdx) {
        const requiredIdx = Number(requiredOptIdx);
        // Handle direct number response
        if (typeof parentResponse === "number") {
            return parentResponse === requiredIdx;
        }
        // Handle array of numbers (checkbox)
        if (Array.isArray(parentResponse)) {
            return parentResponse.includes(requiredIdx);
        }
        // Handle ResponseAnswerReturnType format
        if (typeof parentResponse === "object" &&
            parentResponse !== null &&
            "key" in parentResponse) {
            const key = parentResponse.key;
            if (typeof key === "number") {
                return key === requiredIdx;
            }
            if (Array.isArray(key)) {
                return key.includes(requiredIdx);
            }
        }
        return false;
    }
}
exports.ResponseQueryService = ResponseQueryService;
