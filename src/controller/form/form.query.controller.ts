import { Response } from "express";
import { AddQuestionNumbering, ReturnCode } from "../../utilities/helper";
import Form, {
  CollaboratorType,
  DashboardTabType,
  FormType,
} from "../../model/Form.model";
import { CustomRequest, UserToken } from "../../types/customType";
import { RootFilterQuery, Types } from "mongoose";
import Content, {
  DetailContentSelection,
  QuestionType,
} from "../../model/Content.model";
import SolutionValidationService from "../../services/SolutionValidationService";
import User from "../../model/User.model";
import {
  isValidObjectIdString,
  hasFormAccess,
  verifyRole,
  validateAccess,
  projections,
  validateFormRequest,
  getLastQuestionIdx,
} from "../../utilities/formHelpers";
import FormResponse from "../../model/Response.model";

interface GetFilterFormParamType {
  ty?:
    | "search"
    | "type"
    | "createddate"
    | "modifieddate"
    | "detail"
    | "user"
    | "setting"
    | "solution"
    | "preview"
    | "total"
    | "response"
    | "analytics";
  q?: string;
  page?: string;
  limit?: string;
  tab?: DashboardTabType;
  type?: FormType;
  created?: string;
  updated?: string;
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
    } = req.query as GetFilterFormParamType;

    if (tab && !Object.values(DashboardTabType).includes(tab)) {
      return res.status(400).json(ReturnCode(400, "Invalid type or query"));
    }

    const p = Number(page);
    const lt = Math.min(Number(limit), 50);
    const createdAt = created ? parseInt(created) : undefined;
    const updatedAt = updated ? parseInt(updated) : undefined;

    const requiresQuery = [
      "detail",
      "solution",
      "setting",
      "search",
      "type",
      "preview",
      "total",
      "response",
      "analytics",
      "user",
    ];
    if (ty && !requiresQuery.includes(ty)) {
      return res.status(400).json(ReturnCode(400, "Invalid query"));
    }

    const user = req.user;

    if (!user) return res.status(401).json(ReturnCode(401));

    // Handle different query types with optimized logic
    switch (ty) {
      case "detail":
      case "solution":
        return await handleDetailQuery(
          res,
          ty,
          q as string,
          p,
          new Types.ObjectId(user?.sub),
          Number(page ?? "1")
        );
      case "response":
      case "analytics":
        return await handleShortFormInfo({
          res,
          id: q,
          userId: new Types.ObjectId(user?.sub),
        });

      case "total":
        return await handleTotalQuery(res, q as string, user);

      case "setting":
        return await handleSettingQuery(res, q as string, user);

      case "user":
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
      error instanceof Error ? error.message : error
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
    .select("_id title type totalpage user owners editors setting.email")
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
      setting: form.setting,
      ...isHasAccess,
    },
  });
}

async function handleDetailQuery(
  res: Response,
  ty: string,
  q: string,
  p: number,
  user: Types.ObjectId,
  page?: number
) {
  if (!user) return res.status(401).json(ReturnCode(401));

  const query = isValidObjectIdString(q) ? { _id: q } : { title: q };
  const detailForm = await Form.findOne(query)
    .select(projections.detail)
    .lean()
    .exec();

  if (!detailForm)
    return res.status(404).json(ReturnCode(404, "No Form Found"));

  const accessInfo = validateAccess(detailForm, user);
  if (!accessInfo.hasAccess)
    return res.status(403).json(ReturnCode(403, "Access denied"));

  const contentProjection =
    ty === "solution"
      ? `${DetailContentSelection} answer score hasAnswer isValidated`
      : DetailContentSelection;

  let validationSummary = null;
  if (ty === "solution") {
    try {
      validationSummary = await SolutionValidationService.validateForm(q);
    } catch (error) {
      console.error("Validation error:", error);
    }
  }
  const resultContent = await Content.find({
    _id: { $in: detailForm.contentIds },
    page: p,
  })
    .select(contentProjection)
    .sort({ qIdx: 1 })
    .lean()
    .exec();

  // Get cumulative question count from previous pages for proper numbering
  const lastQuestionIdx = await getLastQuestionIdx(q, p);

  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      ...detailForm,
      owners: undefined,
      editors: undefined,
      user: undefined,
      contents: AddQuestionNumbering({
        questions: resultContent,
        lastIdx: lastQuestionIdx,
      }),
      contentIds: undefined,
      validationSummary,
      ...accessInfo, //User Role Of Form
      ...(page &&
        page > 1 && {
          lastqIdx: lastQuestionIdx,
        }),
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

  const stats = contentStats[0] || { totalQuestions: 0, totalScore: 0 };
  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      totalpage: formdata.totalpage ?? 0,
      totalscore: stats.totalScore,
      totalquestion: stats.totalQuestions,
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

      // In "filledform" tab, always flag forms as filled so owners/creators/editors
      // can view their own responses by switching to this tab
      if (tab === DashboardTabType.filledform) {
        return {
          ...form,
          isFilled: true,
        };
      }

      // For other tabs (all, myform, otherform):
      // Check if user has ownership/management rights over this form
      const isCreator = form.user?.toString() === userId.toString();
      const isOwner = form.owners?.some(
        (ownerId) => ownerId.toString() === userId.toString()
      );
      const isEditor = form.editors?.some(
        (editorId) => editorId.toString() === userId.toString()
      );

      // If user owns/manages the form, don't flag it as "filled" even if they responded to it
      // Only flag as filled if user is ONLY a respondent (not owner/creator/editor)
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
        pagination: {
          totalCount,
          totalPage: totalCount / lt,
        },
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
  userId: Types.ObjectId
): Promise<RootFilterQuery<FormType>> {
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
}): RootFilterQuery<FormType> {
  const filterQuery: RootFilterQuery<FormType> = {};

  if (filter?.query) {
    const searchQuery = filter.query.trim();
    if (searchQuery) {
      filterQuery.title = { $regex: searchQuery, $options: "i" };
    }
  }

  if (filter?.type) {
    filterQuery.type = filter.type;
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

/**
 *
 * Validate Form Content handler
 */
export async function ValidateFormBeforeAction(
  req: CustomRequest,
  res: Response
) {
  const { formId, action } = req.query;
  const user = req.user;

  if (!user) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  const validation = validateFormRequest(formId as string);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  try {
    const form = await Form.findById(formId)
      .select("user owners editors")
      .lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, new Types.ObjectId(user.sub))) {
      return res.status(403).json(ReturnCode(403, "Access denied"));
    }

    const [validationSummary, errors] = await Promise.all([
      SolutionValidationService.validateForm(formId as string),
      SolutionValidationService.getFormValidationErrors(formId as string),
    ]);

    const canProceed = action === "send_form" ? errors.length === 0 : true;
    const warnings = action === "send_form" ? [] : errors;

    return res.status(200).json({
      ...ReturnCode(200),
      data: {
        ...validationSummary,
        errors: action === "send_form" ? errors : [],
        warnings,
        canProceed,
        action,
        hasAccess: hasFormAccess,
        isOwner: verifyRole(
          CollaboratorType.owner,
          form,
          new Types.ObjectId(user.sub)
        ),
        isEditor: verifyRole(
          CollaboratorType.editor,
          form,
          new Types.ObjectId(user.sub)
        ),
      },
    });
  } catch (error) {
    console.error("Validate Form Before Action Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to validate form"));
  }
}
