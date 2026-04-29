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
exports.GetFilterForm = GetFilterForm;
exports.ValidateFormBeforeAction = ValidateFormBeforeAction;
const helper_1 = require("../../utilities/helper");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../../services/SolutionValidationService"));
const User_model_1 = __importDefault(require("../../model/User.model"));
const formHelpers_1 = require("../../utilities/formHelpers");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
function GetFilterForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { ty, q, page = "1", limit = "5", tab, created, updated, } = req.query;
            if (tab && !Object.values(Form_model_1.DashboardTabType).includes(tab)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid type or query"));
            }
            const p = Number(page);
            const lt = Math.min(Number(limit), 50);
            const createdAt = created ? parseInt(created) : undefined;
            const updatedAt = updated ? parseInt(updated) : undefined;
            const requiresQuery = [
                "detail",
                "solution",
                "setting",
                "search",
                "type",
                "preview",
                "total",
                "response",
                "analytics",
                "user",
            ];
            if (ty && !requiresQuery.includes(ty)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query"));
            }
            const user = req.user;
            if (!user)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            // Handle different query types with optimized logic
            switch (ty) {
                case "detail":
                case "solution":
                    return yield handleDetailQuery(res, ty, q, p, new mongoose_1.Types.ObjectId(user === null || user === void 0 ? void 0 : user.sub), Number(page !== null && page !== void 0 ? page : "1"));
                case "response":
                case "analytics":
                    return yield handleShortFormInfo({
                        res,
                        id: q,
                        userId: new mongoose_1.Types.ObjectId(user === null || user === void 0 ? void 0 : user.sub),
                    });
                case "total":
                    return yield handleTotalQuery(res, q, user);
                case "setting":
                    return yield handleSettingQuery(res, q, user);
                case "user":
                    if ((createdAt && ![1, -1].includes(createdAt)) ||
                        (updatedAt && ![1, -1].includes(updatedAt))) {
                        return res
                            .status(400)
                            .json((0, helper_1.ReturnCode)(400, "Sort values must be 1 or -1"));
                    }
                    const userTab = tab || Form_model_1.DashboardTabType.myform;
                    return yield handleUserQuery({
                        p,
                        lt,
                        userId: new mongoose_1.Types.ObjectId(user === null || user === void 0 ? void 0 : user.sub),
                        tab: userTab,
                        res,
                        filter: {
                            query: q,
                            sort: createdAt || updatedAt
                                ? {
                                    createdAt,
                                    updatedAt,
                                }
                                : undefined,
                        },
                    });
                default:
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
        }
        catch (error) {
            console.error("Error in GetFilterForm:", error instanceof Error ? error.message : error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function handleShortFormInfo(_a) {
    return __awaiter(this, arguments, void 0, function* ({ res, userId, id, }) {
        if (!id || !(0, formHelpers_1.isValidObjectIdString)(id)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        }
        const form = yield Form_model_1.default.findById(id)
            .select("_id title type totalpage user owners editors setting.email")
            .lean()
            .exec();
        if (!form) {
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        }
        const isHasAccess = (0, formHelpers_1.validateAccess)(form, userId);
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ _id: form._id, title: form.title, type: form.type, totalpage: form.totalpage, setting: form.setting }, isHasAccess) }));
    });
}
function handleDetailQuery(res, ty, q, p, user, page) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        const query = (0, formHelpers_1.isValidObjectIdString)(q) ? { _id: q } : { title: q };
        const detailForm = yield Form_model_1.default.findOne(query)
            .select(formHelpers_1.projections.detail)
            .lean()
            .exec();
        if (!detailForm)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "No Form Found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(detailForm, user);
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        const contentProjection = ty === "solution"
            ? `${Content_model_1.DetailContentSelection} answer score hasAnswer isValidated`
            : Content_model_1.DetailContentSelection;
        let validationSummary = null;
        if (ty === "solution") {
            try {
                validationSummary = yield SolutionValidationService_1.default.validateForm(q);
            }
            catch (error) {
                console.error("Validation error:", error);
            }
        }
        const resultContent = yield Content_model_1.default.find({
            _id: { $in: detailForm.contentIds },
            page: p,
        })
            .select(contentProjection)
            .sort({ qIdx: 1 })
            .lean()
            .exec();
        // Get cumulative question count from previous pages for proper numbering
        const lastQuestionIdx = yield (0, formHelpers_1.getLastQuestionIdx)(q, p);
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign(Object.assign(Object.assign({}, detailForm), { owners: undefined, editors: undefined, user: undefined, contents: (0, helper_1.AddQuestionNumbering)({
                    questions: resultContent,
                    lastIdx: lastQuestionIdx,
                }), contentIds: undefined, validationSummary }), accessInfo), (page &&
                page > 1 && {
                lastqIdx: lastQuestionIdx,
            })) }));
    });
}
/**
 * Fetch Summary of Form
 * - Total Question
 * - Total Score
 * - Total Page
 */
