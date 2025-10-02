import { RootFilterQuery } from "mongoose";
import FormResponse, { FormResponseType } from "../model/Response.model";
import Form from "../model/Form.model";
import Content from "../model/Content.model";
import { ResponseValidationService } from "./ResponseValidationService";
import { FingerprintService } from "../utilities/fingerprint";
import { Request, Response } from "express";

export class ResponseQueryService {
  private static SummarySelectResponseField =
    "_id respondentEmail respondentName respondentType submittedAt isCompleted completionStatus createdAt";
  static async getResponsesByFormId(
    formId: string,
    page: number,
    limit: number
  ) {
    const responses = await FormResponse.find({ formId })
      .select(this.SummarySelectResponseField)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalCount = await FormResponse.countDocuments({ formId });

    return {
      responses,
      pagination: ResponseValidationService.createPaginationResponse(
        page,
        limit,
        totalCount
      ),
    };
  }

  static async getResponsesWithFilters(filters: {
    formId: string;
    searchTerm?: string;
    completionStatus?: string;
    startDate?: string;
    endDate?: string;
    minScore?: string;
    maxScore?: string;
    sortBy?: string;
    sortOrder?: string;
    page: number;
    limit: number;
  }) {
    const query = ResponseValidationService.buildFilterQuery(filters);
    const sortOptions = ResponseValidationService.buildSortOptions(
      filters.sortBy,
      filters.sortOrder
    );

    const responses = await FormResponse.find(query)
      .populate("userId", "email")
      .sort(sortOptions)
      .select(this.SummarySelectResponseField)
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit);

    const totalCount = await FormResponse.countDocuments(query);

    return {
      responses,
      pagination: ResponseValidationService.createPaginationResponse(
        filters.page,
        filters.limit,
        totalCount
      ),
    };
  }

  static async getUserResponses({
    page,
    limit,
    user,
    formId,
  }: {
    page: number;
    limit: number;
    user: string;
    formId: string;
  }) {
    const skip = (page - 1) * limit;

    const query: RootFilterQuery<FormResponseType> = {
      $and: [
        { formId },
        {
          $or: [{ user }, { respondentEmail: user }],
        },
      ],
    };
    const responses = await FormResponse.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await FormResponse.countDocuments(query);

    return {
      responses,
      pagination: ResponseValidationService.createPaginationResponse(
        page,
        limit,
        totalCount
      ),
    };
  }

  static async getGuestResponses(formId: string) {
    return await FormResponse.find({
      $and: [{ formId }, { userId: null }],
    });
  }

  static async getPublicFormData(
    formId: string,
    page: number = 1,
    req: Request,
    res: Response
  ) {
    const form = await Form.findById(formId)
      .select("title type setting totalpage totalscore")
      .lean();

    if (!form) {
      throw new Error("Form not found");
    }

    if (form.setting?.acceptResponses === false) {
      throw new Error("Form is no longer accepting responses");
    }

    //Verify respodent brower fingerprinting for single response form (Public form)
    if (form.setting?.submitonce && !form.setting.email) {
      const respondentFingerprint =
        FingerprintService.extractFingerprintFromRequest(req);
      const respondentIP = FingerprintService.getClientIP(req);

      const isResponse = await FormResponse.findOne({
        respondentFingerprint,
        respondentIP,
      })
        .select(
          "_id totalScore isCompleted submittedAt respondentEmail respondentName"
        )
        .lean();

      if (isResponse) {
        return res.status(200).json({
          data: {
            submittedResult: {
              message: "You already submitted response",
              ...isResponse,
              formId: undefined,
              maxScore: form.totalscore,
            },
          },
        });
      }
    }

    const contents = await Content.find({ $and: [{ formId }, { page }] })
      .select(
        "_id qIdx title type text multiple selection checkbox rangedate rangenumber date require page conditional parentcontent score"
      )
      .lean()
      .sort({ idx: 1 });

    const formattedContents = contents.map((content) => ({
      ...content,
      parentcontent:
        content.parentcontent?.qId === content._id.toString()
          ? undefined
          : content.parentcontent,
      answer: undefined,
    }));

    return {
      ...form,
      contentIds: undefined,
      contents: formattedContents,
    };
  }

  static async deleteResponse(responseId: string) {
    return await FormResponse.findByIdAndDelete(responseId);
  }

  static async bulkDeleteResponses(responseIds: string[], formId: string) {
    // Verify all responses exist and belong to the form
    const responses = await FormResponse.find({
      _id: { $in: responseIds },
      formId: formId,
    });

    if (responses.length !== responseIds.length) {
      throw new Error(
        "Some responses don't exist or don't belong to this form"
      );
    }

    const deleteResult = await FormResponse.deleteMany({
      _id: { $in: responseIds },
      formId: formId,
    });

    return {
      deletedCount: deleteResult.deletedCount,
    };
  }
}
