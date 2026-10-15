import { Response } from "express";
import mongoose from "mongoose";
import { ReturnCode, SendResponse } from "../../utilities/helper";
import { CustomRequest } from "../../types/customType";
import { ensureFormAccess } from "../../utilities/formAccessGuard";
import { formCollaboration } from "../../services/FormCollaborationService";
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
  public SaveQuestion = async (req: CustomRequest, res: Response) => {
    try {
      const payload = req.body as SaveQuestionPayload;

      if (!(await ensureFormAccess(req, res, payload?.formId))) return;

      const result = await QuestionService.saveQuestion(payload);

      if (!result.success) {
        // Stale copy: return the latest page so the client can reload it
        if (result.statusCode === 409 && result.conflict) {
          return res.status(409).json({
            ...ReturnCode(409, result.message),
            data: result.conflict,
          });
        }

        return res
          .status(result.statusCode || 400)
          .json(ReturnCode(result.statusCode || 400, result.message));
      }

      if (result.noChanges) {
        return res.status(200).json({
          ...ReturnCode(200, result.message || "No changes detected"),
          version: result.version,
        });
      }

      // Live refresh: push the saved page to the other open editors
      if (typeof result.version === "number" && typeof payload.page === "number") {
        formCollaboration.broadcastContent(
          payload.formId,
          {
            page: payload.page,
            version: result.version,
            data: result.data ?? [],
          },
          {
            userId: req.user!.sub.toString(),
            connectionId:
              typeof payload.connectionId === "string"
                ? payload.connectionId
                : undefined,
          },
        );
      }

      return res.status(200).json({
        ...ReturnCode(200, result.message || "Saved Completed"),
        data: result.data,
        version: result.version,
      });
    } catch (error) {
      return this.handleSaveQuestionError(error, res);
    }
  };

  /**
   * Delete Question Handler
   */
  public DeleteQuestion = async (req: CustomRequest, res: Response) => {
    try {
      const { id, formId }: { id: string; formId: string; qIdx?: number } =
        req.body ?? {};

      if (!(await ensureFormAccess(req, res, formId))) return;

      const result = await QuestionService.deleteQuestion(id, formId);

      if (!result.success) {
        return res
          .status(result.statusCode || 400)
          .json(ReturnCode(result.statusCode || 400, result.message));
      }

      // Live refresh: the page lost a question
      if (typeof result.page === "number" && typeof result.version === "number") {
        formCollaboration.broadcastContent(
          formId,
          {
            page: result.page,
            version: result.version,
            data: await QuestionService.fetchNumberedPage(formId, result.page),
          },
          { userId: req.user!.sub.toString() },
        );
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
  public SaveSolution = async (req: CustomRequest, res: Response) => {
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
