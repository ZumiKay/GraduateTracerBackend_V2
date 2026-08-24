import { Types, QueryFilter } from "mongoose";
import { CustomRequest, UserToken } from "../types/customType";
import { Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Form from "../model/Form.model";
import FormResponse, {
  FormResponseType,
  ResponseCompletionStatus,
} from "../model/Response.model";
import { hasFormAccess } from "../utilities/formHelpers";
import { ResponseFilterType } from "./ResponseQueryService";

export interface RespondentCheckResult {
  hasResponded: boolean;
  responseId?: string;
  trackingMethod:
    | "fingerprint"
    | "ip"
    | "fingerprint_and_ip"
    | "user_id"
    | "guest_email"
    | "none";
  confidence: "high" | "medium" | "low";
  metadata?: {
    submittedAt?: Date;
    fingerprint?: string;
    ipAddress?: string;
    userId?: string;
    guestEmail?: string;
    fingerprintStrength?: number;
  };
}

export interface RespondentCheckOptions {
  fingerprint?: string;
  ipAddress?: string;
  userId?: string;
  guestEmail?: string;
  requireExactMatch?: boolean;
  includeFallbackChecks?: boolean;
}

export class ResponseValidationService {
  static async validateRequest({
    req,
    res,
    requireFormId = true,
    requireUserInfo,
    noToken,
  }: {
    req: CustomRequest;
    res: Response;
    requireFormId?: boolean;
    requireUserInfo?: boolean;
    noToken?: boolean;
  }): Promise<{
    user: UserToken | null;
    formId?: string;
    page?: number;
    limit?: number;
    isValid: boolean;
    uid?: string;
    rid?: string;
    message?: string;
    emails?: Array<string>;
  }> {
    const user = req.user;

    if (!user && !noToken) {
      res.status(401).json(ReturnCode(401, "Unauthorized"));
      return { user: null, isValid: false };
    }

    if (requireFormId) {
      const formId =
        (req.query.formId as string) ||
        (req.params.formId as string) ||
        req.body.formId;

      if (!formId && user) {
        res.status(400).json(ReturnCode(400, "Form ID is required"));
        return { user, isValid: false };
      }

      return {
        user: user ?? null,
        formId,
        page: Number(req.query.page || req.query.p) || 1,
        limit: Number(req.query.limit || req.query.lt) || 10,
        uid: (req.query.uid as string) ?? undefined,
        rid: (req.query.rid as string) ?? undefined,
        isValid: true,
        message: req?.body?.message,
        emails: req?.body?.emails,
      };
    }

    if (requireUserInfo) {
      if (!req.query.uid && user) {
        res.status(400).json(ReturnCode(400));
        return { user, isValid: false };
      }
    }

    return {
      user: user ?? null,
      page: Number(req.query.page || req.query.p) || 1,
      limit: Number(req.query.limit || req.query.lt) || 10,
      uid: (req.query.uid as string) ?? undefined,
      isValid: true,
    };
  }

  static async validateFormAccess(
    formId: string,
    userId: string,
    res: Response,
  ): Promise<any> {
    try {
      const form = await Form.findById(new Types.ObjectId(formId)).lean();

      if (!form) {
        res.status(404).json(ReturnCode(404, "Form not found"));
        return null;
      }

      if (!hasFormAccess(form, new Types.ObjectId(userId))) {
        res.status(403).json(ReturnCode(403, "Access denied"));
        return null;
      }

      return form;
    } catch (error) {
      console.error("Form access validation error:", error);
      res.status(500).json(ReturnCode(500, "Failed to validate form access"));
      return null;
    }
  }

  static async validateResponseAccess(
    responseId: string,
    userId: string,
    res: Response,
  ): Promise<any> {
    try {
      const response =
        await FormResponse.findById(responseId).populate("formId");

      if (!response) {
        res.status(404).json(ReturnCode(404, "Response not found"));
        return null;
      }

      const form = await Form.findById(response.formId).lean();

      if (!form) {
        res.status(404).json(ReturnCode(404, "Form not found"));
        return null;
      }

      if (!hasFormAccess(form, new Types.ObjectId(userId))) {
        res.status(403).json(ReturnCode(403, "Access denied"));
        return null;
      }

      return { response, form };
    } catch (error) {
      console.error("Response access validation error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to validate response access"));
      return null;
    }
  }

  static buildFilterQuery(filters: ResponseFilterType) {
    const query: QueryFilter<FormResponseType> = {
      formId: new Types.ObjectId(filters.formId),
    };

    // Search term filter (searches in respondent email and name)
    if (filters.searchTerm) {
      const searchRegex = { $regex: filters.searchTerm, $options: "i" };
      query.$or = [
        { respondentEmail: searchRegex },
        { respondentName: searchRegex },
        { "guest.email": searchRegex },
        { "guest.name": searchRegex },
      ];
    }

    // Completion status filter
    if (filters.completionStatus) {
      switch (filters.completionStatus) {
        case ResponseCompletionStatus.completed:
          query.isCompleted = true;
          break;
        case ResponseCompletionStatus.partial:
          query.$and = [
            { isCompleted: { $ne: true } },
            { submittedAt: { $exists: true } },
          ];
          break;
        case ResponseCompletionStatus.abandoned:
          query.$and = [
            { isCompleted: { $ne: true } },
            { submittedAt: { $exists: false } },
          ];
          break;
      }
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.submittedAt = {};
      if (filters.startDate)
        query.submittedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        // Add 23:59:59 to include the entire end date
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.submittedAt.$lte = endDate;
      }
    }

    // Score range filter
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      query.totalScore = {};
      if (filters.minScore !== undefined && filters.minScore !== "") {
        query.totalScore.$gte = Number(filters.minScore);
      }
      if (filters.maxScore !== undefined && filters.maxScore !== "") {
        query.totalScore.$lte = Number(filters.maxScore);
      }
    }

    //Id and userId filter
    if (filters.id || filters.userId) {
      query._id = filters.id;
      query.userId = filters.userId;
    }

    return query;
  }

  static buildSortOptions(sortBy?: string, sortOrder?: string) {
    const sortOptions: any = {};
    if (sortBy) {
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    } else {
      sortOptions.submittedAt = -1;
    }
    return sortOptions;
  }

  static createPaginationResponse(
    page: number,
    limit: number,
    totalCount: number,
  ) {
    return {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
    };
  }
}
