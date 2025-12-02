import { Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import { ResponseValidationService } from "../../services/ResponseValidationService";
import { ResponseProcessingService } from "../../services/ResponseProcessingService";
import { UpdateResponseScoretype } from "../../model/Response.model";
import { CustomRequest } from "../../types/customType";

export class FormResponseScoringController {
  public UpdateResponseScore = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { responseId, scores } = req.body as UpdateResponseScoretype;

      if (!responseId) {
        return res.status(400).json(ReturnCode(400, "Response ID is required"));
      }

      if (!scores || !Array.isArray(scores) || scores.length === 0) {
        return res
          .status(400)
          .json(
            ReturnCode(400, "Scores array is required and must not be empty")
          );
      }

      for (const scoreEntry of scores) {
        if (!scoreEntry.questionId || scoreEntry.score === undefined) {
          return res
            .status(400)
            .json(
              ReturnCode(400, "Each score entry must have questionId and score")
            );
        }
      }

      const { response, form } =
        await ResponseValidationService.validateResponseAccess(
          responseId,
          validation.user.sub,
          res
        );
      if (!response || !form) return;

      const result = await ResponseProcessingService.updateResponseScores({
        responseId,
        scores,
      });

      res.status(200).json({
        ...ReturnCode(200, "Scores updated successfully"),
        data: result,
      });
    } catch (error) {
      console.error("Update Response Score Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to update scores"));
    }
  };

  public UpdateQuestionScore = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { responseId, questionId, score } = req.body;

      if (!responseId || !questionId || score === undefined) {
        return res
          .status(400)
          .json(
            ReturnCode(400, "Response ID, question ID, and score are required")
          );
      }

      const { response, form } =
        await ResponseValidationService.validateResponseAccess(
          responseId,
          validation.user.sub,
          res
        );
      if (!response || !form) return;

      await ResponseProcessingService.updateResponseScores({
        responseId,
        scores: [{ questionId, score: Number(score) }],
      });

      res
        .status(200)
        .json(ReturnCode(200, "Question score updated successfully"));
    } catch (error) {
      console.error("Update Question Score Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to update question score"));
    }
  };

  public BatchUpdateScores = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { updates } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res
          .status(400)
          .json(ReturnCode(400, "Updates array is required"));
      }

      for (const update of updates) {
        if (
          !update.responseId ||
          !update.scores ||
          !Array.isArray(update.scores)
        ) {
          return res
            .status(400)
            .json(
              ReturnCode(
                400,
                "Each update must have responseId and scores array"
              )
            );
        }
      }

      const result = await ResponseProcessingService.batchUpdateResponseScores(
        updates
      );

      res.status(200).json({
        ...ReturnCode(200, "Batch update completed"),
        data: result,
      });
    } catch (error) {
      console.error("Batch Update Scores Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to batch update scores"));
    }
  };

  public RecalculateResponseScore = async (
    req: CustomRequest,
    res: Response
  ) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { responseId } = req.body;

      if (!responseId) {
        return res.status(400).json(ReturnCode(400, "Response ID is required"));
      }

      const result =
        await ResponseProcessingService.recalculateResponseTotalScore(
          responseId
        );

      res.status(200).json({
        ...ReturnCode(200, "Score recalculated successfully"),
        data: result,
      });
    } catch (error) {
      console.error("Recalculate Score Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to recalculate score"));
    }
  };
}

export default new FormResponseScoringController();
