import { isValidObjectId, RootFilterQuery, Types } from "mongoose";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
  RespondentType,
  ResponseAnswerType,
  ResponseAnswerReturnType,
} from "../model/Response.model";
import Form from "../model/Form.model";
import Content, {
  ChoiceQuestionType,
  ContentType,
} from "../model/Content.model";
import { ResponseValidationService } from "./ResponseValidationService";
import { FingerprintService } from "../utilities/fingerprint";
import { Response } from "express";
import { CustomRequest } from "../types/customType";
import {
  AddQuestionNumbering,
  contentTitleToString,
  ReturnCode,
} from "../utilities/helper";

export interface GroupResponseListItemType {
  respondentEmail?: string;
  respondentName?: string;
  respondentType?: RespondentType;
  responseCount?: number;
  responseIds?: Array<string>;
}

export interface ResponseFilterType {
  formId: string;
  searchTerm?: string;
  completionStatus?: string;
  startDate?: string;
  endDate?: string;
  minScore?: string;
  maxScore?: string;
  sortBy?: string;
  sortOrder?: string;
  email?: string;
  page: number;
  limit: number;
  id?: string;
  userId?: string;
  resIdx?: string;
  group?: string; // Add group parameter
}

export class ResponseQueryService {
  private static readonly SUMMARY_SELECT_RESPONSE_FIELD =
    "_id respondentEmail respondentName respondentType submittedAt isCompleted completionStatus createdAt";

  private static async fetchResponsesWithPagination(
    query: RootFilterQuery<FormResponseType>,
    page: number,
    limit: number,
    sortOptions?: Record<string, 1 | -1>,
    selectFields?: string,
    populate?: string[]
  ) {
    const skip = (page - 1) * limit;

    let queryBuilder = FormResponse.find(query);

    if (populate) {
      queryBuilder = queryBuilder.populate(populate);
    }
    if (sortOptions) {
      queryBuilder = queryBuilder.sort(sortOptions);
    }

    queryBuilder = queryBuilder
      .select(selectFields || this.SUMMARY_SELECT_RESPONSE_FIELD)
      .skip(skip)
      .limit(limit)
      .lean() as never;

    const [responses, totalCount] = await Promise.all([
      queryBuilder,
      FormResponse.countDocuments(query),
    ]);

    // Extract formId from query if it exists
    const formId = (query as any).formId;

    // Get response counts for each unique respondentEmail
    const responsesWithCount = await this.addResponseCountByEmail(
      responses,
      formId
    );

    return {
      responses: responsesWithCount,
      pagination: ResponseValidationService.createPaginationResponse(
        page,
        limit,
        totalCount
      ),
    };
  }

