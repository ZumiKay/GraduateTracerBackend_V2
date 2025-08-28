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
const Content_model_1 = __importDefault(require("../model/Content.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const mongoose_1 = __importStar(require("mongoose"));
class QuestionController {
    constructor() {
        this.SaveQuestion = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { data, formId, page } = req.body;
                if (!Array.isArray(data) || !formId || page === undefined) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
                }
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
                const questionIdMap = new Map();
                // Pre-generate IDs for questions that don't have them
                data.forEach((item, index) => {
                    if (!item._id) {
                        const newId = new mongoose_1.Types.ObjectId();
                        questionIdMap.set(index, newId);
                        newIds.push(newId);
                    }
                });
                //Create Condition to assign new contentID
                for (let i = 0; i < data.length; i++) {
                    const _a = data[i], { _id } = _a, rest = __rest(_a, ["_id"]);
                    const documentId = _id || questionIdMap.get(i);
                    let processedConditional = rest.conditional;
                    if (rest.conditional) {
                        processedConditional = rest.conditional
                            .map((cond) => {
                            var _a;
                            if (!cond.contentId && cond.contentIdx !== undefined) {
                                const referencedId = ((_a = data[cond.contentIdx]) === null || _a === void 0 ? void 0 : _a._id) ||
                                    questionIdMap.get(cond.contentIdx);
                                if (referencedId) {
                                    return Object.assign(Object.assign({}, cond), { contentId: referencedId, contentIdx: cond.contentIdx });
                                }
                                return cond;
                            }
                            return cond;
                        })
                            .filter((cond) => cond.contentId || cond.contentIdx !== undefined);
                    }
                    //Validate Child Question Score
                    if (rest.parentcontent && rest.score) {
                        const parent = existingContent.find((par) => {
                            var _a, _b, _c, _d;
                            return ((_a = par._id) !== null && _a !== void 0 ? _a : par.qIdx) ===
                                ((_c = (_b = rest.parentcontent) === null || _b === void 0 ? void 0 : _b.qId) !== null && _c !== void 0 ? _c : (_d = rest.parentcontent) === null || _d === void 0 ? void 0 : _d.qIdx);
                        });
                        if ((parent === null || parent === void 0 ? void 0 : parent.score) && rest.score > parent.score) {
                            return res
                                .status(400)
                                .json((0, helper_1.ReturnCode)(400, `Condition of ${parent.qIdx} has wrong score`));
                        }
                    }
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: documentId },
                            update: {
                                $set: Object.assign(Object.assign(Object.assign(Object.assign({}, rest), { conditional: processedConditional }), (page > 1 && {
                                    qIdx: existingContent[existingContent.filter((i) => i.page && i.page > 1)
                                        .length - 1].qIdx +
                                        i +
                                        1,
                                })), { // Reassign qIdx (If not Page 1)
                                    formId,
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
                        const deletedIdx = toBeDeleted
                            .map((i) => i.qIdx || 0)
                            .sort((a, b) => a - b);
                        operations.push(Content_model_1.default.deleteMany({ _id: { $in: allDeleteIds } }), Form_model_1.default.updateOne({ _id: formId }, Object.assign({ $pull: { contentIds: { $in: allDeleteIds } } }, (deletedScore && { $inc: { totalscore: -deletedScore } }))), Content_model_1.default.updateMany({ "conditional.contentId": { $in: allDeleteIds } }, { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }));
                        const remainingQuestions = existingContent.filter((item) => idsToKeep.includes(item._id));
                        for (let i = 0; i < remainingQuestions.length; i++) {
                            const item = remainingQuestions[i];
                            const currentIdx = item.qIdx || 0;
                            const deletedBeforeCurrent = deletedIdx.filter((delIdx) => delIdx < currentIdx).length;
                            if (deletedBeforeCurrent > 0) {
                                const newIdx = currentIdx - deletedBeforeCurrent;
                                operations.push(Content_model_1.default.updateOne({ _id: item._id }, { $set: { qIdx: newIdx } }));
                            }
                            //Update Condition question
                            if (item.conditional) {
                                item.conditional = item.conditional.map((cond) => {
                                    const newContentIdx = remainingQuestions.findIndex((child) => child._id.toString() === cond.contentId.toString());
                                    return Object.assign(Object.assign({}, cond), { contentIdx: newContentIdx });
                                });
                            }
                            if (item.parentcontent) {
                                item.parentcontent = Object.assign(Object.assign({}, item.parentcontent), { qIdx: remainingQuestions.findIndex((i) => { var _a; return i._id === ((_a = item.parentcontent) === null || _a === void 0 ? void 0 : _a.qId); }) });
                            }
                        }
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
                .filter((ques) => !ques.parentcontent)
                .reduce((total, { score = 0 }) => total + score, 0);
        };
        const incomingTotal = calculateTotal(incoming);
        const prevTotal = calculateTotal(prevContent);
        return incomingTotal !== prevTotal ? incomingTotal : null;
    }
}
exports.default = new QuestionController();
