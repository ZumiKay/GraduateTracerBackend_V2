import { Request, Response } from "express";
import {
  FormatToGeneralDate,
  groupContentByParent,
  ReturnCode,
} from "../utilities/helper";
import Form, { CollaboratorType, FormType } from "../model/Form.model";
import { CustomRequest } from "../types/customType";
import { Types } from "mongoose";
import Content, { QuestionType } from "../model/Content.model";
import SolutionValidationService from "../services/SolutionValidationService";
import User, { UserType } from "../model/User.model";
import {
  isValidObjectIdString,
  hasFormAccess,
  isPrimaryOwner,
  verifyRole,
  validateAccess,
  projections,
  validateFormRequest,
} from "../utilities/formHelpers";

interface CollaboratorRequest {
  formId: string;
  userEmail?: Array<string>;
  userId?: string;
  role?: CollaboratorType;
}

// Unified collaborator management function

interface ManageFormCollaboratorBodyType {
  formId: string;
  email: string;
  role: CollaboratorType;
  action: "add" | "remove";
}

export const ManageFormCollaborator = async (
  req: CustomRequest,
  res: Response
) => {
  try {
    const { formId, email, role, action } =
      req.body as ManageFormCollaboratorBodyType;
    const user = req.user;

    if (!user) return res.status(401).json(ReturnCode(401));

    if (!email || (action === "remove" ? false : !role) || !action || !formId)
      return res.status(400).json(ReturnCode(400, "Missing required fields"));
    if (!isValidObjectIdString(formId))
      return res.status(400).json(ReturnCode(400, "Invalid form ID"));
    if (action === "add" && !["owner", "editor"].includes(role))
      return res.status(400).json(ReturnCode(400, "Invalid role"));
    if (!["add", "remove"].includes(action))
      return res.status(400).json(ReturnCode(400, "Invalid action"));

    const form = await Form.findById(formId)
      .populate("user", "email _id")
      .exec();
    if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));
    const { isCreator, isOwner } = validateAccess(form, user.id);

    if (
      action === "remove" || role !== CollaboratorType.editor
        ? !isCreator
        : !(isCreator || isOwner)
    )
      return res
        .status(403)
        .json(ReturnCode(403, "Only form owner can manage collaborators"));

    const targetUser = await User.findOne({ email }).exec();
    if (!targetUser)
      return res.status(404).json(ReturnCode(404, "User not found"));
    if (targetUser._id.toString() === user.id.toString())
      return res
        .status(400)
        .json(ReturnCode(400, "Cannot modify your own permissions"));

    const collaboratorId = targetUser._id;
    const currentField =
      role === CollaboratorType.editor
        ? "editors"
        : role === CollaboratorType.owner
        ? "owners"
        : undefined;
    const currentList =
      (currentField &&
        (form[currentField as keyof typeof form] as Types.ObjectId[])) ||
      [];

    if (currentField) {
      if (action === "add") {
        if (
          currentList.some((id) => id.toString() === collaboratorId.toString())
        ) {
          return res
            .status(400)
            .json(ReturnCode(400, `User is already a ${role}`));
        }
        await Form.findByIdAndUpdate(formId, {
          $addToSet: { [currentField]: collaboratorId },
        });
      } else {
        if (
          !currentList.some((id) => id.toString() === collaboratorId.toString())
        ) {
          return res.status(400).json(ReturnCode(400, `User is not a ${role}`));
        }
        await Form.findByIdAndUpdate(formId, {
          $pull: { [currentField]: collaboratorId },
        });
      }
    }

    const actionText = action === "add" ? "added as" : "removed from";
    return res
      .status(200)
      .json(ReturnCode(200, `User successfully ${actionText} ${role}`));
  } catch (error) {
    console.error("Error managing form collaborator:", error);
    return res.status(500).json(ReturnCode(500, "Internal server error"));
  }
};

interface FormCollarboratorDataType {
  _id: string;
  name?: string;
  email: string;
  role: CollaboratorType;
  isPrimary?: boolean;
}

