import { RootFilterQuery, Types } from "mongoose";
import { CustomRequest, UserToken } from "../types/customType";
import { Request, Response } from "express";
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
    fingerprint?: string;
    ipAddress?: string;
    userId?: string;
    guestEmail?: string;
    submittedAt?: Date;
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
  static async hasRespondent(
    formId: string,
    options: RespondentCheckOptions
  ): Promise<RespondentCheckResult> {
    try {
      const {
        fingerprint,
        ipAddress,
        userId,
        guestEmail,
        requireExactMatch = false,
        includeFallbackChecks = true,
      } = options;

      // Validate input
      if (!formId || !Types.ObjectId.isValid(formId)) {
        throw new Error("Invalid form ID provided");
      }

      // Strategy 1: Check by authenticated user ID (highest confidence)
      if (userId && Types.ObjectId.isValid(userId)) {
        const userResponse = await FormResponse.findOne({
          formId: new Types.ObjectId(formId),
          userId: new Types.ObjectId(userId),
        })
          .select("_id submittedAt")
          .lean();

        if (userResponse) {
          return {
            hasResponded: true,
            responseId: userResponse._id.toString(),
            trackingMethod: "user_id",
            confidence: "high",
            metadata: {
              userId,
              submittedAt: userResponse.submittedAt,
            },
          };
        }
      }

      // Strategy 2: Check by guest email (high confidence for guest users)
      if (guestEmail) {
        const emailResponse = await FormResponse.findOne({
          formId: new Types.ObjectId(formId),
          "guest.email": guestEmail.toLowerCase().trim(),
        })
          .select("_id submittedAt guest.email")
          .lean();

        if (emailResponse) {
          return {
            hasResponded: true,
            responseId: emailResponse._id.toString(),
            trackingMethod: "guest_email",
            confidence: "high",
            metadata: {
              guestEmail,
              submittedAt: emailResponse.submittedAt,
            },
          };
        }
      }

      // Strategy 3: Check by fingerprint + IP combination (medium-high confidence)
      if (fingerprint && ipAddress) {
        const fingerprintIpResponse = await FormResponse.findOne({
          formId: new Types.ObjectId(formId),
          respondentFingerprint: fingerprint,
          respondentIP: ipAddress,
        })
          .select(
            "_id submittedAt respondentFingerprint respondentIP fingerprintStrength"
          )
          .lean();

        if (fingerprintIpResponse) {
          return {
            hasResponded: true,
            responseId: fingerprintIpResponse._id.toString(),
            trackingMethod: "fingerprint_and_ip",
            confidence: "high",
            metadata: {
              fingerprint,
              ipAddress,
              submittedAt: fingerprintIpResponse.submittedAt,
              fingerprintStrength: fingerprintIpResponse.fingerprintStrength,
            },
          };
        }
      }

      if (requireExactMatch || !includeFallbackChecks) {
        return {
          hasResponded: false,
          trackingMethod: "none",
          confidence: "high",
        };
      }

      // Strategy 4: Fallback - Check by fingerprint only (medium confidence)
      if (fingerprint) {
        const fingerprintResponse = await FormResponse.findOne({
          formId: new Types.ObjectId(formId),
          respondentFingerprint: fingerprint,
        })
          .select(
            "_id submittedAt respondentFingerprint respondentIP fingerprintStrength"
          )
          .lean();

        if (fingerprintResponse) {
          return {
            hasResponded: true,
            responseId: fingerprintResponse._id.toString(),
            trackingMethod: "fingerprint",
            confidence: "medium",
            metadata: {
              fingerprint,
              ipAddress: fingerprintResponse.respondentIP,
              submittedAt: fingerprintResponse.submittedAt,
              fingerprintStrength: fingerprintResponse.fingerprintStrength,
            },
          };
        }
      }

      // Strategy 5: Fallback - Check by IP only (low confidence)
      if (ipAddress) {
        const ipResponse = await FormResponse.findOne({
          formId: new Types.ObjectId(formId),
          respondentIP: ipAddress,
        })
          .select("_id submittedAt respondentIP respondentFingerprint")
          .sort({ submittedAt: -1 }) // Get most recent if multiple
          .lean();

        if (ipResponse) {
          return {
            hasResponded: true,
            responseId: ipResponse._id.toString(),
            trackingMethod: "ip",
            confidence: "low",
            metadata: {
              ipAddress,
              fingerprint: ipResponse.respondentFingerprint,
              submittedAt: ipResponse.submittedAt,
            },
          };
        }
      }

      return {
        hasResponded: false,
        trackingMethod: "none",
        confidence: "high",
        metadata: {
          fingerprint,
          ipAddress,
          userId,
          guestEmail,
        },
      };
    } catch (error) {
      console.error("Error checking respondent:", {
        formId,
        options,
        error: error instanceof Error ? error.message : error,
      });
      throw new Error(
        `Failed to check respondent status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async hasRespondentResponse(
    formId: string,
    fingerprint: string,
    respondentIp: string
  ): Promise<boolean> {
    console.warn(
      "hasRespondentResponse is deprecated. Use hasRespondent() instead."
    );

    try {
      const result = await this.hasRespondent(formId, {
        fingerprint,
        ipAddress: respondentIp,
        requireExactMatch: true,
        includeFallbackChecks: false,
      });

      return result.hasResponded;
    } catch (error) {
      console.error("Check for response", error);
      throw new Error("Error occurred while checking respondent response");
    }
  }

  static extractTrackingOptions(
    req: Request | CustomRequest,
    additionalOptions: Partial<RespondentCheckOptions> = {}
  ): RespondentCheckOptions {
    const options: RespondentCheckOptions = { ...additionalOptions };

    // Extract user ID from authenticated request
    if ("user" in req && req.user && req.user.sub) {
      options.userId = req.user.sub.toString();
    }

    // Extract guest email from request body
    if (req.body?.guest?.email) {
      options.guestEmail = req.body.guest.email;
    }

    // Extract fingerprint from headers or body
    if (req.headers["x-fingerprint"]) {
      options.fingerprint = req.headers["x-fingerprint"] as string;
    } else if (req.body?.fingerprint) {
      options.fingerprint = req.body.fingerprint;
    }

    // Extract IP address
    const clientIP =
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      (req.headers["x-client-ip"] as string);

    if (clientIP) {
      options.ipAddress = clientIP;
    }

    return options;
  }

  static async hasRespondentFromRequest(
    formId: string,
    req: Request | CustomRequest,
    options: Partial<RespondentCheckOptions> = {}
  ): Promise<RespondentCheckResult> {
    const trackingOptions = this.extractTrackingOptions(req, options);
    return this.hasRespondent(formId, trackingOptions);
  }

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
    res: Response
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
    res: Response
  ): Promise<any> {
    try {
      const response = await FormResponse.findById(responseId).populate(
        "formId"
      );

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
    const query: RootFilterQuery<FormResponseType> = {
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
    totalCount: number
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
