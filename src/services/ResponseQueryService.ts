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
  AnswerKey,
  ChoiceQuestionType,
  ContentType,
  DetailContentSelection,
  QuestionType,
} from "../model/Content.model";
import { ResponseValidationService } from "./ResponseValidationService";
import { FingerprintService } from "../utilities/fingerprint";
import { Response } from "express";
import { CustomRequest } from "../types/customType";
import {
  AddQuestionNumbering,
  contentTitleToString,
  formatDateToDDMMYYYY,
  FormatToGeneralDate,
  ReturnCode,
} from "../utilities/helper";
import {
  formatResponseValue,
  getLastQuestionIdx,
} from "../utilities/formHelpers";
import {} from "../utilities/helper";

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
    responses: FormResponseType[],
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

            _id: undefined,
            formId: undefined,
            responseId: existingResponse._id,
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

    // Get cumulative question count from previous pages for proper numbering
    const lastQuestionIdx = await getLastQuestionIdx(formObjectId, page);

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
      if (isValidObjectId(id)) {
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
      .select("-rangedate -date -rangenumber")
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

    //All require question must have an max score
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
    // Early validation with fast path
    const invalidQuestion = questions.find((q) => !q._id);
    if (invalidQuestion) {
      throw new Error("Invalid Question");
    }

    // Build response map once - O(n) instead of O(n*m) lookups
    const responseMap = new Map<string, ResponseSetType>();
    for (let i = 0; i < responseset.length; i++) {
      const r = responseset[i];
      responseMap.set(r.question.toString(), r);
    }

    const filterHidden = options?.filterHidden ?? false;
    const questionsLength = questions.length;
    const result: Array<ResponseSetType> = [];

    // Pre-allocate estimated capacity
    result.length = 0;

    for (let i = 0; i < questionsLength; i++) {
      const question = questions[i];
      const questionId = question._id!.toString();
      const existingResponse = responseMap.get(questionId);

      // Handle conditional question filtering
      if (filterHidden && question.parentcontent) {
        const parentResponse = responseMap.get(
          question.parentcontent.qId
        )?.response;

        if (parentResponse !== undefined) {
          const shouldShow = this.shouldShowConditionalQuestion(
            parentResponse,
            question.parentcontent.optIdx
          );
          if (!shouldShow && !existingResponse) continue;
        } else if (!existingResponse) {
          continue;
        }
      }

      // Cache title conversion - used in both branches
      const convertedTitle = contentTitleToString(question.title);

      // Handle questions without responses
      if (!existingResponse) {
        result.push({
          question: {
            ...question,
            title: convertedTitle as never,
          },
          response: "" as ResponseAnswerType,
        });
        continue;
      }

      // Process response with question context
      const processedResponse = this.processResponseValue(
        question,
        existingResponse.response
      );

      // Process answer key for date types
      const processedAnswer = this.processAnswerKey(question);

      result.push({
        ...existingResponse,
        response: processedResponse as never,
        question: {
          ...question,
          answer: processedAnswer,
          title: convertedTitle as never,
        },
      });
    }

    return result;
  }

  /**
   * Process response value based on question type
   *
   */
  private static processResponseValue(
    question: ContentType,
    response: ResponseAnswerType | ResponseAnswerReturnType
  ):
    | ResponseAnswerType
    | ResponseAnswerReturnType
    | { key: number | number[]; val: string | string[] | undefined } {
    // Get choice options if this is a choice-based question
    const choiceOptions = question[question.type as keyof ContentType] as
      | ChoiceQuestionType[]
      | undefined;

    // Handle choice questions
    if (Array.isArray(choiceOptions) && response !== undefined) {
      if (typeof response === "number") {
        const selectedOption = choiceOptions.find(
          (opt) => opt.idx === response
        );
        return {
          key: response,
          val: selectedOption?.content,
        };
      }

      if (Array.isArray(response)) {
        const responseSet = new Set(response as number[]);
        const selectedContents = choiceOptions
          .filter((opt) => responseSet.has(opt.idx))
          .map((opt) => opt.content);

        return {
          key: response,
          val: selectedContents,
        };
      }

      // Pass through other response types
      return response;
    }

    // Format non-choice responses
    return formatResponseValue({
      response: response as ResponseAnswerType,
      questionType: question.type,
    });
  }

  /**
   * Process answer key for date-type questions
   * Returns formatted answer object or original answer
   */
  private static processAnswerKey(
    question: ContentType
  ): typeof question.answer {
    const questionType = question.type;
    const answer = question.answer;

    if (!answer) {
      return answer;
    }

    // Handle date questions
    if (questionType === QuestionType.Date) {
      return {
        ...answer,
        answer: formatDateToDDMMYYYY(
          answer.answer as unknown as string
        ) as unknown as never,
      };
    }

    // Handle range date questions
    if (questionType === QuestionType.RangeDate) {
      const rangeAnswer = answer.answer as unknown as {
        start: string;
        end: string;
      };
      return {
        ...answer,
        answer: {
          start: formatDateToDDMMYYYY(rangeAnswer?.start),
          end: formatDateToDDMMYYYY(rangeAnswer?.end),
        } as unknown as never,
      };
    }

    // Return original answer for other types
    return answer;
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
