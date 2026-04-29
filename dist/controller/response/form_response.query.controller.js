"use strict";
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
exports.FormResponseQueryController = void 0;
const helper_1 = require("../../utilities/helper");
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const Content_model_1 = __importDefault(require("../../model/Content.model"));
const ResponseValidationService_1 = require("../../services/ResponseValidationService");
const ResponseQueryService_1 = require("../../services/ResponseQueryService");
const ResponseAnalyticsService_1 = require("../../services/ResponseAnalyticsService");
const formHelpers_1 = require("../../utilities/formHelpers");
class FormResponseQueryController {
    constructor() {
        this.GetResponseByFormId = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.sub, res);
                if (!form)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, validation.page, validation.limit);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get Response By FormId Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        this.GetResponseByUser = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { respondentEmail, formId } = req.query;
                if (!respondentEmail || !formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                }
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
                if (!form)
                    return;
                let populatedResponse = yield Response_model_1.default.findOne({
                    $and: [
                        {
                            formId,
                        },
                        {
                            respondentEmail,
                        },
                    ],
                })
                    .select("_id responseset totalScore isCompleted completionStatus respondentEmail respondentName respondentType submittedAt")
                    .lean();
                //Populate response set question
                const responseContent = yield Content_model_1.default.find({
                    _id: { $in: populatedResponse === null || populatedResponse === void 0 ? void 0 : populatedResponse.responseset.map((i) => i.question) },
                }).lean();
                populatedResponse = Object.assign(Object.assign({}, populatedResponse), { responseset: populatedResponse === null || populatedResponse === void 0 ? void 0 : populatedResponse.responseset.map((res) => {
                        return Object.assign(Object.assign({}, res), { question: responseContent.find((q) => q._id === res.question) });
                    }) });
                if (!populatedResponse) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                }
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: populatedResponse }));
            }
            catch (error) {
                console.error("Get Response By UserId Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve response"));
            }
        });
        this.GetResponsesInfo = (req, res) => __awaiter(this, void 0, void 0, function* () {
            if (!req.user)
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            const { formId } = req.params;
            const { group } = req.query;
            if (!formId || !(0, formHelpers_1.isValidObjectIdString)(formId))
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            try {
                const form = yield Form_model_1.default.findById(formId).select("_id owners editors user");
                const hasAccess = (0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(req.user.sub));
                if (!hasAccess)
                    return res.status(403).json((0, helper_1.ReturnCode)(403));
                const respondents = yield Response_model_1.default.aggregate([
                    {
                        $match: {
                            formId: new mongoose_1.Types.ObjectId(formId),
                        },
                    },
                    {
                        $sort: { submittedAt: -1 },
                    },
                    {
                        $group: {
                            _id: "$respondentEmail",
                            count: { $sum: 1 },
                            lastSubmitted: { $max: "$submittedAt" },
                            respondentName: { $first: "$respondentName" },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            respondentEmail: "$_id",
                            respondentName: 1,
                            responseCount: "$count",
                            lastSubmitted: 1,
                        },
                    },
                    {
                        $sort: { lastSubmitted: -1 },
                    },
                ]);
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: respondents }));
            }
            catch (error) {
                console.log("Fetching respondentList", error);
                res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        });
        this.GetResponsesWithFilters = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: true,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.sub, res);
                if (!form)
                    return;
                const filters = {
                    formId: validation.formId,
                    searchTerm: req.query.q,
                    completionStatus: req.query.status,
                    startDate: req.query.startD,
                    endDate: req.query.endD,
                    minScore: req.query.startS,
                    maxScore: req.query.endS,
                    email: req.query.email,
                    sortBy: req.query.sortBy,
                    sortOrder: req.query.sortOrder,
                    page: validation.page,
                    limit: validation.limit,
                    id: validation.rid,
                    userId: validation.uid,
                    group: req.query.group,
                };
                const result = yield ResponseQueryService_1.ResponseQueryService.getResponsesWithFilters(filters);
                if (!result)
                    return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get Responses With Filters Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
            }
        });
        this.GetResponseByID = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id, formId } = req.params;
            if (!(0, formHelpers_1.isValidObjectIdString)(id) || !(0, formHelpers_1.isValidObjectIdString)(formId)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            try {
                const result = yield ResponseQueryService_1.ResponseQueryService.GetResponseById({ id, formId });
                if (!result) {
                    return res.status(404).json((0, helper_1.ReturnCode)(404));
                }
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.log("Get Response By ID", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Error Occured"));
            }
        });
        this.GetUserResponses = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { formId, page, uid, isValid } = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireUserInfo: true,
                    requireFormId: true,
                });
                if (!isValid || !uid || !formId)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.getUserResponses({
                    page: page !== null && page !== void 0 ? page : 1,
                    formId,
                    user: uid,
                    limit: 1,
                });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: result }));
            }
            catch (error) {
                console.error("Get User Responses Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve user responses"));
            }
        });
        this.DeleteResponse = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { responseId } = req.params;
                if (!req.user)
                    return res.status(401).json((0, helper_1.ReturnCode)(401));
                if (!responseId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
                }
                const { response, form } = yield ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, (_a = req.user) === null || _a === void 0 ? void 0 : _a.sub, res);
                if (!response || !form)
                    return;
                yield ResponseQueryService_1.ResponseQueryService.deleteResponse(responseId);
                res.status(200).json((0, helper_1.ReturnCode)(200, "Response deleted successfully"));
            }
            catch (error) {
                console.error("Delete Response Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete response"));
            }
        });
        this.BulkDeleteResponses = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { responseIds, formId } = req.body;
                if (!responseIds ||
                    !Array.isArray(responseIds) ||
                    responseIds.length === 0) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Response IDs array is required"));
                }
                if (!formId) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                }
                const isValidIds = responseIds.filter((id) => (0, formHelpers_1.isValidObjectIdString)(id));
                if (isValidIds.length === 0) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Data"));
                }
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, (_a = req.user) === null || _a === void 0 ? void 0 : _a.sub, res);
                if (!form)
                    return;
                const result = yield ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses(isValidIds, formId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Responses deleted successfully")), { data: result }));
            }
            catch (error) {
                console.error("Bulk Delete Responses Error:", error);
                if (error instanceof Error && error.message.includes("don't exist")) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, error.message));
                }
                if (error instanceof Error && error.message.includes("Invalid")) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, error.message));
                }
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete responses"));
            }
        });
        this.GetResponseAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, (_b = validation.user) === null || _b === void 0 ? void 0 : _b.sub, res);
                if (!form)
                    return;
                const responses = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, 1, 1000);
                const analytics = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getResponseAnalytics(validation.formId, responses.responses, form);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analytics }));
            }
            catch (error) {
                console.error("Get Response Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        this.GetChoiceQuestionAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, (_b = validation.user) === null || _b === void 0 ? void 0 : _b.sub, res);
                if (!form)
                    return;
                const { questionId } = req.query;
                const analytics = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getChoiceQuestionAnalytics(validation.formId, questionId);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analytics, message: "Choice question analytics retrieved successfully" }));
            }
            catch (error) {
                console.error("Get Choice Question Analytics Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve choice question analytics"));
            }
        });
        this.GetFormAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { formId } = req.params;
                const { period = "7d" } = req.query;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
                if (!form)
                    return;
                const analyticsData = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId, period);
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: analyticsData }));
            }
            catch (error) {
                console.error("Get Form Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
            }
        });
        this.ExportAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const validation = yield ResponseValidationService_1.ResponseValidationService.validateRequest({
                    req,
                    res,
                    requireFormId: false,
                });
                if (!validation.isValid || !((_a = validation.user) === null || _a === void 0 ? void 0 : _a.sub))
                    return;
                const { formId } = req.params;
                const { format = "pdf" } = req.query;
                const form = yield ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
                if (!form)
                    return;
                const analyticsData = yield ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId);
                if (format === "csv") {
                    const responses = yield ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formId, 1, 1000);
                    const csvData = ResponseAnalyticsService_1.ResponseAnalyticsService.generateCSVData(analyticsData, responses.responses);
                    res.setHeader("Content-Type", "text/csv");
                    res.setHeader("Content-Disposition", `attachment; filename="${form.title}-analytics.csv"`);
                    res.send(csvData);
                }
                else {
                    res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Only CSV export is currently supported"));
                }
            }
            catch (error) {
                console.error("Export Analytics Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to export analytics"));
            }
        });
    }
}
exports.FormResponseQueryController = FormResponseQueryController;
exports.default = new FormResponseQueryController();
