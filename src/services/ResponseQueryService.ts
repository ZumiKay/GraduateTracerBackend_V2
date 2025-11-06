import { RootFilterQuery, Types } from "mongoose";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
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
import { contentTitleToString } from "../utilities/helper";

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

    return {
      responses,
      pagination: ResponseValidationService.createPaginationResponse(
        page,
        limit,
        totalCount
      ),
    };
  }

  static async getResponsesByFormId(
    formId: string,
    page: number,
    limit: number
  ) {
    return this.fetchResponsesWithPagination({ formId }, page, limit);
  }

  static async getResponsesWithFilters(filters: ResponseFilterType) {
    const query = ResponseValidationService.buildFilterQuery(filters);
    const sortOptions = ResponseValidationService.buildSortOptions(
      filters.sortBy,
      filters.sortOrder
    );

    return this.fetchResponsesWithPagination(
      query,
      filters.page,
      filters.limit,
      sortOptions,
      this.SUMMARY_SELECT_RESPONSE_FIELD,
      ["userId email"]
    );
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

    const form = await Form.findById(formId)
      .select("title type setting totalpage totalscore")
      .lean();

    if (!form) {
      throw new Error("Form not found");
    }

    if (form.setting?.acceptResponses === false) {
      throw new Error("Form is no longer accepting responses");
    }

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

    const contents = await Content.find({
      formId: new Types.ObjectId(formId),
      page,
    })
      .select(
        "_id qIdx title type text multiple selection checkbox rangedate rangenumber date require page conditional parentcontent score"
      )
      .sort({ idx: 1 })
      .lean();

    return {
      ...form,
      contentIds: undefined,
      contents: contents.map((content) => ({
        ...content,
        parentcontent:
          content.parentcontent?.qId === content._id.toString()
            ? undefined
            : content.parentcontent,
        answer: undefined,
      })),
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

  static async GetResponseById({ id }: { id: string }) {
    const isResponse = await FormResponse.findById(id)
      .select(`${this.SUMMARY_SELECT_RESPONSE_FIELD} responseset`)
      .lean()
      .exec();

    if (!isResponse) return null;

    const questionIds = isResponse.responseset.map((i) => i.question);
    const contents = await Content.find({
      _id: { $in: questionIds },
    })
      .select(
        "_id title type qIdx conditional parentcontent checkbox multiple selection score"
      )
      .lean();

    return {
      ...isResponse,
      responseset: this.ResponsesetProcessQuestion(
        contents,
        isResponse.responseset
      ),
    };
  }

  private static ResponsesetProcessQuestion(
    questions: Array<ContentType>,
    responseset: Array<ResponseSetType>
  ) {
    if (questions.some((i) => !i._id)) {
      throw new Error("Invalid Question");
    }

    const responseMap = new Map(
      responseset.map((r) => [r.question.toString(), r])
    );
    const result: Array<ResponseSetType> = [];

    for (const question of questions) {
      if (!question._id) continue;

      const isResponse = responseMap.get(question._id.toString());
      if (!isResponse) continue;
      const isChoiceQuestion = question[
        question.type as keyof ContentType
      ] as ChoiceQuestionType[];
      const response = isResponse.response;

      //Result mutation
      result.push({
        ...isResponse,
        response: (isChoiceQuestion && response
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
}
