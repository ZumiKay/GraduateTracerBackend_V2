"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const helper_1 = require("../../utilities/helper");
const formAccessGuard_1 = require("../../utilities/formAccessGuard");
const FormCollaborationService_1 = require("../../services/FormCollaborationService");
const Question_Service_1 = __importDefault(require("../../services/Question.Service"));
class QuestionController {
    /**
     * Save Question Handler
     *
     * Features:
     * - Question creation and update
     * - Conditional question processing
     * - Score calculation
     * - Automatic cleanup of deleted questions
     */
    SaveQuestion = async (req, res) => {
        try {
            const payload = req.body;
            if (!(await (0, formAccessGuard_1.ensureFormAccess)(req, res, payload?.formId)))
                return;
            const result = await Question_Service_1.default.saveQuestion(payload);
            if (!result.success) {
                // Stale copy: return the latest page so the client can reload it
                if (result.statusCode === 409 && result.conflict) {
                    return res.status(409).json({
                        ...(0, helper_1.ReturnCode)(409, result.message),
                        data: result.conflict,
                    });
                }
                return res
                    .status(result.statusCode || 400)
                    .json((0, helper_1.ReturnCode)(result.statusCode || 400, result.message));
            }
            if (result.noChanges) {
                return res.status(200).json({
                    ...(0, helper_1.ReturnCode)(200, result.message || "No changes detected"),
                    version: result.version,
                });
            }
            // Live refresh: push the saved page to the other open editors
            if (typeof result.version === "number" && typeof payload.page === "number") {
                FormCollaborationService_1.formCollaboration.broadcastContent(payload.formId, {
                    page: payload.page,
                    version: result.version,
                    data: result.data ?? [],
                }, {
                    userId: req.user.sub.toString(),
                    connectionId: typeof payload.connectionId === "string"
                        ? payload.connectionId
                        : undefined,
                });
            }
            return res.status(200).json({
                ...(0, helper_1.ReturnCode)(200, result.message || "Saved Completed"),
                data: result.data,
                version: result.version,
            });
        }
        catch (error) {
            return this.handleSaveQuestionError(error, res);
        }
    };
    /**
     * Delete Question Handler
     */
    DeleteQuestion = async (req, res) => {
        try {
            const { id, formId } = req.body ?? {};
            if (!(await (0, formAccessGuard_1.ensureFormAccess)(req, res, formId)))
                return;
            const result = await Question_Service_1.default.deleteQuestion(id, formId);
            if (!result.success) {
                return res
                    .status(result.statusCode || 400)
                    .json((0, helper_1.ReturnCode)(result.statusCode || 400, result.message));
            }
            // Live refresh: the page lost a question
            if (typeof result.page === "number" && typeof result.version === "number") {
                FormCollaborationService_1.formCollaboration.broadcastContent(formId, {
                    page: result.page,
                    version: result.version,
                    data: await Question_Service_1.default.fetchNumberedPage(formId, result.page),
                }, { userId: req.user.sub.toString() });
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, result.message || "Question Deleted"));
        }
        catch (error) {
            console.error("Delete Question Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Error occurred while deleting question"));
        }
    };
    /**
     * Save Solution Handler
     */
    SaveSolution = async (req, res) => {
        try {
            const data = req.body;
            const result = await Question_Service_1.default.saveSolution(data);
            if (!result.success) {
                return res
                    .status(result.statusCode || 400)
                    .json((0, helper_1.ReturnCode)(result.statusCode || 400, result.message));
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, result.message || "Solution Saved"));
        }
        catch (error) {
            console.log("Save Solution", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    };
    handleSaveQuestionError(error, res) {
        console.error("SaveQuestion Error:", error);
        if (error instanceof mongoose_1.default.Error.ValidationError) {
            return helper_1.SendResponse.badRequest(res);
        }
        if (error instanceof mongoose_1.default.Error.CastError) {
            return helper_1.SendResponse.badRequest(res, "Invalid ID Format");
        }
        return helper_1.SendResponse.error(res);
    }
}
exports.default = new QuestionController();