function handleTotalQuery(res, q, user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!(0, formHelpers_1.isValidObjectIdString)(q))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        const formdata = yield Form_model_1.default.findById(q)
            .select(formHelpers_1.projections.total)
            .populate({ path: "user", select: "email", options: { lean: true } })
            .lean()
            .exec();
        if (!formdata)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(formdata, new mongoose_1.Types.ObjectId(user.sub));
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        const contentStats = yield Content_model_1.default.aggregate([
            { $match: { formId: formdata._id } },
            {
                $group: {
                    _id: null,
                    totalQuestions: { $sum: 1 },
                    totalScore: {
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
                },
            },
        ]);
        const stats = contentStats[0] || { totalQuestions: 0, totalScore: 0 };
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ totalpage: (_a = formdata.totalpage) !== null && _a !== void 0 ? _a : 0, totalscore: stats.totalScore, totalquestion: stats.totalQuestions }, accessInfo) }));
    });
}
function handleSettingQuery(res, q, user) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!(0, formHelpers_1.isValidObjectIdString)(q))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        const form = yield Form_model_1.default.findById(q)
            .select(formHelpers_1.projections.setting)
            .populate({ path: "user", select: "email", options: { lean: true } })
            .lean()
            .exec();
        if (!form)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(form, new mongoose_1.Types.ObjectId(user.sub));
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ _id: form._id, title: form.title, type: form.type, setting: form.setting }, accessInfo) }));
    });
}
function handleUserQuery(_a) {
    return __awaiter(this, arguments, void 0, function* ({ p, userId, tab, res, lt, filter, }) {
        var _b;
        try {
            // Validate input parameters
            if (!userId || !tab || p < 1 || lt < 1) {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            const baseQuery = yield buildBaseQuery(tab, userId);
            const filterQuery = buildFilterQuery(filter);
            const finalQuery = Object.assign(Object.assign({}, baseQuery), filterQuery);
            const sortOptions = buildSortOptions(filter);
            //Flag Filled Form - Check for all tabs to properly identify filled forms
            const filledFormIds = [];
            const user = yield User_model_1.default.findById(userId).select("email").lean();
            const filledForms = yield Response_model_1.default.find({
                userId: userId,
                respondentEmail: user === null || user === void 0 ? void 0 : user.email,
            })
                .select("formId")
                .lean();
            filledFormIds.push(...filledForms.map((i) => i.formId.toString()));
            const [results] = yield Form_model_1.default.aggregate([
                { $match: finalQuery },
                {
                    $facet: {
                        totalCount: [{ $count: "count" }],
                        data: [
                            { $sort: sortOptions },
                            { $skip: (p - 1) * lt },
                            { $limit: lt },
                            {
                                $project: {
                                    _id: 1,
                                    title: 1,
                                    type: 1,
                                    totalScore: 1,
                                    createdAt: 1,
                                    updatedAt: 1,
                                    user: 1,
                                    owners: 1,
                                    editors: 1,
                                },
                            },
                        ],
                    },
                },
            ]).exec();
            const totalCount = ((_b = results.totalCount[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
            const userForms = results.data.map((form) => {
                var _a, _b, _c;
                const isFormFilled = filledFormIds.includes(form._id.toString());
                // In "filledform" tab, always flag forms as filled so owners/creators/editors
                // can view their own responses by switching to this tab
                if (tab === Form_model_1.DashboardTabType.filledform) {
                    return Object.assign(Object.assign({}, form), { isFilled: true });
                }
                // For other tabs (all, myform, otherform):
                // Check if user has ownership/management rights over this form
                const isCreator = ((_a = form.user) === null || _a === void 0 ? void 0 : _a.toString()) === userId.toString();
                const isOwner = (_b = form.owners) === null || _b === void 0 ? void 0 : _b.some((ownerId) => ownerId.toString() === userId.toString());
                const isEditor = (_c = form.editors) === null || _c === void 0 ? void 0 : _c.some((editorId) => editorId.toString() === userId.toString());
                // If user owns/manages the form, don't flag it as "filled" even if they responded to it
                // Only flag as filled if user is ONLY a respondent (not owner/creator/editor)
                const shouldBeFlagged = isFormFilled && !isCreator && !isOwner && !isEditor;
                return Object.assign(Object.assign({}, form), { isFilled: shouldBeFlagged });
            });
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                    userForms,
                    pagination: {
                        totalCount,
                        totalPage: totalCount / lt,
                    },
                } }));
        }
        catch (error) {
            console.error("Error in handleUserQuery:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    });
}
// Helper function to build base query based on tab type
function buildBaseQuery(tab, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (tab) {
            case Form_model_1.DashboardTabType.all:
                return {
                    $or: [
                        { user: new mongoose_1.Types.ObjectId(userId) },
                        { editors: { $in: [userId] } },
                        { owners: { $in: [userId] } },
                    ],
                };
            case Form_model_1.DashboardTabType.myform:
                return {
                    $or: [{ user: userId }, { owners: { $in: [userId] } }],
                };
            case Form_model_1.DashboardTabType.otherform:
                return {
                    editors: { $in: [userId] },
                    user: { $ne: userId }, // Exclude forms owned by the user
                };
            case Form_model_1.DashboardTabType.filledform:
                // Optimized: Use aggregation to get form IDs directly
                const filledFormIds = yield Response_model_1.default.distinct("formId", { userId });
                return {
                    _id: { $in: filledFormIds },
                };
            default:
                throw new Error(`Invalid tab type: ${tab}`);
        }
    });
}
// Helper function to build filter query
function buildFilterQuery(filter) {
    const filterQuery = {};
    if (filter === null || filter === void 0 ? void 0 : filter.query) {
        const searchQuery = filter.query.trim();
        if (searchQuery) {
            filterQuery.title = { $regex: searchQuery, $options: "i" };
        }
    }
    if (filter === null || filter === void 0 ? void 0 : filter.type) {
        filterQuery.type = filter.type;
    }
    return filterQuery;
}
// Helper function to build sort options
function buildSortOptions(filter) {
    var _a, _b;
    const sortOptions = {};
    if ((_a = filter === null || filter === void 0 ? void 0 : filter.sort) === null || _a === void 0 ? void 0 : _a.createdAt) {
        sortOptions.createdAt = filter.sort.createdAt;
    }
    if ((_b = filter === null || filter === void 0 ? void 0 : filter.sort) === null || _b === void 0 ? void 0 : _b.updatedAt) {
        sortOptions.updatedAt = filter.sort.updatedAt;
    }
    if (Object.keys(sortOptions).length === 0) {
        sortOptions.updatedAt = -1;
    }
    return sortOptions;
}
/**
 *
 * Validate Form Content handler
 */
function ValidateFormBeforeAction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, action } = req.query;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        const validation = (0, formHelpers_1.validateFormRequest)(formId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        try {
            const form = yield Form_model_1.default.findById(formId)
                .select("user owners editors")
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(user.sub))) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const [validationSummary, errors] = yield Promise.all([
                SolutionValidationService_1.default.validateForm(formId),
                SolutionValidationService_1.default.getFormValidationErrors(formId),
            ]);
            const canProceed = action === "send_form" ? errors.length === 0 : true;
            const warnings = action === "send_form" ? [] : errors;
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors: action === "send_form" ? errors : [], warnings,
                    canProceed,
                    action, hasAccess: formHelpers_1.hasFormAccess, isOwner: (0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.owner, form, new mongoose_1.Types.ObjectId(user.sub)), isEditor: (0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.editor, form, new mongoose_1.Types.ObjectId(user.sub)) }) }));
        }
        catch (error) {
            console.error("Validate Form Before Action Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
        }
    });
}
