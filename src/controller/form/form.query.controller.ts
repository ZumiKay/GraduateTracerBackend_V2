import { Response } from "express";
import { AddQuestionNumbering, ReturnCode } from "../../utilities/helper";
import Form, {
  DashboardTabType,
  FormType,
  TypeForm,
} from "../../model/Form.model";
import { CustomRequest, UserToken } from "../../types/customType";
import { Types, QueryFilter } from "mongoose";
import Content, {
  ContentType,
  DetailContentSelection,
  QuestionType,
} from "../../model/Content.model";
import User from "../../model/User.model";
import {
  isValidObjectIdString,
  validateAccess,
  projections,
} from "../../utilities/formHelpers";
import FormResponse from "../../model/Response.model";
import {
  FormValidationService,
  FormValidationSummary,
} from "../../services/FormValidationService";

export enum GetFilterTypeEnum {
  search = "search",
  type = "type",
  createdDate = "createddate",
  modifiedDate = "modifieddate",
  detail = "detail",
  user = "user",
  setting = "setting",
  solution = "solution",
  preview = "preview",
  total = "total",
  response = "response",
  analytics = "analytics",
  validation = "validation",
}

enum ValidationActionEnum {
  page = "page",
  submission = "submit",
  normal = "normal",
}

interface GetFilterFormParamType {
  ty?: GetFilterTypeEnum;
  q?: string;
  page?: string;
  limit?: string;
  tab?: DashboardTabType;
  type?: FormType;
  created?: string;
  updated?: string;
  action?: ValidationActionEnum;
}

export async function GetFilterForm(req: CustomRequest, res: Response) {
  try {
    const {
      ty,
      q,
      page = "1",
      limit = "5",
      tab,
      created,
      updated,
      action,
    } = req.query as GetFilterFormParamType;

    if (tab && !Object.values(DashboardTabType).includes(tab)) {
      return res.status(400).json(ReturnCode(400, "Invalid type or query"));
    }

    const p = Number(page ?? "1");
    const lt = Math.min(Number(limit), 50);
    const createdAt = created ? parseInt(created) : undefined;
    const updatedAt = updated ? parseInt(updated) : undefined;

    const user = req.user;

    if (!user) return res.status(401).json(ReturnCode(401));

    // Handle different query types with optimized logic
    switch (ty) {
      case GetFilterTypeEnum.detail:
      case GetFilterTypeEnum.solution:
      case GetFilterTypeEnum.preview:
        return await handleDetailQuery(
          res,
          ty,
          q as string,
          p,
          new Types.ObjectId(user?.sub),
        );
      case GetFilterTypeEnum.response:
      case GetFilterTypeEnum.analytics:
        return await handleShortFormInfo({
          res,
          id: q,
          userId: new Types.ObjectId(user?.sub),
        });

      case GetFilterTypeEnum.total:
        return await handleTotalQuery(res, q as string, user);

      case GetFilterTypeEnum.setting:
        return await handleSettingQuery(res, q as string, user);

      case GetFilterTypeEnum.user:
        if (
          (createdAt && ![1, -1].includes(createdAt)) ||
          (updatedAt && ![1, -1].includes(updatedAt))
        ) {
          return res
            .status(400)
            .json(ReturnCode(400, "Sort values must be 1 or -1"));
        }

        const userTab = tab || DashboardTabType.myform;
        return await handleUserQuery({
          p,
          lt,
          userId: new Types.ObjectId(user?.sub),
          tab: userTab,
          res,
          filter: {
            query: q,
            sort:
              createdAt || updatedAt
                ? {
                    createdAt,
                    updatedAt,
                  }
                : undefined,
          },
        });

      default:
        return res.status(400).json(ReturnCode(400));
    }
  } catch (error) {
    console.error(
      "Error in GetFilterForm:",
      error instanceof Error ? error.message : error,
    );
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

async function handleShortFormInfo({
  res,
  userId,
  id,
}: {
  res: Response;
  userId: Types.ObjectId;
  id?: string;
}) {
  if (!id || !isValidObjectIdString(id)) {
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));
  }

  const form = await Form.findById(id)
    .select(
      "_id title type totalpage totalscore user owners editors setting.email",
    )
    .lean()
    .exec();

  if (!form) {
    return res.status(404).json(ReturnCode(404, "Form not found"));
  }

  const isHasAccess = validateAccess(form, userId);

  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      _id: form._id,
      title: form.title,
      type: form.type,
      totalpage: form.totalpage,
      totalscore: form.totalscore,
      setting: form.setting,
      ...isHasAccess,
    },
  });
}

