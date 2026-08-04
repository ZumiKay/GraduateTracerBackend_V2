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
exports.GetFilterTypeEnum = void 0;
exports.GetFilterForm = GetFilterForm;
const helper_1 = require("../../utilities/helper");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../../model/Content.model"));
const User_model_1 = __importDefault(require("../../model/User.model"));
const formHelpers_1 = require("../../utilities/formHelpers");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const FormValidationService_1 = require("../../services/FormValidationService");
var GetFilterTypeEnum;
(function (GetFilterTypeEnum) {
    GetFilterTypeEnum["search"] = "search";
    GetFilterTypeEnum["type"] = "type";
    GetFilterTypeEnum["createdDate"] = "createddate";
    GetFilterTypeEnum["modifiedDate"] = "modifieddate";
    GetFilterTypeEnum["detail"] = "detail";
    GetFilterTypeEnum["user"] = "user";
    GetFilterTypeEnum["setting"] = "setting";
    GetFilterTypeEnum["solution"] = "solution";
    GetFilterTypeEnum["preview"] = "preview";
    GetFilterTypeEnum["total"] = "total";
    GetFilterTypeEnum["response"] = "response";
    GetFilterTypeEnum["analytics"] = "analytics";
    GetFilterTypeEnum["validation"] = "validation";
})(GetFilterTypeEnum || (exports.GetFilterTypeEnum = GetFilterTypeEnum = {}));
var ValidationActionEnum;
(function (ValidationActionEnum) {
    ValidationActionEnum["page"] = "page";
    ValidationActionEnum["submission"] = "submit";
    ValidationActionEnum["normal"] = "normal";
})(ValidationActionEnum || (ValidationActionEnum = {}));
async function GetFilterForm(req, res) {
    try {
        const { ty, q, page = "1", limit = "5", tab, created, updated, action, } = req.query;
        if (tab && !Object.values(Form_model_1.DashboardTabType).includes(tab)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid type or query"));
        }
        const p = Number(page ?? "1");
        const lt = Math.min(Number(limit), 50);
        const createdAt = created ? parseInt(created) : undefined;
        const updatedAt = updated ? parseInt(updated) : undefined;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        // Handle different query types with optimized logic
        switch (ty) {
            case GetFilterTypeEnum.detail:
            case GetFilterTypeEnum.solution:
                return await handleDetailQuery(res, ty, q, p, new mongoose_1.Types.ObjectId(user?.sub));
            case GetFilterTypeEnum.response:
            case GetFilterTypeEnum.analytics:
                return await handleShortFormInfo({
                    res,
                    id: q,
                    userId: new mongoose_1.Types.ObjectId(user?.sub),
                });
            case GetFilterTypeEnum.total:
                return await handleTotalQuery(res, q, user);
            case GetFilterTypeEnum.setting:
                return await handleSettingQuery(res, q, user);
            case GetFilterTypeEnum.user:
                if ((createdAt && ![1, -1].includes(createdAt)) ||
                    (updatedAt && ![1, -1].includes(updatedAt))) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Sort values must be 1 or -1"));
                }
                const userTab = tab || Form_model_1.DashboardTabType.myform;
                return await handleUserQuery({
                    p,
                    lt,
                    userId: new mongoose_1.Types.ObjectId(user?.sub),
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
}
async function handleShortFormInfo({ res, userId, id, }) {
    if (!id || !(0, formHelpers_1.isValidObjectIdString)(id)) {
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
    }
    const form = await Form_model_1.default.findById(id)
        .select("_id title type totalpage totalscore user owners editors setting.email")
        .lean()
        .exec();
    if (!form) {
        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
    }
    const isHasAccess = (0, formHelpers_1.validateAccess)(form, userId);
    return res.status(200).json({
        ...(0, helper_1.ReturnCode)(200),
        data: {
            _id: form._id,
            title: form.title,
            type: form.type,
            totalpage: form.totalpage,
            totalscore: form.totalscore,
            setting: form.setting,
            ...isHasAccess,
        },
    });
}
async function handleDetailQuery(res, ty, q, p, user) {
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401));
    const query = (0, formHelpers_1.isValidObjectIdString)(q) ? { _id: q } : { title: q };
    const detailForm = await Form_model_1.default.findOne(query)
        .select(formHelpers_1.projections.detail)
        .lean();
    if (!detailForm)
        return res.status(404).json((0, helper_1.ReturnCode)(404, "No Form Found"));
    //Normal form can't have solution ty
    if (ty === GetFilterTypeEnum.solution && detailForm.type !== Form_model_1.TypeForm.Quiz) {
        return res.status(404).json((0, helper_1.ReturnCode)(400, "Invalid Form"));
    }
    //Verfiy form acess
    const accessInfo = (0, formHelpers_1.validateAccess)(detailForm, user);
    if (!accessInfo.hasAccess)
        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
    //Fetch content procession
    const contentProjection = ty === GetFilterTypeEnum.solution
        ? `${Content_model_1.DetailContentSelection} answer score hasAnswer isValidated isBonusScore useChildScoreSum`
        : Content_model_1.DetailContentSelection;
    let validationSummary = null;
    let resultContent = (await Content_model_1.default.find({
        formId: detailForm._id,
    })
        .select(contentProjection)
        .sort({ qIdx: 1 })
        .lean());
    validationSummary = FormValidationService_1.FormValidationService.validateForm(detailForm, resultContent, p, ty);
    //Attach each question valdiation message
    resultContent = resultContent
        .filter((i) => i.page === p)
        .map((i) => ({
        ...i,
        //Issues message attach to each question
        validationWarning: FormValidationService_1.FormValidationService.getValidationMessageByQId(validationSummary?.validationResults?.warnings ?? [], i._id?.toString() ?? i.qIdx),
        validationIssues: FormValidationService_1.FormValidationService.getValidationMessageByQId(validationSummary?.validationResults?.errors ?? [], i._id?.toString() ?? i.qIdx),
    }));
    const summaryData = await FormValidationService_1.FormValidationService.getFormOverviewDataById({
        formId: detailForm._id,
        p,
    });
    return res.status(200).json({
        ...(0, helper_1.ReturnCode)(200),
        data: {
            ...detailForm,
            contents: (0, helper_1.AddQuestionNumbering)({
                questions: resultContent.filter((i) => i.page === p),
                lastIdx: summaryData?.lastQuestionIdx,
            }), //Return only the selected page content
            contentIds: undefined,
            //Overall validation
            validation: validationSummary,
            ...summaryData,
            ...accessInfo, //User Role Of Form
        },
    });
}
/**
 * Fetch Summary of Form
 * - Total Question
 * - Total Score
 * - Total Page
 */
async function handleTotalQuery(res, q, user) {
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401));
    if (!(0, formHelpers_1.isValidObjectIdString)(q))
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
    const formdata = await Form_model_1.default.findById(q)
        .select(formHelpers_1.projections.total)
        .populate({ path: "user", select: "email", options: { lean: true } })
        .lean()
        .exec();
    if (!formdata)
        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
    const accessInfo = (0, formHelpers_1.validateAccess)(formdata, new mongoose_1.Types.ObjectId(user.sub));
    if (!accessInfo.hasAccess)
        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
    const contentStats = await Content_model_1.default.aggregate([
        { $match: { formId: formdata._id } },
        {
            $group: {
                _id: null,
                totalQuestions: { $sum: 1 },
                totalConditions: {
                    $sum: { $cond: [{ $ne: ["$parentcontent", true] }, 1, 0] },
                },
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
    const stats = contentStats[0] || {
        totalQuestions: 0,
        totalScore: 0,
        totalConditions: 0,
    };
    return res.status(200).json({
        ...(0, helper_1.ReturnCode)(200),
        data: {
            totalPage: formdata.totalpage ?? 0,
            totalScore: stats.totalScore,
            totalQuestion: stats.totalQuestions,
            totalConditions: stats.totalConditions,
            ...accessInfo,
        },
    });
}
async function handleSettingQuery(res, q, user) {
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401));
    if (!(0, formHelpers_1.isValidObjectIdString)(q))
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
    const form = await Form_model_1.default.findById(q)
        .select(formHelpers_1.projections.setting)
        .populate({ path: "user", select: "email", options: { lean: true } })
        .lean()
        .exec();
    if (!form)
        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
    const accessInfo = (0, formHelpers_1.validateAccess)(form, new mongoose_1.Types.ObjectId(user.sub));
    if (!accessInfo.hasAccess)
        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
    return res.status(200).json({
        ...(0, helper_1.ReturnCode)(200),
        data: {
            _id: form._id,
            title: form.title,
            type: form.type,
            setting: form.setting,
            ...accessInfo,
        },
    });
}
async function handleUserQuery({ p, userId, tab, res, lt, filter, }) {
    try {
        // Validate input parameters
        if (!userId || !tab || p < 1 || lt < 1) {
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        }
        const baseQuery = await buildBaseQuery(tab, userId);
        const filterQuery = buildFilterQuery(filter);
        const finalQuery = { ...baseQuery, ...filterQuery };
        const sortOptions = buildSortOptions(filter);
        //Flag Filled Form - Check for all tabs to properly identify filled forms
        const filledFormIds = [];
        const user = await User_model_1.default.findById(userId).select("email").lean();
        const filledForms = await Response_model_1.default.find({
            userId: userId,
            respondentEmail: user?.email,
        })
            .select("formId")
            .lean();
        filledFormIds.push(...filledForms.map((i) => i.formId.toString()));
        const [results] = await Form_model_1.default.aggregate([
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
        const totalCount = results.totalCount[0]?.count || 0;
        const userForms = results.data.map((form) => {
            const isFormFilled = filledFormIds.includes(form._id.toString());
            if (tab === Form_model_1.DashboardTabType.filledform) {
                return {
                    ...form,
                    isFilled: true,
                };
            }
            const isCreator = form.user?.toString() === userId.toString();
            const isOwner = form.owners?.some((ownerId) => ownerId.toString() === userId.toString());
            const isEditor = form.editors?.some((editorId) => editorId.toString() === userId.toString());
            const shouldBeFlagged = isFormFilled && !isCreator && !isOwner && !isEditor;
            return {
                ...form,
                isFilled: shouldBeFlagged,
            };
        });
        return res.status(200).json({
            ...(0, helper_1.ReturnCode)(200),
            data: {
                userForms,
            },
            pagination: {
                totalCount,
                totalPage: Math.ceil(totalCount / lt),
            },
        });
    }
    catch (error) {
        console.error("Error in handleUserQuery:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
    }
}
// Helper function to build base query based on tab type
async function buildBaseQuery(tab, userId) {
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
            const filledFormIds = await Response_model_1.default.distinct("formId", { userId });
            return {
                _id: { $in: filledFormIds },
            };
        default:
            throw new Error(`Invalid tab type: ${tab}`);
    }
}
// Helper function to build filter query
function buildFilterQuery(filter) {
    const filterQuery = {};
    if (filter?.query) {
        const searchQuery = filter.query.trim();
        if (searchQuery) {
            filterQuery.title = { $regex: searchQuery, $options: "i" };
        }
    }
    if (filter?.type) {
        filterQuery.type = filter.type;
    }
    return filterQuery;
}
// Helper function to build sort options
function buildSortOptions(filter) {
    const sortOptions = {};
    if (filter?.sort?.createdAt) {
        sortOptions.createdAt = filter.sort.createdAt;
    }
    if (filter?.sort?.updatedAt) {
        sortOptions.updatedAt = filter.sort.updatedAt;
    }
    if (Object.keys(sortOptions).length === 0) {
        sortOptions.updatedAt = -1;
    }
    return sortOptions;
}
