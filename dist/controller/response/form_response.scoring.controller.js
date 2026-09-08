"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormResponseScoringController = void 0;
const helper_1 = require("../../utilities/helper");
const ResponseValidationService_1 = require("../../services/ResponseValidationService");
const ResponseProcessingService_1 = require("../../services/ResponseProcessingService");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const formHelpers_1 = require("../../utilities/formHelpers");
const mongoose_1 = require("mongoose");
class FormResponseScoringController {
    UpdateResponseScore = async (req, res) => {
        try {
            const validation = ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: false,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { responseId, scores } = req.body;
            if (!responseId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Response ID is required"));
            }
            if (!scores || !Array.isArray(scores) || scores.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Scores array is required and must not be empty"));
            }
            for (const scoreEntry of scores) {
                if (!scoreEntry.questionId || scoreEntry.score === undefined) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Each score entry must have questionId and score"));
                }
            }
            const { response, form } = await ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.sub, res);
            if (!response || !form)
                return;
            const result = await ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores,
            });
            helper_1.SendResponse.success(res, result, "Scores updated successfully");
        }
        catch (error) {
            console.error("Update Response Score Error:", error);
            helper_1.SendResponse.error(res, "Failed To Update Score");
        }
    };
    UpdateQuestionScore = async (req, res) => {
        try {
            const validation = ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: false,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { responseId, questionId, score } = req.body;
            if (!responseId || !questionId || score === undefined) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Response ID, question ID, and score are required"));
            }
            const { response, form } = await ResponseValidationService_1.ResponseValidationService.validateResponseAccess(responseId, validation.user.sub, res);
            if (!response || !form)
                return;
            await ResponseProcessingService_1.ResponseProcessingService.updateResponseScores({
                responseId,
                scores: [{ questionId, score: Number(score) }],
            });
            res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, "Question score updated successfully"));
        }
        catch (error) {
            console.error("Update Question Score Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update question score"));
        }
    };
    BatchUpdateScores = async (req, res) => {
        try {
            const validation = ResponseValidationService_1.ResponseValidationService.validateRequest({
                req,
                res,
                requireFormId: false,
            });
            if (!validation.isValid || !validation.user?.sub)
                return;
            const { updates } = req.body;
            if (!updates || !Array.isArray(updates) || updates.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Updates array is required"));
            }
            for (const update of updates) {
                if (!update.responseId ||
                    (!update.scores && typeof update.score !== "number")) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Each update must have responseId and either scores array or score number"));
                }
                if (update.scores &&
                    (!Array.isArray(update.scores) || update.scores.length === 0)) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, "Scores must be a non-empty array"));
                }
            }
            // Check form access for the form of these responses
            const responseIds = updates
                .map((u) => u.responseId)
                .filter(formHelpers_1.isValidObjectIdString);
            if (responseIds.length > 0) {
                const firstResp = await Response_model_1.default.findById(responseIds[0])
                    .select("formId")
                    .lean();
                if (firstResp) {
                    const form = await Form_model_1.default.findById(firstResp.formId);
                    if (form &&
                        !(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(validation.user.sub))) {
                        return res
                            .status(403)
                            .json((0, helper_1.ReturnCode)(403, "Access denied to update scores for this form"));
                    }
                }
            }
            const result = await ResponseProcessingService_1.ResponseProcessingService.batchUpdateResponseScores(updates);
            res.status(200).json({
                ...(0, helper_1.ReturnCode)(200, "Batch update completed"),
                data: result,
            });
        }
        catch (error) {
            console.error("Batch Update Scores Error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to batch update scores"));
        }
    };
}
exports.FormResponseScoringController = FormResponseScoringController;
exports.default = new FormResponseScoringController();
