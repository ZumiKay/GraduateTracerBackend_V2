"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionService = void 0;
const mongoose_1 = require("mongoose");
const Content_model_1 = __importDefault(require("../model/Content.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const helper_1 = require("../utilities/helper");
const formHelpers_1 = require("../utilities/formHelpers");
const FormValidationService_1 = require("./FormValidationService");
class QuestionService {
    static comparisonCache = new Map();
    static CACHE_SIZE_LIMIT = 1000;
    /**
     * Save Question
     *
     * Features:
     * - Question creation and update
     * - Conditional question processing
     * - Score calculation
     * - Automatic cleanup of deleted questions
     */
    static async saveQuestion(payload) {
        // Step 1: Validate request
        const validationError = this.validateSaveQuestionPayload(payload);
        if (validationError) {
            return { success: false, statusCode: 400, message: validationError };
        }
        // Step 1.1: Content validity verify
        const isValidContents = payload.data.flatMap((c) => {
            const typeErrors = FormValidationService_1.formValidationErrorByContentTypes[c.type]
                ? FormValidationService_1.formValidationErrorByContentTypes[c.type](c)
                : [];
            const hasIssueError = Array.isArray(c.validationIssues) &&
                c.validationIssues.some((i) => i.type === "error" || !i.type);
            return hasIssueError
                ? [...typeErrors, "Validation issue present"]
                : typeErrors;
        });
        if (isValidContents.length > 0) {
            return { success: false, statusCode: 400, message: "Validation error" };
        }
        // Step 1.2: Nesting depth check (max 20 levels)
        const depthError = (0, helper_1.validateNestingDepth)(payload.data, helper_1.MAX_QUESTION_DEPTH);
        if (depthError) {
            return { success: false, statusCode: 400, message: depthError };
        }
        const { formId, page, title } = payload;
        let { data } = payload;
        // Step 2: Normalize date fields
        data = this.normalizeDateFields(data);
        // Step 3: Fetch existing content and check for changes
        const existingContent = await this.fetchExistingContent(formId, page);
        if (this.efficientChangeDetection(existingContent, data)) {
            if (title)
                await Form_model_1.default.updateOne({ _id: formId }, { title });
            return { success: true, noChanges: true, message: "No changes detected" };
        }
        // Step 4: Generate IDs for new questions
        const { questionIdMap, newIds } = this.generateNewQuestionIds(data);
        // Step 5: Validate child question scores
        const scoreValidationError = this.validateChildQuestionScores(data, existingContent);
        if (scoreValidationError) {
            return {
                success: false,
                statusCode: 400,
                message: "Score Validation Error",
            };
        }
        // Step 6: Build bulk operations for upsert
        const bulkOps = this.buildBulkOperations(data, questionIdMap, formId, page, existingContent);
        // Step 7: Handle deletions
        const idsToKeep = this.extractIdsToKeep(data);
        const deleteResult = await this.handleDeletions(formId, page, idsToKeep, existingContent);
        // Step 8: Execute all database operations
        await this.executeOperations(bulkOps, newIds, formId, deleteResult.operations);
        // Step 9: Initialize totalscore
        const form = await Form_model_1.default.findById(formId).select("totalscore");
        const isScoreChange = data.some((i) => i.score !==
            existingContent.find((j) => j._id?.toString() === i._id?.toString() || j._id === i._id)?.score);
        const isBonusChange = data.some((i) => i.isBonusScore !==
            existingContent.find((j) => j._id?.toString() === i._id?.toString() || j._id === i._id)?.isBonusScore ||
            i.useChildScoreSum !==
                existingContent.find((j) => j._id?.toString() === i._id?.toString() || j._id === i._id)?.useChildScoreSum);
        if (isScoreChange || isBonusChange || !form?.totalscore) {
            const { totalscore, extraScore } = await this.calculateFormTotalScore(formId);
            await Form_model_1.default.updateOne({ _id: formId }, { totalscore, extraScore, ...(title ? { title } : {}) });
        }
        else if (title) {
            await Form_model_1.default.updateOne({ _id: formId }, { title });
        }
        // Step 10: Return updated content
        const updatedContent = await this.fetchUpdatedContent(formId, page);
        // Get cumulative question count from previous pages for proper numbering
        const lastQuestionIdx = await (0, formHelpers_1.getLastQuestionIdx)(formId, page);
        return {
            success: true,
            data: (0, helper_1.AddQuestionNumbering)({
                questions: updatedContent,
                lastIdx: lastQuestionIdx,
            }),
            message: "Saved Completed",
        };
    }
    /**
     * Delete Question
     */
    static async deleteQuestion(id, formId) {
        if (!id || !formId) {
            return {
                success: false,
                statusCode: 400,
                message: "Invalid request payload",
            };
        }
        const tobeDelete = await Content_model_1.default.findById(id)
            .select("conditional score")
            .lean();
        if (!tobeDelete) {
            return { success: false, statusCode: 400, message: "Content not found" };
        }
        const conditionalIds = tobeDelete.conditional?.map((con) => con.contentId) || [];
        const operations = [
            Content_model_1.default.deleteOne({ _id: id }),
            Form_model_1.default.updateOne({ _id: formId }, {
                $pull: { contentIds: id },
                $inc: { totalscore: -(tobeDelete.score || 0) },
            }),
        ];
        operations.push(Content_model_1.default.updateMany({ "conditional.contentId": id }, { $pull: { conditional: { contentId: id } } }));
        if (conditionalIds.length > 0) {
            operations.push(Content_model_1.default.deleteMany({ _id: { $in: conditionalIds } }), Form_model_1.default.updateOne({ _id: formId }, { $pull: { contentIds: { $in: conditionalIds } } }));
        }
        await Promise.all(operations);
        return { success: true, message: "Question Deleted" };
    }
    /**
     * Save Solution
     */
    static async saveSolution(data) {
        if (!data || data.length === 0) {
            return {
                success: false,
                statusCode: 400,
                message: "No solution data provided",
            };
        }
        // Save answer key
        await Form_model_1.default.bulkWrite(data.map((solution) => ({
            updateOne: {
                filter: { _id: solution._id },
                update: { $set: { answer: solution } },
                upsert: true,
            },
        })));
        return { success: true, message: "Solution Saved" };
    }
    /**
     * Validates the request payload for SaveQuestion
     */
    static validateSaveQuestionPayload(payload) {
        const { data, formId, page } = payload;
        if (!Array.isArray(data) || !formId || page === undefined) {
            return "Invalid request payload";
        }
        return null;
    }
    /**
     * Normalizes date and rangedate fields in the data array
     */
    static normalizeDateFields(data) {
        if (!data.some((i) => i.date || i.rangedate)) {
            return data;
        }
        return data.map((item) => {
            const date = item.date
                ? this.convertStringToDate(String(item.date))
                : undefined;
            let rangedate;
            if (item.rangedate) {
                const start = this.convertStringToDate(String(item.rangedate.start));
                const end = this.convertStringToDate(String(item.rangedate.end));
                if (start && end) {
                    rangedate = { start, end };
                }
            }
            return { ...item, date, rangedate };
        });
    }
    /**
     * Fetches existing content from the database
     */
    static async fetchExistingContent(formId, page) {
        return Content_model_1.default.find({ formId, ...(page ? { page } : {}) }, null, {
            lean: true,
            maxTimeMS: 5000, //Max timeout (MS)
        });
    }
    /**
     * Generates new ObjectIds for questions that don't have one
     */
    static generateNewQuestionIds(data) {
        const questionIdMap = new Map();
        const newIds = [];
        data.forEach((item, index) => {
            if (!item._id) {
                const newId = new mongoose_1.Types.ObjectId();
                questionIdMap.set(index, newId);
                newIds.push(newId);
            }
        });
        return { questionIdMap, newIds };
    }
    static validateChildQuestionScores(data, existingContent) {
        const combinedByKey = new Map();
        for (const item of existingContent) {
            const key = item._id ? item._id.toString() : item.qIdx;
            if (key !== undefined)
                combinedByKey.set(key, item);
        }
        for (const item of data) {
            if (item._id)
                combinedByKey.set(item._id.toString(), item);
            if (item.qIdx !== undefined)
                combinedByKey.set(item.qIdx, item);
        }
        for (const item of data) {
            if (item.score && item.conditional?.length) {
                if (!item.isBonusScore) {
                    if (item.useChildScoreSum) {
                        const childScoreSum = data.reduce((sum, child) => {
                            const isChild = item.conditional?.find((c) => (c.contentId &&
                                c.contentId.toString() === child._id?.toString()) ||
                                (c.contentIdx !== undefined && c.contentIdx === child.qIdx));
                            return isChild ? sum + (child.score ?? 0) : sum;
                        }, 0);
                        if (childScoreSum !== item.score) {
                            return `Sum of children scores (${childScoreSum}) of question ${item.qIdx} must equal parent score (${item.score})`;
                        }
                    }
                    else {
                        const isWrongScore = data.some((child) => item.conditional?.find((c) => (c.contentId &&
                            c.contentId.toString() === child._id?.toString()) ||
                            (c.contentIdx !== undefined && c.contentIdx === child.qIdx)) &&
                            child.score &&
                            item.score &&
                            child.score > item.score);
                        if (isWrongScore) {
                            return `Children scores of question ${item.qIdx} must not exceed parent score`;
                        }
                    }
                }
            }
            if (item.parentcontent && item.score) {
                const parentKey = item.parentcontent.qId || item.parentcontent.qIdx;
                if (parentKey !== undefined) {
                    const parent = combinedByKey.get(parentKey);
                    // Bonus parents allow any child score; non-bonus parents cap individual child scores (unless sum mode)
                    if (!parent?.isBonusScore &&
                        !parent?.useChildScoreSum &&
                        parent?.score &&
                        item.score > parent.score) {
                        return `Condition of ${parent.qIdx} has wrong score`;
                    }
                }
            }
        }
        return null;
    }
    /**
     * Processes conditional references to resolve contentIdx to contentId
     */
    static processConditionals(conditional, data, questionIdMap) {
        if (!conditional)
            return undefined;
        return conditional
            .map((cond) => {
            if (!cond.contentId && cond.contentIdx !== undefined) {
                const referencedId = data[cond.contentIdx]?._id || questionIdMap.get(cond.contentIdx);
                if (referencedId) {
                    return { ...cond, contentId: referencedId };
                }
            }
            return cond;
        })
            .filter((cond) => cond.contentId || cond.contentIdx !== undefined);
    }
    /**
     * Processes parentcontent to resolve qIdx to qId (parent's _id)
     * This ensures child questions have a reference to the parent's actual database ID
     */
    static processParentContent(parentcontent, data, questionIdMap) {
        if (!parentcontent)
            return undefined;
        // If qId already exists and is valid, return as-is
        if (parentcontent.qId && parentcontent.qId.length > 0) {
            return parentcontent;
        }
        // If qIdx exists, resolve it to the parent's _id
        if (parentcontent.qIdx !== undefined) {
            // Find the parent question by qIdx
            const parentIndex = data.findIndex((q) => q.qIdx === parentcontent.qIdx);
            if (parentIndex !== -1) {
                const parentQuestion = data[parentIndex];
                // Get parent's _id (either existing or newly generated)
                const parentId = parentQuestion._id || questionIdMap.get(parentIndex);
                if (parentId) {
                    return {
                        ...parentcontent,
                        qId: parentId.toString(),
                    };
                }
            }
        }
        return parentcontent;
    }
    /**
     * Builds bulk write operations for upserting questions
     */
    static buildBulkOperations(data, questionIdMap, formId, page, existingContent = []) {
        const existingMap = new Map();
        let maxQIdx = -1;
        for (const eq of existingContent) {
            if (eq._id) {
                existingMap.set(eq._id.toString(), eq);
            }
            if (typeof eq.qIdx === "number" && eq.qIdx > maxQIdx) {
                maxQIdx = eq.qIdx;
            }
        }
        for (const item of data) {
            if (typeof item.qIdx === "number" && item.qIdx > maxQIdx) {
                maxQIdx = item.qIdx;
            }
        }
        return data.map((item, index) => {
            const { _id, ...rest } = item;
            const documentId = _id || questionIdMap.get(index);
            const existingItem = _id ? existingMap.get(_id.toString()) : undefined;
            let qIdx;
            if (typeof item.qIdx === "number") {
                qIdx = item.qIdx;
            }
            else if (existingItem && typeof existingItem.qIdx === "number") {
                qIdx = existingItem.qIdx;
            }
            else {
                maxQIdx += 1;
                qIdx = maxQIdx;
            }
            const processedConditional = this.processConditionals(rest.conditional, data, questionIdMap);
            const processedParentContent = this.processParentContent(rest.parentcontent, data, questionIdMap);
            return {
                updateOne: {
                    filter: { _id: documentId },
                    update: {
                        $set: {
                            ...rest,
                            qIdx,
                            conditional: processedConditional,
                            parentcontent: processedParentContent,
                            formId,
                            page,
                            updatedAt: new Date(),
                        },
                    },
                    upsert: true,
                    setDefaultsOnInsert: true,
                },
            };
        });
    }
    /**
     * Extracts IDs of questions to keep (not delete)
     */
    static extractIdsToKeep(data) {
        return data
            .map((item) => item._id)
            .filter((id) => id && id.toString().length > 0);
    }
    /**
     * Handles deletion of questions that are no longer in the data
     */
    static async handleDeletions(formId, page, idsToKeep, existingContent) {
        const operations = [];
        const deletedIds = [];
        const toBeDeleted = await Content_model_1.default.find({ formId, page, _id: { $nin: idsToKeep } }, { _id: 1, score: 1, conditional: 1, qIdx: 1, parentcontent: 1 }, { lean: true });
        if (toBeDeleted.length === 0) {
            return { operations, deletedIds };
        }
        // Collect all IDs to delete (including conditional children)
        const deleteIds = toBeDeleted.map(({ _id }) => _id);
        const conditionalIds = toBeDeleted
            .flatMap((item) => item.conditional?.map((con) => con.contentId) || [])
            .filter(Boolean);
        const allDeleteIds = [...deleteIds, ...conditionalIds];
        // Calculate deleted score
        const deletedScore = toBeDeleted
            .filter((i) => !i.parentcontent)
            .reduce((sum, { score = 0 }) => sum + score, 0);
        // Add delete operations
        operations.push(Content_model_1.default.deleteMany({ _id: { $in: allDeleteIds } }), Form_model_1.default.updateOne({ _id: formId }, {
            $pull: { contentIds: { $in: allDeleteIds } },
            ...(deletedScore && { $inc: { totalscore: -deletedScore } }),
        }), Content_model_1.default.updateMany({ "conditional.contentId": { $in: allDeleteIds } }, { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }));
        // Update qIdx for remaining questions
        const deletedIdx = toBeDeleted
            .map((i) => i.qIdx || 0)
            .sort((a, b) => a - b);
        const qIdxUpdateOps = this.buildQIdxUpdateOperations(existingContent, idsToKeep, deletedIdx);
        operations.push(...qIdxUpdateOps);
        return { operations, deletedIds: allDeleteIds };
    }
    /**
     * Builds operations to update qIdx after deletions
     */
    static buildQIdxUpdateOperations(existingContent, idsToKeep, deletedIdx) {
        const operations = [];
        const remainingQuestions = existingContent.filter((item) => item._id && idsToKeep.includes(item._id));
        for (const item of remainingQuestions) {
            const currentIdx = item.qIdx || 0;
            const deletedBeforeCurrent = deletedIdx.filter((delIdx) => delIdx < currentIdx).length;
            if (deletedBeforeCurrent > 0) {
                const newIdx = currentIdx - deletedBeforeCurrent;
                operations.push(Content_model_1.default.updateOne({ _id: item._id }, { $set: { qIdx: newIdx } }));
            }
        }
        return operations;
    }
    /**
     * Executes all database operations in parallel
     */
    static async executeOperations(bulkOps, newIds, formId, deleteOperations) {
        const operations = [...deleteOperations];
        if (bulkOps.length > 0) {
            operations.push(Content_model_1.default.bulkWrite(bulkOps, { ordered: false }));
        }
        if (newIds.length > 0) {
            operations.push(Form_model_1.default.updateOne({ _id: formId }, {
                $addToSet: { contentIds: { $each: newIds } },
                $set: { updatedAt: new Date() },
            }));
        }
        await Promise.all(operations);
    }
    static async fetchUpdatedContent(formId, page) {
        return Content_model_1.default.find({ formId, page }, null, {
            lean: true,
            sort: { qIdx: 1 },
        });
    }
    static convertStringToDate(val) {
        const date = new Date(val);
        if (isNaN(date.getTime())) {
            return;
        }
        return date;
    }
    // Check for changed key of content
    static efficientChangeDetection(existing, incoming) {
        if (existing.length !== incoming.length) {
            if (process.env.NODE_ENV === "DEV") {
                console.log("⚡ Length difference detected:", existing.length, "vs", incoming.length);
            }
            return false; // Changes detected
        }
        if (existing.length === 0)
            return true;
        const existingMap = new Map();
        for (const item of existing) {
            if (item._id) {
                existingMap.set(item._id.toString(), item);
            }
        }
        for (const incomingItem of incoming) {
            const { _id, ...incomingData } = incomingItem;
            if (!_id) {
                if (process.env.NODE_ENV === "DEV") {
                    console.log("⚡ New item detected without ID");
                }
                return false;
            }
            const existingItem = existingMap.get(_id.toString());
            if (!existingItem) {
                if (process.env.NODE_ENV === "DEV") {
                    console.log("⚡ Item not found in existing:", _id.toString());
                }
                return false;
            }
            const { _id: existingId, createdAt, updatedAt, ...existingData } = existingItem;
            if (!this.deepEqual(existingData, incomingData)) {
                return false;
            }
        }
        // No changes detected
        if (process.env.NODE_ENV === "DEV") {
            console.log("⚡ No changes detected in", existing.length, "items");
        }
        return true;
    }
    static deepEqual(obj1, obj2) {
        const cacheKey = this.generateCacheKey(obj1, obj2);
        if (this.comparisonCache.has(cacheKey)) {
            return this.comparisonCache.get(cacheKey);
        }
        const result = this.performDeepEqual(obj1, obj2);
        this.cacheResult(cacheKey, result);
        return result;
    }
    static generateCacheKey(obj1, obj2) {
        try {
            return JSON.stringify([obj1, obj2]);
        }
        catch {
            return `fallback_${Math.random()}`;
        }
    }
    static cacheResult(key, result) {
        if (this.comparisonCache.size >= this.CACHE_SIZE_LIMIT) {
            const firstKey = this.comparisonCache.keys().next().value;
            if (firstKey) {
                this.comparisonCache.delete(firstKey);
            }
        }
        this.comparisonCache.set(key, result);
    }
    static performDeepEqual(obj1, obj2) {
        if (obj1 === obj2)
            return true;
        if (obj1 == null || obj2 == null) {
            return obj1 === obj2;
        }
        if (typeof obj1 !== typeof obj2) {
            return false;
        }
        if (typeof obj1 !== "object") {
            return obj1 === obj2;
        }
        if (obj1 instanceof Date && obj2 instanceof Date) {
            return obj1.getTime() === obj2.getTime();
        }
        if (obj1 instanceof Date || obj2 instanceof Date) {
            return false;
        }
        if (Array.isArray(obj1) !== Array.isArray(obj2)) {
            return false;
        }
        if (Array.isArray(obj1)) {
            if (obj1.length !== obj2.length)
                return false;
            for (let i = 0; i < obj1.length; i++) {
                if (!this.performDeepEqual(obj1[i], obj2[i])) {
                    return false;
                }
            }
            return true;
        }
        if (obj1.toString &&
            obj2.toString &&
            typeof obj1.toString === "function" &&
            typeof obj2.toString === "function") {
            try {
                const str1 = obj1.toString();
                const str2 = obj2.toString();
                if (str1.length === 24 && str2.length === 24) {
                    return str1 === str2;
                }
            }
            catch {
                // Not ObjectIds, continue with regular comparison
            }
        }
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) {
            return false;
        }
        for (const key of keys1) {
            if (!keys2.includes(key)) {
                return false;
            }
            if (!this.performDeepEqual(obj1[key], obj2[key])) {
                return false;
            }
        }
        return true;
    }
    static async calculateFormTotalScore(formId) {
        const allContent = await Content_model_1.default.find({ formId, parentcontent: { $exists: false } }, { score: 1, isBonusScore: 1 }, { lean: true });
        let totalscore = 0;
        let extraScore = 0;
        for (const { score = 0, isBonusScore } of allContent) {
            if (isBonusScore)
                extraScore += score;
            else
                totalscore += score;
        }
        return { totalscore, extraScore };
    }
}
exports.QuestionService = QuestionService;
exports.default = QuestionService;