export async function GetFormCollaborators(req: CustomRequest, res: Response) {
  const { formId } = req.params;
  const currentUser = req.user;

  if (!currentUser)
    return res.status(401).json(ReturnCode(401, "Unauthorized"));

  const validation = validateFormRequest(formId);
  if (!validation.isValid)
    return res.status(400).json(ReturnCode(400, validation.error));

  try {
    const form = await Form.findById(formId)
      .populate("user owners editors", "email")
      .lean();
    if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));

    console.log(form.user);
    console.log(currentUser);
    if (
      !form.user._id.equals(currentUser.id) &&
      !verifyRole(CollaboratorType.owner, form, currentUser.id)
    )
      return res.status(403).json(ReturnCode(403, "Access denied"));

    const formCreator = form.user as unknown as UserType;
    const primaryOwner: FormCollarboratorDataType = {
      _id: formCreator._id.toString(),
      name: formCreator.email?.split("@")[0] || "Unknown",
      email: formCreator.email,
      role: CollaboratorType.creator,
      isPrimary: true,
    };

    const allOwners =
      form.owners &&
      (form.owners as unknown as UserType[])?.map((i) => ({
        _id: i._id,
        email: i.email,
        name: i.email?.split("@")[0] || "Unknown",
        role: CollaboratorType.owner,
      }));
    const allEditors =
      form.editors &&
      (form.editors as unknown as UserType[])?.map((i) => ({
        _id: i._id,
        email: i.email,
        name: i.email?.split("@")[0] || "Unknown",
        role: CollaboratorType.editor,
      }));

    return res.status(200).json({
      ...ReturnCode(200, "Form collaborators retrieved successfully"),
      data: {
        primaryOwner,
        allOwners,
        allEditors,
        totalCollaborators:
          (allOwners?.length ?? 0) + (allEditors?.length ?? 0),
      },
    });
  } catch (error) {
    console.error("Get Form Collaborators Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to retrieve collaborators"));
  }
}

export async function RemoveSelfFromForm(req: CustomRequest, res: Response) {
  const { formId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  const validation = validateFormRequest(formId);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (isPrimaryOwner(form, currentUser.id.toString())) {
      return res
        .status(400)
        .json(
          ReturnCode(
            400,
            "Primary owner cannot remove themselves. Transfer ownership first."
          )
        );
    }

    if (!hasFormAccess(form, currentUser.id)) {
      return res
        .status(403)
        .json(ReturnCode(403, "You don't have access to this form"));
    }

    await Form.findByIdAndUpdate(formId, {
      $pull: { owners: currentUser.id, editors: currentUser.id },
    });

    return res
      .status(200)
      .json(ReturnCode(200, "Successfully removed from form"));
  } catch (error) {
    console.error("Remove Self From Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to remove from form"));
  }
}

export async function ChangePrimaryOwner(req: CustomRequest, res: Response) {
  const { formId, userId } = req.body as CollaboratorRequest;
  const currentUser = req.user;

  if (!currentUser) return res.status(403).json(ReturnCode(403));

  const validation = validateFormRequest(formId, userId);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  try {
    const form = (await Form.findById(formId).lean()) as FormType;
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!isPrimaryOwner(form, currentUser.id.toString())) {
      return res
        .status(403)
        .json(ReturnCode(403, "Only primary owner can transfer ownership"));
    }

    await Form.updateOne({ _id: formId }, { user: new Types.ObjectId(userId) });
    return res.status(200).json(ReturnCode(200, "Transfer completed"));
  } catch (error) {
    console.error("Transfer Owner Error:", error);
    return res.status(500).json(ReturnCode(500));
  }
}

export async function CreateForm(req: CustomRequest, res: Response) {
  const formdata = req.body as FormType;
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(401, "Unauthorized"));

  try {
    const existingForm = await Form.findOne({
      $and: [{ title: formdata.title }, { user: user.id }],
    });
    if (existingForm)
      return res.status(400).json(ReturnCode(400, "Form already exists"));

    const createdForm = await Form.create({ ...formdata, user: user.id });
    return res.status(201).json({
      ...ReturnCode(201, "Form Created"),
      data: { ...formdata, _id: createdForm._id },
    });
  } catch (error: any) {
    console.error("Create Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to create form"));
  }
}