async function handleDetailQuery(
  res: Response,
  ty: GetFilterTypeEnum,
  q: string,
  p: number,
  user: Types.ObjectId,
) {
  if (!user) return res.status(401).json(ReturnCode(401));

  const query = isValidObjectIdString(q) ? { _id: q } : { title: q };

  const detailForm = await Form.findOne(query)
    .select(projections.detail)
    .lean();

  if (!detailForm)
    return res.status(404).json(ReturnCode(404, "No Form Found"));

  //Normal form can't have solution ty
  if (ty === GetFilterTypeEnum.solution && detailForm.type !== TypeForm.Quiz) {
    return res.status(404).json(ReturnCode(400, "Invalid Form"));
  }

  //Verfiy form acess
  const accessInfo = validateAccess(detailForm, user);
  if (!accessInfo.hasAccess)
    return res.status(403).json(ReturnCode(403, "Access denied"));

  //Fetch content procession
  const contentProjection =
    ty === GetFilterTypeEnum.solution
      ? `${DetailContentSelection} answer score hasAnswer isValidated isBonusScore useChildScoreSum`
      : DetailContentSelection;

  let validationSummary: FormValidationSummary | null = null;

  let resultContent = (await Content.find({
    formId: detailForm._id,
  })
    .select(contentProjection)
    .sort({ qIdx: 1 })
    .lean()) as unknown as Array<ContentType>;

  validationSummary = FormValidationService.validateForm(
    detailForm,
    resultContent,
    p,
    ty,
  );

  //Attach each question valdiation message
  resultContent = resultContent
    .filter((i) => i.page === p)
    .map((i) => ({
      ...i,
      //Issues message attach to each question
      validationWarning: FormValidationService.getValidationMessageByQId(
        validationSummary?.validationResults?.warnings ?? [],
        i._id?.toString() ?? i.qIdx,
      ).filter(Boolean),
      validationIssues: FormValidationService.getValidationMessageByQId(
        validationSummary?.validationResults?.errors ?? [],
        i._id?.toString() ?? i.qIdx,
      ).filter(Boolean),
    })) as never;

  const summaryData = await FormValidationService.getFormOverviewDataById({
    formId: detailForm._id,
    p,
  });

  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      ...detailForm,
      contents: AddQuestionNumbering({
        questions: resultContent.filter((i) => i.page === p),
        lastIdx: summaryData?.lastQuestionIdx,
      }), //Return only the selected page content
      contentIds: undefined,

      //Overall validation
      validation: validationSummary,
      ...summaryData,
      ...accessInfo, //User Role Of Form
    },
  });
}

/**
 * Fetch Summary of Form
 * - Total Question
 * - Total Score
 * - Total Page
 */
async function handleTotalQuery(res: Response, q: string, user: UserToken) {
  if (!user) return res.status(401).json(ReturnCode(401));
  if (!isValidObjectIdString(q))
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));

  const formdata = await Form.findById(q)
    .select(projections.total)
    .populate({ path: "user", select: "email", options: { lean: true } })
    .lean()
    .exec();
  if (!formdata) return res.status(404).json(ReturnCode(404, "Form not found"));

  const accessInfo = validateAccess(formdata, new Types.ObjectId(user.sub));
  if (!accessInfo.hasAccess)
    return res.status(403).json(ReturnCode(403, "Access denied"));

  const contentStats = await Content.aggregate([
    { $match: { formId: formdata._id } },
    {
      $group: {
        _id: null,
        totalQuestions: { $sum: 1 },
        totalConditions: {
          $sum: { $cond: [{ $ne: ["$parentcontent", true] }, 1, 0] },
        },
        totalScore: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$type", QuestionType.Text] },
                  { $not: { $ifNull: ["$parentcontent", false] } },
                ],
              },
              { $ifNull: ["$score", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const stats = contentStats[0] || {
    totalQuestions: 0,
    totalScore: 0,
    totalConditions: 0,
  };
  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      totalPage: formdata.totalpage ?? 0,
      totalScore: stats.totalScore,
      totalQuestion: stats.totalQuestions,
      totalConditions: stats.totalConditions,
      ...accessInfo,
    },
  });
}

async function handleSettingQuery(res: Response, q: string, user?: UserToken) {
  if (!user) return res.status(401).json(ReturnCode(401));
  if (!isValidObjectIdString(q))
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));

  const form = await Form.findById(q)
    .select(projections.setting)
    .populate({ path: "user", select: "email", options: { lean: true } })
    .lean()
    .exec();
  if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));

  const accessInfo = validateAccess(form, new Types.ObjectId(user.sub));
  if (!accessInfo.hasAccess)
    return res.status(403).json(ReturnCode(403, "Access denied"));

  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      _id: form._id,
      title: form.title,
      type: form.type,
      setting: form.setting,
      ...accessInfo,
    },
  });
}

