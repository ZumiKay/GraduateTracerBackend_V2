"use strict";
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
    GetResponseByFormId = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.sub, res);
            if (!form)
                return;
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, validation.page, validation.limit);
            res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: result });
        }
        catch (error) {
            console.error("Get Response By FormId Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
        }
    };
    GetResponseByUser = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { respondentEmail, formId } = req.query;
            if (!respondentEmail || !formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
            if (!form)
                return;
            let populatedResponse = await Response_model_1.default.findOne({
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
            const responseContent = await Content_model_1.default.find({
                _id: { $in: populatedResponse?.responseset.map((i) => i.question) },
            }).lean();
            populatedResponse = {
                ...populatedResponse,
                responseset: populatedResponse?.responseset.map((res) => {
                    return {
                        ...res,
                        question: responseContent.find((q) => q._id === res.question),
                    };
                }),
            };
            if (!populatedResponse) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
            }
            res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: populatedResponse });
        }
        catch (error) {
            console.error("Get Response By UserId Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve response"));
        }
    };
    GetResponsesInfo = async (req, res) => {
        if (!req.user)
            return res.status(403).json((0, helper_1.ReturnCode)(403));
        const { formId } = req.params;
        const { group } = req.query;
        if (!formId || !(0, formHelpers_1.isValidObjectIdString)(formId))
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        try {
            const form = await Form_model_1.default.findById(formId).select("_id owners editors user");
            const hasAccess = (0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(req.user.sub));
            if (!hasAccess)
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            const respondents = await Response_model_1.default.aggregate([
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
            return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: respondents });
        }
        catch (error) {
            console.log("Fetching respondentList", error);
            res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    GetResponsesWithFilters = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: true,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user.sub, res);
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
            const result = await ResponseQueryService_1.ResponseQueryService.getResponsesWithFilters(filters);
            if (!result)
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
            return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: result });
        }
        catch (error) {
            console.error("Get Responses With Filters Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve responses"));
        }
    };
    GetResponseByID = async (req, res) => {
        const { id, formId } = req.params;
        if (!(0, formHelpers_1.isValidObjectIdString)(id) || !(0, formHelpers_1.isValidObjectIdString)(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        }
        try {
            const result = await ResponseQueryService_1.ResponseQueryService.GetResponseById({ id, formId });
            if (!result) {
                return res.status(404).json((0, helper_1.ReturnCode)(404));
            }
            return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: result });
        }
        catch (error) {
            console.log("Get Response By ID", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Error Occured"));
        }
    };
    GetUserResponses = async (req, res) => {
        try {
            const { formId, page, uid, isValid } = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireUserInfo: true,
                requireFormId: true,
            });
            if (!isValid || !uid || !formId)
                return;
            const result = await ResponseQueryService_1.ResponseQueryService.getUserResponses({
                page: page ?? 1,
                formId,
                user: uid,
                limit: 1,
            });
            res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: result });
        }
        catch (error) {
            console.error("Get User Responses Error:", error);
            res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to retrieve user responses"));
        }
    };
    DeleteResponse = async (req, res) => {
        try {
            const { responseId } = req.params;
            if (!req.user)
                return res.status(401).json((0, helper_1.ReturnCode)(401));
            if (!responseId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
            }
            const { response, form } = await ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, req.user?.sub, res);
            if (!response || !form)
                return;
            await ResponseQueryService_1.ResponseQueryService.deleteResponse(responseId);
            res.status(200).json((0, helper_1.ReturnCode)(200, "Response deleted successfully"));
        }
        catch (error) {
            console.error("Delete Response Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete response"));
        }
    };
    BulkDeleteResponses = async (req, res) => {
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
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, req.user?.sub, res);
            if (!form)
                return;
            const result = await ResponseQueryService_1.ResponseQueryService.bulkDeleteResponses(isValidIds, formId);
            res.status(200).json({
                ...(0, helper_1.ReturnCode)(200, "Responses deleted successfully"),
                data: result,
            });
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
    };
    GetResponseAnalytics = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user?.sub, res);
            if (!form)
                return;
            const responses = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(validation.formId, 1, 1000);
            const analytics = await ResponseAnalyticsService_1.ResponseAnalyticsService.getResponseAnalytics(responses.responses, form);
            res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: analytics });
        }
        catch (error) {
            console.error("Get Response Analytics Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
        }
    };
    GetChoiceQuestionAnalytics = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(validation.formId, validation.user?.sub, res);
            if (!form)
                return;
            const { questionId } = req.query;
            const analytics = await ResponseAnalyticsService_1.ResponseAnalyticsService.getChoiceQuestionAnalytics(validation.formId, questionId);
            res.status(200).json({
                ...(0, helper_1.ReturnCode)(200),
                data: analytics,
                message: "Choice question analytics retrieved successfully",
            });
        }
        catch (error) {
            console.error("Get Choice Question Analytics Error:", error);
            res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to retrieve choice question analytics"));
        }
    };
    GetFormAnalytics = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { formId } = req.params;
            const { period = "7d" } = req.query;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
            if (!form)
                return;
            const analyticsData = await ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId, period);
            res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: analyticsData });
        }
        catch (error) {
            console.error("Get Form Analytics Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve analytics"));
        }
    };
    ExportAnalytics = async (req, res) => {
        try {
            const validation = await ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: false,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { formId } = req.params;
            const { format = "pdf" } = req.query;
            const form = await ResponseValidationService_1.ResponseValidationService.validateFormAccess(formId, validation.user.sub, res);
            if (!form)
                return;
            const analyticsData = await ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(formId);
            if (format === "csv") {
                const responses = await ResponseQueryService_1.ResponseQueryService.getResponsesByFormId(formId, 1, 1000);
                const csvData = ResponseAnalyticsService_1.ResponseAnalyticsService.generateCSVData(responses.responses);
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
    };
}
exports.FormResponseQueryController = FormResponseQueryController;
exports.default = new FormResponseQueryController();