export async function EditForm(req: CustomRequest, res: Response) {
  const { _id, setting, ...updateData } = req.body.data as FormType;
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(401, "Unauthorized"));

  const validation = validateFormRequest(_id?.toString() || "");
  if (!validation.isValid)
    return res.status(400).json(ReturnCode(400, validation.error));

  try {
    const form = await Form.findById(_id);
    if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));
    if (!hasFormAccess(form, user.id))
      return res.status(403).json(ReturnCode(403, "Access denied"));

    const updateQuery: any = { ...updateData };
    if (setting) {
      Object.keys(setting).forEach((key) => {
        updateQuery[`setting.${key}`] = setting[key as never];
      });
    }

    await Form.findByIdAndUpdate(_id, { $set: updateQuery }, { new: true });
    return res.status(200).json(ReturnCode(200, "Form Updated"));
  } catch (error: any) {
    console.error("Edit Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to update form"));
  }
}

export async function DeleteForm(req: CustomRequest, res: Response) {
  const { ids } = req.body as { ids: string[] };
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(401, "Unauthorized"));
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json(ReturnCode(400, "No IDs provided"));

  try {
    const forms = await Form.find({ _id: { $in: ids } });
    const userIdString = user.id.toString();

    for (const form of forms) {
      if (!hasFormAccess(form, user.id))
        return res
          .status(403)
          .json(ReturnCode(403, "Access denied to one or more forms"));
    }

    let deletedCount = 0;
    let removedCount = 0;

    for (const form of forms) {
      if (isPrimaryOwner(form, userIdString)) {
        await Form.deleteOne({ _id: form._id });
        deletedCount++;
      } else {
        await Form.findByIdAndUpdate(form._id, {
          $pull: { owners: user.id, editors: user.id },
        });
        removedCount++;
      }
    }

    const message =
      deletedCount > 0 && removedCount > 0
        ? `${deletedCount} forms deleted, removed from ${removedCount} forms`
        : deletedCount > 0
        ? `${deletedCount} forms deleted successfully`
        : `Removed from ${removedCount} forms successfully`;

    return res.status(200).json(ReturnCode(200, message));
  } catch (error) {
    console.error("Delete Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to delete forms"));
  }
}

export async function PageHandler(req: CustomRequest, res: Response) {
  const { ty, formId, deletepage } = req.body as {
    ty: "add" | "delete";
    formId: string;
    deletepage?: number;
  };
  const user = req.user;

  if (!user) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  //Validate request body
  const validation = validateFormRequest(formId);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  if (!ty) {
    return res.status(400).json(ReturnCode(400, "Missing operation type"));
  }

  if (ty === "delete" && (deletepage === undefined || isNaN(deletepage))) {
    return res
      .status(400)
      .json(ReturnCode(400, "Valid page number required for delete"));
  }

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, user.id)) {
      return res
        .status(403)
        .json(ReturnCode(403, "You have no access for this"));
    }

    if (ty === "add") {
      await Form.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
    } else if (ty === "delete") {
      const toBeDeleteContent = await Content.find({ page: deletepage })
        .select("_id")
        .lean();
      await Form.updateOne(
        { _id: formId },
        {
          $inc: { totalpage: -1 },
          $pull: { contentIds: { $in: toBeDeleteContent.map((i) => i._id) } },
        }
      );
      await Content.deleteMany({ page: deletepage });
    }

    return res
      .status(200)
      .json(ReturnCode(200, "Operation completed successfully"));
  } catch (error) {
    console.error("Page Handler Error:", error);
    return res.status(500).json(ReturnCode(500, "Operation failed"));
  }
}

export async function GetAllForm(req: Request, res: Response) {
  const { limit = "5", page = "1" } = req.query;
  const p = Number(page);
  const lt = Number(limit);

  try {
    const allForm = await Form.find()
      .skip((p - 1) * lt)
      .limit(lt);

    return res.status(200).json({ ...ReturnCode(200), data: allForm });
  } catch (error) {
    console.error("Get All Form Error:", error);
    return res.status(500).json(ReturnCode(500));
  }
}

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
    | "response";
  q?: string;
  page?: string;
  limit?: string;
}

