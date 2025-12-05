import { Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import { Types } from "mongoose";
import FormResponse from "../../model/Response.model";
import Form, { FormType } from "../../model/Form.model";
import Content from "../../model/Content.model";
import { ResponseValidationService } from "../../services/ResponseValidationService";
import {
  ResponseFilterType,
  ResponseQueryService,
} from "../../services/ResponseQueryService";
import { ResponseAnalyticsService } from "../../services/ResponseAnalyticsService";
import {
  hasFormAccess,
  isValidObjectIdString,
} from "../../utilities/formHelpers";
import { CustomRequest } from "../../types/customType";

export class FormResponseQueryController {
  public GetResponseByFormId = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user.sub,
        res
      );
      if (!form) return;

      const result = await ResponseQueryService.getResponsesByFormId(
        validation.formId!,
        validation.page!,
        validation.limit!
      );

      res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get Response By FormId Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  public GetResponseByUser = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { respondentEmail, formId } = req.query;
      if (!respondentEmail || !formId) {
        return res.status(400).json(ReturnCode(400));
      }

      const form = await ResponseValidationService.validateFormAccess(
        formId as string,
        validation.user.sub,
        res
      );
      if (!form) return;

      let populatedResponse = await FormResponse.findOne({
        $and: [
          {
            formId,
          },
          {
            respondentEmail,
          },
        ],
      })
        .select(
          "_id responseset totalScore isCompleted completionStatus respondentEmail respondentName respondentType submittedAt"
        )
        .lean();

      //Populate response set question
      const responseContent = await Content.find({
        _id: { $in: populatedResponse?.responseset.map((i) => i.question) },
      }).lean();

      populatedResponse = {
        ...populatedResponse,
        responseset: populatedResponse?.responseset.map((res) => {
          return {
            ...res,
            question: responseContent.find((q) => q._id === res.question),
          };
        }) as never,
      } as never;

      if (!populatedResponse) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      res.status(200).json({ ...ReturnCode(200), data: populatedResponse });
    } catch (error) {
      console.error("Get Response By UserId Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve response"));
    }
  };

  public GetResponsesInfo = async (req: CustomRequest, res: Response) => {
    if (!req.user) return res.status(403).json(ReturnCode(403));

    const { formId } = req.params as { formId: string };
    const { group } = req.query as { group?: string };

    if (!formId || !isValidObjectIdString(formId))
      return res.status(400).json(ReturnCode(400));

    try {
      const form = await Form.findById(formId).select(
        "_id owners editors user"
      );

      const hasAccess = hasFormAccess(
        form as FormType,
        new Types.ObjectId(req.user.sub)
      );

      if (!hasAccess) return res.status(403).json(ReturnCode(403));

      const respondents = await FormResponse.aggregate([
        {
          $match: {
            formId: new Types.ObjectId(formId),
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

      return res.status(200).json({ ...ReturnCode(200), data: respondents });
    } catch (error) {
      console.log("Fetching respondentList", error);
      res.status(500).json(ReturnCode(500));
    }
  };

  public GetResponsesWithFilters = async (
    req: CustomRequest,
    res: Response
  ) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: true,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user.sub,
        res
      );
      if (!form) return;

      const filters: ResponseFilterType = {
        formId: validation.formId!,
        searchTerm: req.query.q as string,
        completionStatus: req.query.status as string,
        startDate: req.query.startD as string,
        endDate: req.query.endD as string,
        minScore: req.query.startS as string,
        maxScore: req.query.endS as string,
        email: req.query.email as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as string,
        page: validation.page!,
        limit: validation.limit!,
        id: validation.rid as string,
        userId: validation.uid as string,
        group: req.query.group as string,
      };

      const result = await ResponseQueryService.getResponsesWithFilters(
        filters
      );

      if (!result)
        return res.status(404).json(ReturnCode(404, "Response not found"));

      return res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get Responses With Filters Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  public GetResponseByID = async (req: CustomRequest, res: Response) => {
    const { id, formId } = req.params as { id: string; formId: string };
    if (!isValidObjectIdString(id) || !isValidObjectIdString(formId)) {
      return res.status(400).json(ReturnCode(400));
    }

    try {
      const result = await ResponseQueryService.GetResponseById({ id, formId });

      if (!result) {
        return res.status(404).json(ReturnCode(404));
      }

      return res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.log("Get Response By ID");
      res.status(500).json(ReturnCode(500, "Error Occured"));
    }
  };

  public GetUserResponses = async (req: CustomRequest, res: Response) => {
    try {
      const { formId, page, uid, isValid } =
        await ResponseValidationService.validateRequest({
          req,
          res,
          requireUserInfo: true,
          requireFormId: true,
        });
      if (!isValid || !uid || !formId) return;

      const result = await ResponseQueryService.getUserResponses({
        page: page ?? 1,
        formId,
        user: uid,
        limit: 1,
      });

      res.status(200).json({ ...ReturnCode(200), data: result });
    } catch (error) {
      console.error("Get User Responses Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve user responses"));
    }
  };

  public DeleteResponse = async (req: CustomRequest, res: Response) => {
    try {
      const { responseId } = req.params;
      if (!req.user) return res.status(401).json(ReturnCode(401));
      if (!responseId) {
        return res.status(400).json(ReturnCode(400, "Response ID is required"));
      }

      const { response, form } =
        await ResponseValidationService.validateResponseAccess(
          responseId,
          req.user?.sub,
          res
        );
      if (!response || !form) return;

      await ResponseQueryService.deleteResponse(responseId);
      res.status(200).json(ReturnCode(200, "Response deleted successfully"));
    } catch (error) {
      console.error("Delete Response Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to delete response"));
    }
  };

  public BulkDeleteResponses = async (req: CustomRequest, res: Response) => {
    try {
      const { responseIds, formId } = req.body;
      if (
        !responseIds ||
        !Array.isArray(responseIds) ||
        responseIds.length === 0
      ) {
        return res
          .status(400)
          .json(ReturnCode(400, "Response IDs array is required"));
      }

      if (!formId) {
        return res.status(400).json(ReturnCode(400, "Form ID is required"));
      }

      const isValidIds = responseIds.filter((id) => isValidObjectIdString(id));
      if (isValidIds.length === 0) {
        return res.status(400).json(ReturnCode(400, "Invalid Data"));
      }

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        req.user?.sub as never,
        res
      );
      if (!form) return;

      const result = await ResponseQueryService.bulkDeleteResponses(
        isValidIds,
        formId
      );
      res.status(200).json({
        ...ReturnCode(200, "Responses deleted successfully"),
        data: result,
      });
    } catch (error) {
      console.error("Bulk Delete Responses Error:", error);
      if (error instanceof Error && error.message.includes("don't exist")) {
        return res.status(400).json(ReturnCode(400, error.message));
      }
      if (error instanceof Error && error.message.includes("Invalid")) {
        return res.status(400).json(ReturnCode(400, error.message));
      }
      res.status(500).json(ReturnCode(500, "Failed to delete responses"));
    }
  };

  public GetResponseAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user?.sub,
        res
      );
      if (!form) return;

      const responses = await ResponseQueryService.getResponsesByFormId(
        validation.formId!,
        1,
        1000
      );

      const analytics = await ResponseAnalyticsService.getResponseAnalytics(
        validation.formId!,
        responses.responses,
        form
      );

      res.status(200).json({ ...ReturnCode(200), data: analytics });
    } catch (error) {
      console.error("Get Response Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  public GetChoiceQuestionAnalytics = async (
    req: CustomRequest,
    res: Response
  ) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const form = await ResponseValidationService.validateFormAccess(
        validation.formId!,
        validation.user?.sub,
        res
      );
      if (!form) return;

      const { questionId } = req.query as { questionId?: string };

      const analytics =
        await ResponseAnalyticsService.getChoiceQuestionAnalytics(
          validation.formId!,
          questionId
        );

      res.status(200).json({
        ...ReturnCode(200),
        data: analytics,
        message: "Choice question analytics retrieved successfully",
      });
    } catch (error) {
      console.error("Get Choice Question Analytics Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve choice question analytics"));
    }
  };

  public GetFormAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { formId } = req.params;
      const { period = "7d" } = req.query;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.sub,
        res
      );
      if (!form) return;

      const analyticsData = await ResponseAnalyticsService.getFormAnalytics(
        formId,
        period as string
      );

      res.status(200).json({ ...ReturnCode(200), data: analyticsData });
    } catch (error) {
      console.error("Get Form Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve analytics"));
    }
  };

  public ExportAnalytics = async (req: CustomRequest, res: Response) => {
    try {
      const validation = await ResponseValidationService.validateRequest({
        req,
        res,
        requireFormId: false,
      });
      if (!validation.isValid || !validation.user?.sub) return;

      const { formId } = req.params;
      const { format = "pdf" } = req.query;

      const form = await ResponseValidationService.validateFormAccess(
        formId,
        validation.user.sub,
        res
      );
      if (!form) return;

      const analyticsData = await ResponseAnalyticsService.getFormAnalytics(
        formId
      );

      if (format === "csv") {
        const responses = await ResponseQueryService.getResponsesByFormId(
          formId,
          1,
          1000
        );
        const csvData = ResponseAnalyticsService.generateCSVData(
          analyticsData,
          responses.responses
        );

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${form.title}-analytics.csv"`
        );
        res.send(csvData);
      } else {
        res
          .status(400)
          .json(ReturnCode(400, "Only CSV export is currently supported"));
      }
    } catch (error) {
      console.error("Export Analytics Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to export analytics"));
    }
  };
}

export default new FormResponseQueryController();