  /**
   * Add response count for each respondentEmail
   * @param responses - Array of response objects
   * @param formId - Form ID to filter responses by
   * @returns Responses with responseCount field added
   */
  private static async addResponseCountByEmail(
    responses: any[],
    formId?: Types.ObjectId | string
  ) {
    if (!responses || responses.length === 0) {
      return responses;
    }

    // Extract unique respondent emails
    const emails = [
      ...new Set(
        responses
          .map((r) => r.respondentEmail)
          .filter((email): email is string => !!email)
      ),
    ];

    if (emails.length === 0) {
      // If no emails, return responses with count 0
      return responses.map((r) => ({ ...r, responseCount: 0 }));
    }

    // Build aggregation pipeline to count responses per email

    const emailCounts = await FormResponse.aggregate([
      {
        $match: {
          respondentEmail: { $in: emails },
          ...(formId && { formId: formId }),
        },
      },
      {
        $group: {
          _id: "$respondentEmail",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map for quick lookup
    const emailCountMap = new Map(
      emailCounts.map((item) => [item._id, item.count])
    );

    // Add responseCount to each response
    return responses.map((response) => ({
      ...response,
      responseCount: response.respondentEmail
        ? emailCountMap.get(response.respondentEmail) || 0
        : 0,
    }));
  }

  static async getResponsesByFormId(
    formId: string,
    page: number,
    limit: number
  ) {
    return this.fetchResponsesWithPagination({ formId }, page, limit);
  }

  /**
  Get Response by UserId and With Pagination for multiple responses
  @RequestParam formId | page | resIdx | useId
  @page for navigate within form
  @resIdx resIdx for navigate user responses
  */
  static async getResponsebyUserIdWithPagination(
    req: CustomRequest,
    res: Response
  ) {
    const { formId, page, resIdx, userId } =
      req.params as unknown as ResponseFilterType;

    // Validate parameters
    if (!isValidObjectId(formId)) {
      return res.status(400).json(ReturnCode(400, "Invalid form ID"));
    }

    const pageNum = Number(page);
    const responseIdx = Number(resIdx);
    const limit = 1; // One response at a time based on resIdx

    if (isNaN(pageNum) || isNaN(responseIdx) || responseIdx < 0) {
      return res
        .status(400)
        .json(ReturnCode(400, "Invalid page or response index"));
    }

    try {
      const query = {
        formId: new Types.ObjectId(formId),
        userId,
      };

      const totalCount = await FormResponse.countDocuments(query);

      if (responseIdx >= totalCount) {
        return res
          .status(404)
          .json(ReturnCode(404, "Response index out of range"));
      }

      const response = await FormResponse.findOne(query)
        .skip(responseIdx)
        .limit(limit)
        .lean();

      if (!response) {
        return res.status(404).json(ReturnCode(404, "Response not found"));
      }

      const pagination = ResponseValidationService.createPaginationResponse(
        responseIdx + 1,
        limit,
        totalCount
      );

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          response,
          pagination,
        },
      });
    } catch (error) {
      console.log("Get response by userId", error);
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  }

  static async getResponsesWithFilters(filters: ResponseFilterType) {
    const query = ResponseValidationService.buildFilterQuery(filters);
    const sortOptions = ResponseValidationService.buildSortOptions(
      filters.sortBy,
      filters.sortOrder
    );

    // If group parameter is present, group by respondentEmail
    if (filters.group === "respondentEmail") {
      return this.getGroupedResponses(
        query,
        filters.page,
        filters.limit,
        sortOptions
      );
    }

    return this.fetchResponsesWithPagination(
      query,
      filters.page,
      filters.limit,
      sortOptions,
      this.SUMMARY_SELECT_RESPONSE_FIELD,
      ["userId email"]
    );
  }

  /**
   * Get responses grouped by respondent email
   */
  static async getGroupedResponses(
    query: RootFilterQuery<FormResponseType>,
    page: number,
    limit: number,
    sortOptions?: Record<string, 1 | -1>
  ) {
    const skip = (page - 1) * limit;

    // Aggregation pipeline to group responses by respondent email
    const pipeline: any[] = [
      { $match: query },
      {
        $group: {
          _id: "$respondentEmail",
          respondentEmail: { $first: "$respondentEmail" },
          respondentName: { $first: "$respondentName" },
          respondentType: { $first: "$respondentType" },
          responseCount: { $sum: 1 },
          responseIds: { $push: { $toString: "$_id" } },
          lastSubmittedAt: { $max: "$submittedAt" },
        },
      },
    ];

    // Apply sorting
    if (sortOptions) {
      pipeline.push({ $sort: sortOptions });
    } else {
      // Default sort by last submission date
      pipeline.push({ $sort: { lastSubmittedAt: -1 } });
    }

    // Count total groups
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await FormResponse.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Project final shape
    pipeline.push({
      $project: {
        _id: 0,
        respondentEmail: 1,
        respondentName: 1,
        respondentType: 1,
        responseCount: 1,
        responseIds: 1,
      },
    });

    const groupedResponses =
      await FormResponse.aggregate<GroupResponseListItemType>(pipeline);

    return {
      responses: groupedResponses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
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
    const query: RootFilterQuery<FormResponseType> = {
      formId,
      $or: [{ user }, { respondentEmail: user }],
    };

    return this.fetchResponsesWithPagination(query, page, limit, {
      submittedAt: -1,
    });
  }

  static async getGuestResponses(formId: string) {
    return FormResponse.find({
      formId,
      userId: null,
    }).lean();
  }

  static async getPublicFormData(
    formId: string,
    page: number = 1,
    req: CustomRequest,
    res: Response
  ) {
    if (!Types.ObjectId.isValid(formId)) {
      throw new Error("Invalid form ID");
    }

    const formObjectId = new Types.ObjectId(formId);

    // Parallel execution for better performance
    const [form, contents] = await Promise.all([
      Form.findById(formObjectId)
        .select("title type setting totalpage totalscore")
        .lean(),
      Content.find({
        formId: formObjectId,
        page,
      })
        .select(
          "_id qIdx title type text multiple selection checkbox rangedate rangenumber date require page conditional parentcontent score"
        )
        .sort({ qIdx: 1 })
        .lean(),
    ]);

    if (!form) {
      throw new Error("Form not found");
    }

    if (form.setting?.acceptResponses === false) {
      throw new Error("Form is no longer accepting responses");
    }

    //Check if the user has submitted (Single Form)
    if (form.setting?.submitonce) {
      const existingResponse = await this.checkExistingResponse(
        formId,
        form.setting.email as boolean,
        req
      );

      if (existingResponse) {
        return {
          ...form,
          isResponsed: {
            message: "You already submitted response",
            ...existingResponse,
            formId: undefined,
            maxScore: form.totalscore,
          },
        };
      }
    }

    // Clean up content data
    const resultContents = contents.map((content) => ({
      ...content,
      parentcontent:
        content.parentcontent?.qId === content._id.toString()
          ? undefined
          : content.parentcontent,
      answer: undefined,
    }));

    // Compute cumulative question count from previous pages
    // Count only parent questions (non-conditional) from pages before current page
    let lastQuestionIdx = 0;
    if (page > 1) {
      lastQuestionIdx = await Content.countDocuments({
        formId: formObjectId,
        page: { $lt: page },
        $or: [{ parentcontent: { $exists: false } }, { parentcontent: null }],
      });
    }

    return {
      ...form,
      contentIds: undefined,
      contents: AddQuestionNumbering({
        questions: resultContents,
        lastIdx: lastQuestionIdx,
      }),
    };
  }

  private static async checkExistingResponse(
    formId: string,
    requireEmail: boolean,
    req: CustomRequest
  ) {
    const query: RootFilterQuery<FormResponseType> = {
      formId: new Types.ObjectId(formId),
      respondentEmail: req.formsession?.data?.email,
    };

    if (!requireEmail) {
      query.respondentFingerprint =
        FingerprintService.extractFingerprintFromRequest(req);
      query.respondentIP = FingerprintService.getClientIP(req);
    }

    return FormResponse.findOne(query)
      .select(
        "_id totalScore isCompleted submittedAt respondentEmail respondentName"
      )
      .lean();
  }

  static async deleteResponse(responseId: string) {
    return FormResponse.findByIdAndDelete(responseId);
  }

  static async bulkDeleteResponses(responseIds: string[], formId: string) {
    if (!Types.ObjectId.isValid(formId)) {
      throw new Error(`Invalid form ID: ${formId}`);
    }

    const { validObjectIds, invalidIds } = this.validateObjectIds(responseIds);

    if (invalidIds.length > 0) {
      throw new Error(
        `Invalid response ID(s): ${invalidIds.join(
          ", "
        )}. Expected valid MongoDB ObjectIds.`
      );
    }

    if (validObjectIds.length === 0) {
      throw new Error("No valid response IDs provided");
    }

    const formObjectId = new Types.ObjectId(formId);
    const responseCount = await FormResponse.countDocuments({
      _id: { $in: validObjectIds },
      formId: formObjectId,
    });

    if (responseCount !== validObjectIds.length) {
      throw new Error(
        "Some responses don't exist or don't belong to this form"
      );
    }

    const deleteResult = await FormResponse.deleteMany({
      _id: { $in: validObjectIds },
      formId: formObjectId,
    });

    return {
      deletedCount: deleteResult.deletedCount,
    };
  }

  private static validateObjectIds(ids: string[]) {
    const validObjectIds: Types.ObjectId[] = [];
    const invalidIds: string[] = [];

    for (const id of ids) {
      if (Types.ObjectId.isValid(id)) {
        validObjectIds.push(new Types.ObjectId(id));
      } else {
        invalidIds.push(id);
      }
    }

    return { validObjectIds, invalidIds };
  }

  static async GetResponseById({ id, formId }: { id: string; formId: string }) {
    const isResponse = await FormResponse.findById(id)
      .select(`${this.SUMMARY_SELECT_RESPONSE_FIELD} responseset formId`)
      .lean();

    if (!isResponse) return null;

    const contents = await Content.find({
      formId,
    })
      .select(
        "_id title type require qIdx conditional parentcontent checkbox multiple selection score"
      )
      .sort({ qIdx: 1 })
      .lean();

    // Get response count for this respondent email
    let responseCount = 0;
    if (isResponse.respondentEmail && isResponse.formId) {
      responseCount = await FormResponse.countDocuments({
        formId: isResponse.formId,
        respondentEmail: isResponse.respondentEmail,
      });
    }

    //Require must have an score
    const isScoreable = !contents.some(
      (question) => question.require && !question.score
    );

    return {
      ...isResponse,
      responseCount,
      isScoreable,
      responseset: this.ResponsesetProcessQuestion(
        AddQuestionNumbering({
          questions: contents as Array<ContentType>,
        }),
        isResponse.responseset
      ),
    };
  }

  /**
   * Process questions with responses and optionally filter hidden conditional questions
   * @param questions - Array of questions
   * @param responseset - Array of responses
   * @param options - Optional configuration
   * @param options.filterHidden - If true, filter out conditional questions that don't match responses
   * @returns Processed response set with question details
   */
  public static ResponsesetProcessQuestion(
    questions: Array<ContentType>,
    responseset: Array<ResponseSetType>,
    options?: { filterHidden?: boolean }
  ) {
    if (questions.some((i) => !i._id)) {
      throw new Error("Invalid Question");
    }

    const responseMap = new Map(
      responseset.map((r) => [r.question.toString(), r])
    );
    const result: Array<ResponseSetType> = [];

    // Build a map of parent responses for conditional question checking
    const parentResponseMap = new Map<
      string,
      ResponseAnswerType | ResponseAnswerReturnType
    >();
    if (options?.filterHidden) {
      for (const resp of responseset) {
        parentResponseMap.set(resp.question.toString(), resp.response);
      }
    }

    for (const question of questions) {
      if (!question._id) continue;

      const isResponse = responseMap.get(question._id.toString());

      // Check if this is a conditional question that should be hidden
      if (options?.filterHidden && question.parentcontent) {
        const parentResponse = parentResponseMap.get(
          question.parentcontent.qId
        );

        // Skip this question if parent response doesn't match the required option
        // AND there's no response (meaning it was hidden from the user)
        if (parentResponse !== undefined) {
          const shouldShow = this.shouldShowConditionalQuestion(
            parentResponse,
            question.parentcontent.optIdx
          );

          if (!shouldShow && !isResponse) {
            continue; // Skip this hidden question that has no response
          }
        } else if (!isResponse) {
          // If no parent response exists and no response for this question, skip it
          continue;
        }
      }

      // Add question to response even if no response exists
      if (!isResponse) {
        result.push({
          question: {
            ...question,
            title: contentTitleToString(question.title) as never,
          },
          response: "" as ResponseAnswerType, // Empty string instead of undefined
        });
        continue;
      }

      const isChoiceQuestion = question[
        question.type as keyof ContentType
      ] as ChoiceQuestionType[];
      const response = isResponse.response;

      //Result mutation
      result.push({
        ...isResponse,
        response: (isChoiceQuestion && response !== undefined
          ? typeof response === "number"
            ? {
                key: response,
                val: (isChoiceQuestion as ChoiceQuestionType[]).find(
                  (i) => i.idx === response
                )?.content,
              }
            : {
                key: response,
                val: isChoiceQuestion
                  .filter((i) => (response as number[]).includes(i.idx))
                  .map((i) => i.content),
              }
          : response) as never,
        question: {
          ...question,
          title: contentTitleToString(question.title) as never,
        },
      });
    }
    return result;
  }

  /**
   * Check if a conditional question should be shown based on parent response
   * @param parentResponse - The response value from the parent question
   * @param requiredOptIdx - The option index required to show the conditional question
   * @returns true if question should be shown, false otherwise
   */
  private static shouldShowConditionalQuestion(
    parentResponse: ResponseAnswerType | ResponseAnswerReturnType,
    requiredOptIdx: Number
  ): boolean {
    const requiredIdx = Number(requiredOptIdx);

    // Handle direct number response
    if (typeof parentResponse === "number") {
      return parentResponse === requiredIdx;
    }

    // Handle array of numbers (checkbox)
    if (Array.isArray(parentResponse)) {
      return parentResponse.includes(requiredIdx);
    }

    // Handle ResponseAnswerReturnType format
    if (
      typeof parentResponse === "object" &&
      parentResponse !== null &&
      "key" in parentResponse
    ) {
      const key = (parentResponse as any).key;
      if (typeof key === "number") {
        return key === requiredIdx;
      }
      if (Array.isArray(key)) {
        return key.includes(requiredIdx);
      }
    }

    return false;
  }
}
