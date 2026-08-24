"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const helper_1 = require("../../utilities/helper");
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
            const result = await Question_Service_1.default.saveQuestion(payload);
            if (!result.success) {
                return res
                    .status(result.statusCode || 400)
                    .json((0, helper_1.ReturnCode)(result.statusCode || 400, result.message));
            }
            if (result.noChanges) {
                return res
                    .status(200)
                    .json((0, helper_1.ReturnCode)(200, result.message || "No changes detected"));
            }
            return helper_1.SendResponse.success(res, result.data, result.message || "Saved Completed");
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
            const { id, formId } = req.body;
            const result = await Question_Service_1.default.deleteQuestion(id, formId);
            if (!result.success) {
                return res
                    .status(result.statusCode || 400)
                    .json((0, helper_1.ReturnCode)(result.statusCode || 400, result.message));
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
