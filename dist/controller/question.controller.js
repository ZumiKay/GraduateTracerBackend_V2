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
const helper_1 = require("../utilities/helper");
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const mongoose_1 = __importStar(require("mongoose"));
class QuestionController {
    constructor() {
        this.SaveQuestion = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { data, formId, page } = req.body;
                // Validate input
                if (!Array.isArray(data) || !formId || page === undefined) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
                }
                // Extract valid IDs and get existing content in parallel
                const idsToKeep = data
                    .map((item) => item._id)
                    .filter((id) => id && id.length > 0);
                const existingContent = yield Content_model_1.default.find({ formId, page }, null, {
                    lean: true,
                    maxTimeMS: 5000,
                });
                if (yield this.efficientChangeDetection(existingContent, data)) {
                    return res.status(200).json((0, helper_1.ReturnCode)(200, "No changes detected"));
                }
                const bulkOps = [];
                const newIds = [];
                const hasConditions = data.some((item) => item.conditional);
                // Create a map to track new IDs for questions that need them
                const questionIdMap = new Map();
                // Pre-generate IDs for questions that don't have them
                data.forEach((item, index) => {
                    if (!item._id) {
                        const newId = new mongoose_1.Types.ObjectId();
                        questionIdMap.set(index, newId);
                        newIds.push(newId);
                    }
                });
                // Process data and create bulk operations
                for (let i = 0; i < data.length; i++) {
                    const _a = data[i], { _id } = _a, rest = __rest(_a, ["_id"]);
                    const documentId = _id || questionIdMap.get(i);
                    // Process conditional questions - update contentId references
                    let processedConditional = rest.conditional;
                    if (rest.conditional) {
                        processedConditional = rest.conditional
                            .map((cond) => {
                            var _a;
                            // If contentId is missing but contentIdx is provided, use the mapped ID
                            if (!cond.contentId && cond.contentIdx !== undefined) {
                                const referencedId = ((_a = data[cond.contentIdx]) === null || _a === void 0 ? void 0 : _a._id) ||
                                    questionIdMap.get(cond.contentIdx);
                                if (referencedId) {
                                    return Object.assign(Object.assign({}, cond), { contentId: referencedId, contentIdx: cond.contentIdx });
                                }
                                // If we couldn't resolve the contentIdx, keep the original condition for debugging
                                console.warn(`Could not resolve contentIdx ${cond.contentIdx} to contentId`);
                                return cond;
                            }
                            return cond;
                        })
                            .filter((cond) => cond.contentId || cond.contentIdx !== undefined);
                    }
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: documentId },
                            update: {
                                $set: Object.assign(Object.assign({}, rest), { conditional: processedConditional, formId,
                                    page, updatedAt: new Date() }),
                            },
                            upsert: true,
                            setDefaultsOnInsert: true,
                        },
                    });
                }
                const operations = [];
                // Delete unnecessary content
                if (idsToKeep.length >= 0) {
                    const toBeDeleted = yield Content_model_1.default.find({ formId, page, _id: { $nin: idsToKeep } }, { _id: 1, score: 1, conditional: 1 }, { lean: true });
                    if (toBeDeleted.length) {
                        const deleteIds = toBeDeleted.map(({ _id }) => _id);
                        const deletedScore = toBeDeleted.reduce((sum, { score = 0 }) => sum + score, 0);
                        // Get all conditional content IDs that need to be deleted
                        const conditionalIds = toBeDeleted
                            .flatMap((item) => { var _a; return ((_a = item.conditional) === null || _a === void 0 ? void 0 : _a.map((con) => con.contentId)) || []; })
                            .filter(Boolean);
                        const allDeleteIds = [...deleteIds, ...conditionalIds];
                        operations.push(Content_model_1.default.deleteMany({ _id: { $in: allDeleteIds } }), Form_model_1.default.updateOne({ _id: formId }, Object.assign({ $pull: { contentIds: { $in: allDeleteIds } } }, (deletedScore && { $inc: { totalscore: -deletedScore } }))), Content_model_1.default.updateMany({ "conditional.contentId": { $in: allDeleteIds } }, { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }));
                    }
                }
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
                if (hasConditions) {
                    const finalData = data.map((item, index) => (Object.assign(Object.assign({}, item), { _id: item._id || questionIdMap.get(index) })));
                    const handledConditionData = this.handleUpdateCondition(finalData);
                    const conditionUpdates = handledConditionData
                        .filter((newItem, index) => JSON.stringify(newItem.parentcontent) !==
                        JSON.stringify(finalData[index].parentcontent))
                        .map(({ _id, parentcontent }) => ({
                        updateOne: {
                            filter: { _id },
                            update: { $set: { parentcontent } },
                        },
                    }));
                    if (conditionUpdates.length > 0) {
                        yield Content_model_1.default.bulkWrite(conditionUpdates, { ordered: false });
                    }
                }
                const newScore = this.isScoreHasChange(data, existingContent);
                if (newScore !== null) {
                    yield Form_model_1.default.updateOne({ _id: formId }, { $set: { totalscore: newScore } });
                }
                const updatedContent = yield Content_model_1.default.find({ formId, page }, null, {
                    lean: true,
                });
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Saved successfully")), { data: updatedContent }));
            }
            catch (error) {
                console.error("SaveQuestion Error:", error);
                if (error instanceof mongoose_1.default.Error.ValidationError) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Validation Error"));
                }
                if (error instanceof mongoose_1.default.Error.CastError) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid ID Format"));
                }
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
            }
        });
        this.handleCondition = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { content, key, newContent, formId } = req.body;
                console.log("handleCondition called with:", {
                    contentId: content === null || content === void 0 ? void 0 : content.id,
                    contentIdx: content === null || content === void 0 ? void 0 : content.idx,
                    key,
                    formId,
                    hasNewContent: !!newContent,
                });
                if (!content || key === undefined || !newContent || !formId) {
                    console.error("Invalid request payload:", {
                        hasContent: !!content,
                        hasKey: key !== undefined,
                        hasNewContent: !!newContent,
                        hasFormId: !!formId,
                    });
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
                }
                // Validate ObjectId formats
                if (!mongoose_1.Types.ObjectId.isValid(content.id)) {
                    console.error("Invalid content ID format:", content.id);
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Invalid content ID format"));
                }
                if (!mongoose_1.Types.ObjectId.isValid(formId)) {
                    console.error("Invalid form ID format:", formId);
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
                }
                // First, validate that the parent question supports conditions
                const parentQuestion = yield Content_model_1.default.findById(content.id);
                if (!parentQuestion) {
                    console.error("Parent question not found:", content.id);
                    return res
                        .status(404)
                        .json((0, helper_1.ReturnCode)(404, "Parent question not found"));
                }
                console.log("Parent question found:", {
                    id: parentQuestion._id,
                    type: parentQuestion.type,
                    hasParentContent: !!parentQuestion.parentcontent,
                    parentContent: parentQuestion.parentcontent,
                });
                // Additional validation: Check if the parent question itself is a conditional question
                // This helps prevent deep nesting issues and circular references
                if (parentQuestion.parentcontent) {
                    console.log("Warning: Adding condition to a question that already has a parent. This creates nested conditions.");
                }
                // Check if parent question type supports conditions
                const allowedTypes = [Content_model_1.QuestionType.CheckBox, Content_model_1.QuestionType.MultipleChoice];
                if (!allowedTypes.includes(parentQuestion.type)) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, `Condition questions are only allowed for checkbox and multiple choice questions. Current type: ${parentQuestion.type}`));
                }
                // Validate that the key corresponds to a valid option
                const options = parentQuestion.type === Content_model_1.QuestionType.MultipleChoice
                    ? parentQuestion.multiple
                    : parentQuestion.checkbox;
                if (!options || options.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Parent question has no options defined"));
                }
                const optionExists = options.some((option) => option.idx === key);
                if (!optionExists) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, `Invalid option key: ${key}. Option does not exist.`));
                }
                // Check if condition already exists for this key
                const existingCondition = (_a = parentQuestion.conditional) === null || _a === void 0 ? void 0 : _a.some((cond) => cond.key === key);
                if (existingCondition) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, `Condition already exists for option key: ${key}`));
                }
                const newContentId = new mongoose_1.Types.ObjectId();
                console.log("Creating new conditional content with ID:", newContentId.toString());
                try {
                    // Ensure formId is properly converted to ObjectId
                    const formObjectId = new mongoose_1.Types.ObjectId(formId);
                    // Perform operations in parallel
                    const [newContentCreated, updateResult] = yield Promise.all([
                        Content_model_1.default.create(Object.assign(Object.assign({}, newContent), { _id: newContentId, formId: formObjectId, conditional: [], parentcontent: {
                                qIdx: content.idx, // This is the frontend array index for reference
                                optIdx: key,
                                qId: content.id, // This is the actual MongoDB ObjectId of the parent question
                            } })),
                        Content_model_1.default.updateOne({ _id: content.id }, {
                            $push: {
                                conditional: {
                                    key,
                                    contentId: newContentId,
                                    contentIdx: content.idx, // Include contentIdx for reference
                                },
                            },
                        }),
                        Form_model_1.default.updateOne({ _id: formObjectId }, { $push: { contentIds: newContentId } }),
                    ]);
                    console.log("Database operations completed:", {
                        newContentCreated: !!newContentCreated,
                        updateResultModified: updateResult.modifiedCount,
                    });
                    if (!updateResult.modifiedCount) {
                        console.error("Failed to update parent question with conditional");
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Content not found"));
                    }
                    console.log("Condition created successfully:", newContentCreated._id);
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Condition created successfully")), { data: newContentCreated._id }));
                }
                catch (dbError) {
                    console.error("Database operation error:", {
                        error: dbError instanceof Error ? dbError.message : dbError,
                        stack: dbError instanceof Error ? dbError.stack : undefined,
                        newContentData: Object.assign(Object.assign({}, newContent), { _id: newContentId, formId, conditional: [], parentcontent: {
                                qIdx: content.idx,
                                optIdx: key,
                                qId: content.id,
                            } }),
                    });
                    throw dbError; // Re-throw to be caught by outer catch block
                }
            }
            catch (error) {
                console.error("Add Condition Error:", {
                    error: error instanceof Error ? error.message : error,
                    stack: error instanceof Error ? error.stack : undefined,
                    body: req.body,
                });
                return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
            }
        });
        this.removeCondition = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { formId, contentId } = req.body;
                if (!formId || !contentId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
                }
                // Remove the conditional content and update parent
                const [deleteResult] = yield Promise.all([
                    Content_model_1.default.deleteOne({ _id: contentId }),
                    Content_model_1.default.updateMany({ "conditional.contentId": contentId }, { $pull: { conditional: { contentId } } }),
                    Form_model_1.default.updateOne({ _id: formId }, { $pull: { contentIds: contentId } }),
                ]);
                if (!deleteResult.deletedCount) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Content not found"));
                }
                return res.status(200).json((0, helper_1.ReturnCode)(200, "Condition removed"));
            }
            catch (error) {
                console.log("Remove Condition", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
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
                // Perform all operations in parallel
                const operations = [
                    Content_model_1.default.deleteOne({ _id: id }),
                    Form_model_1.default.updateOne({ _id: formId }, {
                        $pull: { contentIds: id },
                        $inc: { totalscore: -(tobeDelete.score || 0) },
                    }),
                ];
                // Remove references to this content in other conditionals
                operations.push(Content_model_1.default.updateMany({ "conditional.contentId": id }, { $pull: { conditional: { contentId: id } } }));
                // Delete conditional questions if they exist
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
                const query = page !== undefined ? { formId: formid, page } : { formId: formid };
                const questions = yield Content_model_1.default.find(query).lean();
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: questions }));
            }
            catch (error) {
                console.log("Get All Question", error);
                return res.status(500).json((0, helper_1.ReturnCode)(500));
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
    efficientChangeDetection(existing, incoming) {
        return __awaiter(this, void 0, void 0, function* () {
            if (existing.length !== incoming.length)
                return false;
            const existingMap = new Map(existing.map((item) => [item._id.toString(), item]));
            return incoming.every((item) => {
                if (!item._id)
                    return false;
                const existingItem = existingMap.get(item._id.toString());
                if (!existingItem)
                    return false;
                const { _id, updatedAt } = existingItem, existingData = __rest(existingItem, ["_id", "updatedAt"]);
                const { _id: incomingId } = item, incomingData = __rest(item, ["_id"]);
                return JSON.stringify(existingData) === JSON.stringify(incomingData);
            });
        });
    }
    isScoreHasChange(incoming, prevContent) {
        const calculateTotal = (items) => {
            const seen = new Set();
            return items
                .filter((item) => {
                var _a;
                const key = ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || "";
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            })
                .reduce((total, { score = 0 }) => total + score, 0);
        };
        const incomingTotal = calculateTotal(incoming);
        const prevTotal = calculateTotal(prevContent);
        return incomingTotal !== prevTotal ? incomingTotal : null;
    }
    handleUpdateCondition(data) {
        if (!data || data.length === 0)
            return data;
        // Create a map for quick lookup of questions by index
        const dataMap = new Map();
        data.forEach((q, idx) => {
            if (q.conditional) {
                q.conditional.forEach((cond) => {
                    var _a;
                    if (cond.contentIdx !== undefined) {
                        dataMap.set(cond.contentIdx, (_a = data[cond.contentIdx]) === null || _a === void 0 ? void 0 : _a._id);
                    }
                });
            }
        });
        // First pass: Update conditional contentIds
        const updatedData = data.map((question) => {
            if (!question.conditional)
                return question;
            return Object.assign(Object.assign({}, question), { conditional: question.conditional.map((cond) => (Object.assign(Object.assign({}, cond), { contentId: dataMap.get(cond.contentIdx) || cond.contentId, contentIdx: undefined }))) });
        });
        // Create a parent mapping
        const parentMap = new Map();
        updatedData.forEach((q) => {
            if (q.conditional) {
                q.conditional.forEach((cond) => {
                    if (cond.contentId) {
                        parentMap.set(cond.contentId, q._id);
                    }
                });
            }
        });
        // Second pass: Update parentcontent
        return updatedData.map((question) => {
            if (!question._id)
                return question;
            const parentId = parentMap.get(question._id);
            return parentId
                ? Object.assign(Object.assign({}, question), { parentcontent: Object.assign(Object.assign({}, (question.parentcontent || {})), { qId: parentId }) }) : question;
        });
    }
}
exports.default = new QuestionController();
