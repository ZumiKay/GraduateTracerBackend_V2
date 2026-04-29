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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../utilities/helper");
const formHelpers_1 = require("../../utilities/formHelpers");
const Content_model_1 = __importDefault(require("../../model/Content.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const mongoose_1 = __importStar(require("mongoose"));
class QuestionController {
    constructor() {
        this.comparisonCache = new Map();
        this.CACHE_SIZE_LIMIT = 1000;
        /**
         * Save Question Handler
         *
         * Features:
         * - Question creation and update
         * - Conditional question processing
         * - Score calculation
         * - Automatic cleanup of deleted questions
         */
        this.SaveQuestion = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const payload = req.body;
                // Step 1: Validate request
                const validationError = this.validateSaveQuestionPayload(payload);
                if (validationError) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, validationError));
                }
                const { formId, page } = payload;
                let { data } = payload;
                // Step 2: Normalize date fields
                data = this.normalizeDateFields(data);
                // Step 3: Fetch existing content and check for changes
                const existingContent = yield this.fetchExistingContent(formId, page);
                if (this.efficientChangeDetection(existingContent, data)) {
                    this.logDev("⚡ No changes detected - skipping database operations");
                    return res.status(200).json((0, helper_1.ReturnCode)(200, "No changes detected"));
                }
                // Step 4: Generate IDs for new questions
                const { questionIdMap, newIds } = this.generateNewQuestionIds(data);
                // Step 5: Validate child question scores
                const scoreValidationError = this.validateChildQuestionScores(data, existingContent);
                if (scoreValidationError) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, scoreValidationError));
                }
                // Step 6: Build bulk operations for upsert
                const bulkOps = this.buildBulkOperations(data, questionIdMap, formId, page);
                // Step 7: Handle deletions
                const idsToKeep = this.extractIdsToKeep(data);
                const deleteResult = yield this.handleDeletions(formId, page, idsToKeep, existingContent);
                // Step 8: Execute all database operations
                yield this.executeOperations(bulkOps, newIds, formId, deleteResult.operations);
                // Step 9: Initialize totalscore
                const form = yield Form_model_1.default.findById(formId).select("totalscore");
                const isScoreChange = data.some((i) => { var _a; return i.score !== ((_a = existingContent.find((j) => j._id === i._id)) === null || _a === void 0 ? void 0 : _a.score); });
                if (isScoreChange || !(form === null || form === void 0 ? void 0 : form.totalscore)) {
                    const computedTotalScore = yield this.calculateFormTotalScore(formId);
                    yield Form_model_1.default.updateOne({ _id: formId }, { totalscore: computedTotalScore });
                }
                // Step 10: Return updated content
                const updatedContent = yield this.fetchUpdatedContent(formId, page);
                // Get cumulative question count from previous pages for proper numbering
                const lastQuestionIdx = yield (0, formHelpers_1.getLastQuestionIdx)(formId, page);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Saved successfully")), { data: (0, helper_1.AddQuestionNumbering)({
                        questions: updatedContent,
                        lastIdx: lastQuestionIdx,
                    }) }));
            }
            catch (error) {
                return this.handleSaveQuestionError(error, res);
            }
        });
    }
    // ==================== Helper Methods for SaveQuestion ====================
    /**
     * Validates the request payload for SaveQuestion
     */
    validateSaveQuestionPayload(payload) {
        const { data, formId, page } = payload;
        if (!Array.isArray(data) || !formId || page === undefined) {
            return "Invalid request payload";
        }
        return null;
    }
    /**
     * Normalizes date and rangedate fields in the data array
     */
    normalizeDateFields(data) {
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
            return Object.assign(Object.assign({}, item), { date, rangedate });
        });
    }
    /**
     * Fetches existing content from the database
     */
    fetchExistingContent(formId, page) {
        return __awaiter(this, void 0, void 0, function* () {
            return Content_model_1.default.find(Object.assign({ formId }, (page ? { page } : {})), null, {
                lean: true,
                maxTimeMS: 5000, //Max timeout (MS)
            });
        });
    }
    /**
     * Generates new ObjectIds for questions that don't have one
     */
    generateNewQuestionIds(data) {
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
    /**
     * Validates that child question scores don't exceed parent scores
     */
    validateChildQuestionScores(data, existingContent) {
        for (const item of data) {
            if (!item.parentcontent || !item.score)
                continue;
            const parent = existingContent.find((par) => {
                var _a, _b, _c;
                return (((_a = par._id) === null || _a === void 0 ? void 0 : _a.toString()) || par.qIdx) ===
                    (((_b = item.parentcontent) === null || _b === void 0 ? void 0 : _b.qId) || ((_c = item.parentcontent) === null || _c === void 0 ? void 0 : _c.qIdx));
            });
            if ((parent === null || parent === void 0 ? void 0 : parent.score) && item.score > parent.score) {
                return `Condition of ${parent.qIdx} has wrong score`;
            }
        }
        return null;
    }
    /**
     * Processes conditional references to resolve contentIdx to contentId
     */
    processConditionals(conditional, data, questionIdMap) {
        if (!conditional)
            return undefined;
        return conditional
            .map((cond) => {
            var _a;
            if (!cond.contentId && cond.contentIdx !== undefined) {
                const referencedId = ((_a = data[cond.contentIdx]) === null || _a === void 0 ? void 0 : _a._id) || questionIdMap.get(cond.contentIdx);
                if (referencedId) {
                    return Object.assign(Object.assign({}, cond), { contentId: referencedId });
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
    processParentContent(parentcontent, data, questionIdMap) {
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
                    return Object.assign(Object.assign({}, parentcontent), { qId: parentId.toString() });
                }
            }
        }
        return parentcontent;
    }
    /**
     * Builds bulk write operations for upserting questions
     */
    buildBulkOperations(data, questionIdMap, formId, page) {
        return data.map((item, index) => {
            const { _id } = item, rest = __rest(item, ["_id"]);
            const documentId = _id || questionIdMap.get(index);
            const processedConditional = this.processConditionals(rest.conditional, data, questionIdMap);
            const processedParentContent = this.processParentContent(rest.parentcontent, data, questionIdMap);
            return {
                updateOne: {
                    filter: { _id: documentId },
                    update: {
                        $set: Object.assign(Object.assign({}, rest), { conditional: processedConditional, parentcontent: processedParentContent, formId,
                            page, updatedAt: new Date() }),
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
    extractIdsToKeep(data) {
        return data
            .map((item) => item._id)
            .filter((id) => id && id.toString().length > 0);
    }
    /**
     * Handles deletion of questions that are no longer in the data
     */
    handleDeletions(formId, page, idsToKeep, existingContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const operations = [];
            const deletedIds = [];
            const toBeDeleted = yield Content_model_1.default.find({ formId, page, _id: { $nin: idsToKeep } }, { _id: 1, score: 1, conditional: 1, qIdx: 1, parentcontent: 1 }, { lean: true });
            if (toBeDeleted.length === 0) {
                return { operations, deletedIds };
            }
            // Collect all IDs to delete (including conditional children)
            const deleteIds = toBeDeleted.map(({ _id }) => _id);
            const conditionalIds = toBeDeleted
                .flatMap((item) => { var _a; return ((_a = item.conditional) === null || _a === void 0 ? void 0 : _a.map((con) => con.contentId)) || []; })
                .filter(Boolean);
            const allDeleteIds = [...deleteIds, ...conditionalIds];
            // Calculate deleted score
            const deletedScore = toBeDeleted
                .filter((i) => !i.parentcontent)
                .reduce((sum, { score = 0 }) => sum + score, 0);
            // Add delete operations
            operations.push(Content_model_1.default.deleteMany({ _id: { $in: allDeleteIds } }), Form_model_1.default.updateOne({ _id: formId }, Object.assign({ $pull: { contentIds: { $in: allDeleteIds } } }, (deletedScore && { $inc: { totalscore: -deletedScore } }))), Content_model_1.default.updateMany({ "conditional.contentId": { $in: allDeleteIds } }, { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }));
            // Update qIdx for remaining questions
            const deletedIdx = toBeDeleted
                .map((i) => i.qIdx || 0)
                .sort((a, b) => a - b);
            const qIdxUpdateOps = this.buildQIdxUpdateOperations(existingContent, idsToKeep, deletedIdx);
            operations.push(...qIdxUpdateOps);
            return { operations, deletedIds: allDeleteIds };
        });
    }
    /**
     * Builds operations to update qIdx after deletions
     */
    buildQIdxUpdateOperations(existingContent, idsToKeep, deletedIdx) {
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
    executeOperations(bulkOps, newIds, formId, deleteOperations) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield Promise.all(operations);
        });
    }
    /**
     * Updates total score if it has changed
     * Calculates the score difference for current page and applies it to form's totalscore
     */
    updateTotalScoreIfChanged(data, existingContent, formId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scoreDiff = this.calculateScoreDifference(data, existingContent);
            if (scoreDiff !== 0) {
                yield Form_model_1.default.updateOne({ _id: formId }, { $inc: { totalscore: scoreDiff } });
            }
        });
    }
    /**
     * Fetches the updated content after save
     */
    fetchUpdatedContent(formId, page) {
        return __awaiter(this, void 0, void 0, function* () {
            return Content_model_1.default.find({ formId, page }, null, {
                lean: true,
                sort: { qIdx: 1 },
            });
        });
    }
    /**
     * Handles errors from SaveQuestion
     */
    handleSaveQuestionError(error, res) {
        console.error("SaveQuestion Error:", error);
        if (error instanceof mongoose_1.default.Error.ValidationError) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Validation Error"));
        }
        if (error instanceof mongoose_1.default.Error.CastError) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid ID Format"));
        }
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
    }
    /**
     * Logs message only in development environment
     */
    logDev(message) {
        if (process.env.NODE_ENV === "DEV") {
            console.log(message);
        }
    }
    DeleteQuestion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id, formId } = req.body;
                if (!id || !formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
                }
                const tobeDelete = yield Content_model_1.default.findById(id)
                    .select("conditional score")
                    .lean();
                if (!tobeDelete) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Content not found"));
                }
                const conditionalIds = ((_a = tobeDelete.conditional) === null || _a === void 0 ? void 0 : _a.map((con) => con.contentId)) || [];
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
                yield Promise.all(operations);
                return res.status(200).json((0, helper_1.ReturnCode)(200, "Question Deleted"));
            }
            catch (error) {
                console.error("Delete Question Error:", error);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Error occurred while deleting question"));
            }
        });
    }
    GetAllQuestion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { formid, page } = req.query;
                if (!formid) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                }
                // Validate formid is a valid ObjectId
                if (!mongoose_1.Types.ObjectId.isValid(formid)) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
                }
                // Build query - if page is provided, filter by page, otherwise get all
                const query = { formId: new mongoose_1.Types.ObjectId(formid) };
                if (page !== undefined && page !== null && page !== "") {
                    const pageNum = Number(page);
                    if (!isNaN(pageNum) && pageNum > 0) {
                        query.page = pageNum;
                    }
                }
                const questions = yield Content_model_1.default.find(query)
                    .select("_id idx title type text multiple checkbox rangedate rangenumber date require page conditional parentcontent qIdx")
                    .lean()
                    .sort({ page: 1, qIdx: 1 }); // Sort by page first, then by question index
                if (process.env.NODE_ENV === "DEV") {
                    console.log("GetAllQuestion:", {
                        formid,
                        page,
                        query,
                        questionsFound: questions.length,
                    });
                }
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: questions }));
            }
            catch (error) {
                console.error("Get All Question Error:", error);
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve questions"));
            }
        });
    }
    SaveSolution(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = req.body;
                if (!data || data.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "No solution data provided"));
                }
                // Save answer key
                yield Form_model_1.default.bulkWrite(data.map((solution) => ({
                    updateOne: {
                        filter: { _id: solution._id },
                        update: { $set: { answer: solution } },
                        upsert: true,
                    },
                })));
                return res.status(200).json((0, helper_1.ReturnCode)(200, "Solution Saved"));
            }
            catch (error) {
                console.log("Save Solution", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
    }
    convertStringToDate(val) {
        const date = new Date(val);
        if (isNaN(date.getTime())) {
            return;
        }
        return date;
    }
    //Check for changed key of content
    efficientChangeDetection(existing, incoming) {
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
            const { _id } = incomingItem, incomingData = __rest(incomingItem, ["_id"]);
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
            const { _id: existingId, createdAt, updatedAt } = existingItem, existingData = __rest(existingItem, ["_id", "createdAt", "updatedAt"]);
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
    deepEqual(obj1, obj2) {
        const cacheKey = this.generateCacheKey(obj1, obj2);
        if (this.comparisonCache.has(cacheKey)) {
            return this.comparisonCache.get(cacheKey);
        }
        const result = this.performDeepEqual(obj1, obj2);
        this.cacheResult(cacheKey, result);
        return result;
    }
    generateCacheKey(obj1, obj2) {
        var _a, _b;
        try {
            const type1 = typeof obj1;
            const type2 = typeof obj2;
            const isArray1 = Array.isArray(obj1);
            const isArray2 = Array.isArray(obj2);
            return `${type1}_${type2}_${isArray1}_${isArray2}_${((_a = obj1 === null || obj1 === void 0 ? void 0 : obj1.constructor) === null || _a === void 0 ? void 0 : _a.name) || "none"}_${((_b = obj2 === null || obj2 === void 0 ? void 0 : obj2.constructor) === null || _b === void 0 ? void 0 : _b.name) || "none"}`;
        }
        catch (_c) {
            return `fallback_${Math.random()}`;
        }
    }
    cacheResult(key, result) {
        if (this.comparisonCache.size >= this.CACHE_SIZE_LIMIT) {
            const firstKey = this.comparisonCache.keys().next().value;
            if (firstKey) {
                this.comparisonCache.delete(firstKey);
            }
        }
        this.comparisonCache.set(key, result);
    }
    performDeepEqual(obj1, obj2) {
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
            catch (_a) {
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
    /**
     * Calculate the total score for a set of questions
     * Excludes conditional/child questions (parentcontent) to avoid double counting
     */
    calculateTotalScore(items) {
        return items
            .filter((ques) => !ques.parentcontent)
            .reduce((total, { score = 0 }) => total + score, 0);
    }
    /**
     * Calculate the total score for all questions in a form
     * Fetches all content from the database and calculates total
     * Excludes conditional/child questions to avoid double counting
     */
    calculateFormTotalScore(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            const allContent = yield Content_model_1.default.find({ formId, parentcontent: { $exists: false } }, { score: 1 }, { lean: true });
            return allContent.reduce((total, { score = 0 }) => total + score, 0);
        });
    }
    /**
     * Calculate the difference in score between incoming and existing content
     * @Returns the difference (positive if score increased, negative if decreased)
     */
    calculateScoreDifference(incoming, prevContent) {
        const incomingTotal = this.calculateTotalScore(incoming);
        const prevTotal = this.calculateTotalScore(prevContent);
        return incomingTotal - prevTotal;
    }
}
exports.default = new QuestionController();