async function handleUserQuery({
  p,
  userId,
  tab,
  res,
  lt,
  filter,
}: {
  p: number;
  userId: Types.ObjectId;
  tab: DashboardTabType;
  res: Response;
  lt: number;
  filter?: {
    query?: string;
    type?: FormType;
    sort?: {
      createdAt?: number;
      updatedAt?: number;
    };
  };
}) {
  try {
    // Validate input parameters
    if (!userId || !tab || p < 1 || lt < 1) {
      return res.status(400).json(ReturnCode(400));
    }

    const baseQuery = await buildBaseQuery(tab, userId);

    const filterQuery = buildFilterQuery(filter);

    const finalQuery = { ...baseQuery, ...filterQuery };

    const sortOptions = buildSortOptions(filter);

    //Flag Filled Form - Check for all tabs to properly identify filled forms
    const filledFormIds: Array<string> = [];
    const user = await User.findById(userId).select("email").lean();

    const filledForms = await FormResponse.find({
      userId: userId,
      respondentEmail: user?.email,
    })
      .select("formId")
      .lean();

    filledFormIds.push(...filledForms.map((i) => i.formId.toString()));

    const [results] = await Form.aggregate([
      { $match: finalQuery },
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          data: [
            { $sort: sortOptions },
            { $skip: (p - 1) * lt },
            { $limit: lt },
            {
              $project: {
                _id: 1,
                title: 1,
                type: 1,
                totalScore: 1,
                createdAt: 1,
                updatedAt: 1,
                user: 1,
                owners: 1,
                editors: 1,
              },
            },
          ],
        },
      },
    ]).exec();

    const totalCount = results.totalCount[0]?.count || 0;
    const userForms = (results.data as FormType[]).map((form) => {
      const isFormFilled = filledFormIds.includes(form._id.toString());

      if (tab === DashboardTabType.filledform) {
        return {
          ...form,
          isFilled: true,
        };
      }

      const isCreator = form.user?.toString() === userId.toString();
      const isOwner = form.owners?.some(
        (ownerId) => ownerId.toString() === userId.toString(),
      );
      const isEditor = form.editors?.some(
        (editorId) => editorId.toString() === userId.toString(),
      );

      const shouldBeFlagged =
        isFormFilled && !isCreator && !isOwner && !isEditor;

      return {
        ...form,
        isFilled: shouldBeFlagged,
      };
    });

    return res.status(200).json({
      ...ReturnCode(200),
      data: {
        userForms,
      },
      pagination: {
        totalCount,
        totalPage: Math.ceil(totalCount / lt),
      },
    });
  } catch (error) {
    console.error("Error in handleUserQuery:", error);
    return res.status(500).json(ReturnCode(500, "Internal server error"));
  }
}

// Helper function to build base query based on tab type
async function buildBaseQuery(
  tab: DashboardTabType,
  userId: Types.ObjectId,
): Promise<QueryFilter<FormType>> {
  switch (tab) {
    case DashboardTabType.all:
      return {
        $or: [
          { user: new Types.ObjectId(userId) },
          { editors: { $in: [userId] } },
          { owners: { $in: [userId] } },
        ],
      };

    case DashboardTabType.myform:
      return {
        $or: [{ user: userId }, { owners: { $in: [userId] } }],
      };

    case DashboardTabType.otherform:
      return {
        editors: { $in: [userId] },
        user: { $ne: userId }, // Exclude forms owned by the user
      };

    case DashboardTabType.filledform:
      // Optimized: Use aggregation to get form IDs directly
      const filledFormIds = await FormResponse.distinct("formId", { userId });
      return {
        _id: { $in: filledFormIds },
      };

    default:
      throw new Error(`Invalid tab type: ${tab}`);
  }
}

// Helper function to build filter query
function buildFilterQuery(filter?: {
  query?: string;
  type?: FormType;
}): QueryFilter<FormType> {
  const filterQuery: QueryFilter<FormType> = {};

  if (filter?.query) {
    const searchQuery = filter.query.trim();
    if (searchQuery) {
      filterQuery.title = { $regex: searchQuery, $options: "i" };
    }
  }

  if (filter?.type) {
    filterQuery.type = filter.type as unknown as TypeForm;
  }

  return filterQuery;
}

// Helper function to build sort options
function buildSortOptions(filter?: {
  sort?: {
    createdAt?: number;
    updatedAt?: number;
  };
}): Record<string, 1 | -1> {
  const sortOptions: Record<string, 1 | -1> = {};

  if (filter?.sort?.createdAt) {
    sortOptions.createdAt = filter.sort.createdAt as 1 | -1;
  }

  if (filter?.sort?.updatedAt) {
    sortOptions.updatedAt = filter.sort.updatedAt as 1 | -1;
  }

  if (Object.keys(sortOptions).length === 0) {
    sortOptions.updatedAt = -1;
  }

  return sortOptions;
}