export async function GetFilterForm(req: CustomRequest, res: Response) {
  try {
    const {
      ty,
      q,
      page = "1",
      limit = "5",
    } = req.query as GetFilterFormParamType;

    if (!ty) {
      return res.status(400).json(ReturnCode(400, "Invalid type or query"));
    }

    const p = Number(page);
    const lt = Math.min(Number(limit), 50);

    const requiresQuery = [
      "detail",
      "solution",
      "setting",
      "search",
      "type",
      "createddate",
      "modifieddate",
      "preview",
      "total",
      "response",
    ];
    if (requiresQuery.includes(ty) && !q) {
      return res.status(400).json(ReturnCode(400, "Invalid query"));
    }

    const user = req.user;

    // Handle different query types with optimized logic
    switch (ty) {
      case "detail":
      case "solution":
      case "response":
        return await handleDetailQuery(
          res,
          ty,
          q as string,
          p,
          user,
          Number(page ?? "1")
        );

      case "total":
        return await handleTotalQuery(res, q as string, user);

      case "setting":
        return await handleSettingQuery(res, q as string, user);

      case "user":
        return await handleUserQuery(res, p, lt, user);

      default:
        return await handleSearchQuery(res, ty, q as string, p, lt, user);
    }
  } catch (error) {
    console.error(
      "Error in GetFilterForm:",
      error instanceof Error ? error.message : error
    );
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

// Helper functions for GetFilterForm
async function handleDetailQuery(
  res: Response,
  ty: string,
  q: string,
  p: number,
  user: any,
  page?: number
) {
  if (!user) return res.status(401).json(ReturnCode(401));

  const query = isValidObjectIdString(q) ? { _id: q } : { title: q };
  const detailForm = await Form.findOne(query)
    .select(projections.detail)
    .populate({ path: "user", select: "email", options: { lean: true } })
    .lean()
    .exec();

  if (!detailForm)
    return res.status(404).json(ReturnCode(404, "No Form Found"));

  const accessInfo = validateAccess(detailForm, user.id);
  if (!accessInfo.hasAccess)
    return res.status(403).json(ReturnCode(403, "Access denied"));

  const contentProjection =
    ty === "solution"
      ? "_id qIdx title type text multiple checkbox selection rangedate rangenumber date require page conditional parentcontent answer score hasAnswer isValidated"
      : "_id qIdx title type text multiple checkbox selection rangedate rangenumber date require page conditional parentcontent";

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
    .lean()
    .exec();

  // Get last qIdx from previous page if current page > 1
  let lastQIdxFromPrevPage = null;
  if (page && page > 1) {
    const prevPageContent = await Content.find({
      _id: { $in: detailForm.contentIds },
      page: page - 1,
    })
      .select("qIdx")
      .sort({ qIdx: -1 })
      .limit(1)
      .lean()
      .exec();

    lastQIdxFromPrevPage = prevPageContent[0]?.qIdx || null;
  }

  return res.status(200).json({
    ...ReturnCode(200),
    data: {
      ...detailForm,
      contents: groupContentByParent(resultContent),
      contentIds: undefined,
      validationSummary,
      ...accessInfo,
      ...(page &&
        page > 1 && {
          lastqIdx: lastQIdxFromPrevPage,
        }),
    },
  });
}

async function handleTotalQuery(res: Response, q: string, user: any) {
  if (!user) return res.status(401).json(ReturnCode(401));
  if (!isValidObjectIdString(q))
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));

  const formdata = await Form.findById(q)
    .select(projections.total)
    .populate({ path: "user", select: "email", options: { lean: true } })
    .lean()
    .exec();
  if (!formdata) return res.status(404).json(ReturnCode(404, "Form not found"));

  const accessInfo = validateAccess(formdata, user.id);
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

async function handleSettingQuery(res: Response, q: string, user: any) {
  if (!user) return res.status(401).json(ReturnCode(401));
  if (!isValidObjectIdString(q))
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));

  const form = await Form.findById(q)
    .select(projections.setting)
    .populate({ path: "user", select: "email", options: { lean: true } })
    .lean()
    .exec();
  if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));

  const accessInfo = validateAccess(form, user.id);
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

