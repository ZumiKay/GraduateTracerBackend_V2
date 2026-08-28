import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReturnCode, SendResponse } from "../../utilities/helper";
import QuestionService, {
  SaveQuestionPayload,
} from "../../services/Question.Service";
import { AnswerKey } from "../../model/Content.model";

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
  public SaveQuestion = async (req: Request, res: Response) => {
    try {
      const payload = req.body as SaveQuestionPayload;
      const result = await QuestionService.saveQuestion(payload);

      if (!result.success) {
        return res
          .status(result.statusCode || 400)
          .json(ReturnCode(result.statusCode || 400, result.message));
      }

      if (result.noChanges) {
        return res
          .status(200)
          .json(ReturnCode(200, result.message || "No changes detected"));
      }

      return SendResponse.success(
        res,
        result.data,
        result.message || "Saved Completed",
      );
    } catch (error) {
      return this.handleSaveQuestionError(error, res);
    }
  };

  /**
   * Delete Question Handler
   */
  public DeleteQuestion = async (req: Request, res: Response) => {
    try {
      const { id, formId }: { id: string; formId: string; qIdx?: number } =
        req.body;

      const result = await QuestionService.deleteQuestion(id, formId);

      if (!result.success) {
        return res
          .status(result.statusCode || 400)
          .json(ReturnCode(result.statusCode || 400, result.message));
      }

      return res
        .status(200)
        .json(ReturnCode(200, result.message || "Question Deleted"));
    } catch (error) {
      console.error("Delete Question Error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Error occurred while deleting question"));
    }
  };

  /**
   * Save Solution Handler
   */
  public SaveSolution = async (req: Request, res: Response) => {
    try {
      const data = req.body as Array<AnswerKey>;
      const result = await QuestionService.saveSolution(data);

      if (!result.success) {
        return res
          .status(result.statusCode || 400)
          .json(ReturnCode(result.statusCode || 400, result.message));
      }

      return res
        .status(200)
        .json(ReturnCode(200, result.message || "Solution Saved"));
    } catch (error) {
      console.log("Save Solution", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  private handleSaveQuestionError(error: unknown, res: Response) {
    console.error("SaveQuestion Error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return SendResponse.badRequest(res);
    }
    if (error instanceof mongoose.Error.CastError) {
      return SendResponse.badRequest(res, "Invalid ID Format");
    }

    return SendResponse.error(res);
  }
}

export default new QuestionController();