async function handleUserQuery(
  res: Response,
  p: number,
  lt: number,
  user: any
) {
  if (!user) return res.status(401).json(ReturnCode(401));

  const userQuery = {
    $or: [{ user: user.id }, { owners: user.id }, { editors: user.id }],
  };
  const [totalCount, userForms] = await Promise.all([
    Form.countDocuments(userQuery),
    Form.find(userQuery)
      .skip((p - 1) * lt)
      .limit(lt)
      .select(projections.basic)
      .populate({ path: "responses", select: "_id", options: { lean: true } })
      .populate({ path: "user", select: "email", options: { lean: true } })
      .sort({ updatedAt: -1 })
      .lean()
      .exec(),
  ]);

  const userIdStr = user.id.toString();
  const formattedForms = userForms.map((form) => ({
    ...form,
    updatedAt: form.updatedAt ? FormatToGeneralDate(form.updatedAt) : undefined,
    createdAt: form.createdAt ? FormatToGeneralDate(form.createdAt) : undefined,
    isOwner: form.user._id.toString() === userIdStr,
    isCollaborator:
      form.owners?.some((owner: any) => owner.toString() === userIdStr) ||
      form.editors?.some((editor: any) => editor.toString() === userIdStr),
  }));

  const totalPages = Math.ceil(totalCount / lt);
  return res.status(200).json({
    ...ReturnCode(200),
    data: formattedForms,
    pagination: {
      currentPage: p,
      totalPages,
      totalCount,
      limit: lt,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1,
    },
  });
}

async function handleSearchQuery(
  res: Response,
  ty: string,
  q: string,
  p: number,
  lt: number,
  user: any
) {
  let conditions: any = {};

  switch (ty) {
    case "search":
      conditions = {
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      };
      break;
    case "type":
      conditions = { type: q };
      break;
    case "createddate":
      const createdDate = new Date(q);
      conditions = {
        createdAt: {
          $gte: new Date(createdDate.setHours(0, 0, 0, 0)),
          $lt: new Date(createdDate.setHours(23, 59, 59, 999)),
        },
      };
      break;
    case "modifieddate":
      const modifiedDate = new Date(q);
      conditions = {
        updatedAt: {
          $gte: new Date(modifiedDate.setHours(0, 0, 0, 0)),
          $lt: new Date(modifiedDate.setHours(23, 59, 59, 999)),
        },
      };
      break;
  }

  const [totalCount, forms] = await Promise.all([
    Form.countDocuments(conditions),
    Form.find(conditions)
      .skip((p - 1) * lt)
      .limit(lt)
      .select(projections.basic)
      .populate({ path: "user", select: "email", options: { lean: true } })
      .sort({ updatedAt: -1 })
      .lean()
      .exec(),
  ]);

  const formattedForms = forms.map((form) => {
    const accessInfo = user
      ? validateAccess(form, user.id)
      : { isPrimaryOwner: false, isOwner: false, isEditor: false };
    return {
      ...form,
      updatedAt: form.updatedAt,
      createdAt: form.createdAt,
      ...accessInfo,
    };
  });

  const totalPages = Math.ceil(totalCount / lt);
  return res.status(200).json({
    ...ReturnCode(200),
    data: formattedForms,
    pagination: {
      currentPage: p,
      totalPages,
      totalCount,
      limit: lt,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1,
    },
  });
}

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

    if (!hasFormAccess(form, user.id)) {
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
        isOwner: verifyRole(CollaboratorType.owner, form, user.id),
        isEditor: verifyRole(CollaboratorType.editor, form, user.id),
      },
    });
  } catch (error) {
    console.error("Validate Form Before Action Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to validate form"));
  }
}

// Re-export utilities for backward compatibility
export {
  hasFormAccess,
  isPrimaryOwner,
  verifyRole,
} from "../utilities/formHelpers";
