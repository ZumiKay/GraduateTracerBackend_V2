import { Request, Response } from "express";
import { FormatToGeneralDate, ReturnCode } from "../utilities/helper";
import Form, { FormType } from "../model/Form.model";
import { CustomRequest } from "../types/customType";
import { isValidObjectId, Types } from "mongoose";
import Content from "../model/Content.model";
import SolutionValidationService from "../services/SolutionValidationService";

export function hasFormAccess(form: FormType, userId: string): boolean {
  try {
    const userIdStr = userId.toString();

    // Check if user is the primary owner
    let formUserId: string;
    if (form.user && typeof form.user === "object" && form.user._id) {
      formUserId = form.user._id.toString();
    } else if (form.user) {
      formUserId = form.user.toString();
    } else {
      return false;
    }

    if (formUserId === userIdStr) {
      return true;
    }

    // Check if user is a collaborator
    if (form.owners && form.owners.length > 0) {
      return form.owners.some((owner) => {
        let ownerId: string;
        if (owner && typeof owner === "object" && owner._id) {
          ownerId = owner._id.toString();
        } else if (owner) {
          ownerId = owner.toString();
        } else {
          return false;
        }
        return ownerId === userIdStr;
      });
    }

    return false;
  } catch (error) {
    console.error("Error in hasFormAccess:", error);
    return false;
  }
}

export function isPrimaryOwner(form: FormType, userId: string): boolean {
  try {
    const userIdStr = userId.toString();

    let formUserId: string;
    if (form.user && typeof form.user === "object" && form.user._id) {
      formUserId = form.user._id.toString();
    } else if (form.user) {
      formUserId = form.user.toString();
    } else {
      return false;
    }

    return formUserId === userIdStr;
  } catch (error) {
    console.error("Error in isPrimaryOwner:", error);
    return false;
  }
}

export async function AddFormOwner(req: CustomRequest, res: Response) {
  const { formId, userEmail } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId || !userEmail) {
    return res
      .status(400)
      .json(ReturnCode(400, "Form ID and user email are required"));
  }

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!isPrimaryOwner(form, currentUser.id.toString())) {
      return res
        .status(403)
        .json(ReturnCode(403, "Only the form creator can add owners"));
    }

    const User = require("../model/User.model").default;
    const userToAdd = await User.findOne({ email: userEmail });
    if (!userToAdd) {
      return res.status(404).json(ReturnCode(404, "User not found"));
    }

    if (hasFormAccess(form, userToAdd._id.toString())) {
      return res
        .status(400)
        .json(ReturnCode(400, "User already has access to this form"));
    }

    const updatedForm = await Form.findByIdAndUpdate(
      formId,
      { $addToSet: { owners: userToAdd._id } },
      { new: true }
    ).populate("owners", "email");

    return res.status(200).json({
      ...ReturnCode(200, "Owner added successfully"),
      data: {
        form: {
          _id: updatedForm?._id,
          title: updatedForm?.title,
          owners: updatedForm?.owners,
        },
        addedUser: {
          _id: userToAdd._id,
          name: userToAdd.email.split("@")[0], // Use email prefix as name
          email: userToAdd.email,
        },
      },
    });
  } catch (error) {
    console.error("Add Form Owner Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to add owner"));
  }
}

export async function RemoveFormOwner(req: CustomRequest, res: Response) {
  const { formId, userId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId || !userId) {
    return res
      .status(400)
      .json(ReturnCode(400, "Form ID and user ID are required"));
  }

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!isPrimaryOwner(form, currentUser.id.toString())) {
      return res
        .status(403)
        .json(ReturnCode(403, "Only the form creator can remove owners"));
    }

    if (form.user.equals(new Types.ObjectId(userId))) {
      return res
        .status(400)
        .json(ReturnCode(400, "Cannot remove the form creator"));
    }

    const updatedForm = await Form.findByIdAndUpdate(
      formId,
      { $pull: { owners: new Types.ObjectId(userId) } },
      { new: true }
    ).populate("owners", "email");

    return res.status(200).json({
      ...ReturnCode(200, "Owner removed successfully"),
      data: updatedForm?.owners,
    });
  } catch (error) {
    console.error("Remove Form Owner Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to remove owner"));
  }
}

export async function GetFormOwners(req: CustomRequest, res: Response) {
  const { formId } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId) {
    return res.status(400).json(ReturnCode(400, "Form ID is required"));
  }

  try {
    const form = await Form.findById(formId)
      .populate("user", "email")
      .populate("owners", "email");

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, currentUser.id.toString())) {
      return res.status(403).json(ReturnCode(403, "Access denied"));
    }

    const primaryOwner = {
      _id: (form.user as any)._id,
      name: (form.user as any).email?.split("@")[0] || "Unknown",
      email: (form.user as any).email,
      role: "creator",
      isPrimary: true,
    };

    const additionalOwners = (form.owners || []).map((owner: any) => ({
      _id: owner._id,
      name: owner.email?.split("@")[0] || "Unknown",
      email: owner.email,
      role: "collaborator",
      isPrimary: false,
    }));

    return res.status(200).json({
      ...ReturnCode(200, "Form owners retrieved successfully"),
      data: {
        primaryOwner,
        additionalOwners,
        totalOwners: additionalOwners.length + 1,
      },
    });
  } catch (error) {
    console.error("Get Form Owners Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to retrieve form owners"));
  }
}

export async function RemoveSelfFromForm(req: CustomRequest, res: Response) {
  const { formId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId) {
    return res.status(400).json(ReturnCode(400, "Form ID is required"));
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

    if (!hasFormAccess(form, currentUser.id.toString())) {
      return res
        .status(403)
        .json(ReturnCode(403, "You don't have access to this form"));
    }

    await Form.findByIdAndUpdate(formId, {
      $pull: { owners: new Types.ObjectId(currentUser.id) },
    });

    return res
      .status(200)
      .json(ReturnCode(200, "Successfully removed from form"));
  } catch (error) {
    console.error("Remove Self From Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to remove from form"));
  }
}

export async function CreateForm(req: CustomRequest, res: Response) {
  const formdata = req.body as FormType;
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(404));
  try {
    //Form Creation

    const isForm = await Form.findOne({ title: formdata.title, user: user.id });

    if (isForm)
      return res.status(400).json(ReturnCode(400, "Form already exist"));

    await Form.create({ ...formdata, user: user.id });

    return res
      .status(200)
      .json({ ...ReturnCode(201, "Form Created"), data: formdata });
  } catch (error: any) {
    console.log("Create Form", error);

    if (error.name === "Validation Error") {
      return res.status(400).json(ReturnCode(400));
    }

    return res.status(500).json(ReturnCode(500));
  }
}

export async function PageHandler(req: CustomRequest, res: Response) {
  const {
    ty,
    formId,
    deletepage,
  }: { ty: "add" | "delete"; formId: string; deletepage?: number } = req.body;

  const user = req.user;
  if (!user) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId || !ty) {
    return res
      .status(400)
      .json(ReturnCode(400, "Missing required fields: formId or ty"));
  }

  if (ty === "delete" && (deletepage === undefined || isNaN(deletepage))) {
    return res
      .status(400)
      .json(
        ReturnCode(
          400,
          "deletepage is required and must be a valid number for delete operation"
        )
      );
  }

  try {
    // Check if user has access to edit this form
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, user.id.toString())) {
      return res.status(403).json(ReturnCode(403, "Access denied"));
    }

    if (ty === "add") {
      // Add page: increment totalpage
      await Form.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
    } else if (ty === "delete") {
      // Delete page: fetch content IDs, update form, and delete content
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

    return res.status(200).json(ReturnCode(200, "Success"));
  } catch (error) {
    console.error("PageHandler Error:", error);
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

export async function EditForm(req: CustomRequest, res: Response) {
  const { _id, setting, ...updateData } = req.body.data as FormType;

  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    // Validate _id
    if (!_id) return res.status(400).json(ReturnCode(400, "Invalid Form ID"));

    // Check if user has access to edit this form
    const form = await Form.findById(_id);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, user.id.toString())) {
      return res.status(403).json(ReturnCode(403, "Access denied"));
    }

    // Construct update query dynamically
    const updateQuery: any = { ...updateData };

    if (setting) {
      Object.keys(setting).forEach((key) => {
        updateQuery[`setting.${key}`] = setting[key as never]; // Use dot notation
      });
    }

    // Update the form
    const updatedForm = await Form.findByIdAndUpdate(
      _id,
      { $set: updateQuery }, // Apply update query
      { new: true, projection: "_id" } // Return `_id` for confirmation
    );

    return res.status(200).json(ReturnCode(200, "Form Updated"));
  } catch (error: any) {
    console.error("Edit Form Error:", error.message);
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

export async function DeleteForm(req: CustomRequest, res: Response) {
  try {
    const { ids } = req.body as { ids: string[] };
    const user = req.user;

    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json(ReturnCode(400, "Invalid request: No IDs provided"));
    }

    // Check access for each form
    const forms = await Form.find({ _id: { $in: ids } });
    const userIdString = user.id.toString();

    for (const form of forms) {
      if (!hasFormAccess(form, userIdString)) {
        return res
          .status(403)
          .json(ReturnCode(403, "Access denied to one or more forms"));
      }
    }

    // For primary owners, delete the form completely
    // For collaborators, remove them from the form
    let deletedCount = 0;
    let removedCount = 0;

    for (const form of forms) {
      if (isPrimaryOwner(form, userIdString)) {
        // Primary owner - delete form
        await Form.deleteOne({ _id: form._id });
        deletedCount++;
      } else {
        // Collaborator - remove from form
        await Form.findByIdAndUpdate(form._id, {
          $pull: { owners: user.id },
        });
        removedCount++;
      }
    }

    let message = "";
    if (deletedCount > 0 && removedCount > 0) {
      message = `${deletedCount} forms deleted, removed from ${removedCount} forms`;
    } else if (deletedCount > 0) {
      message = `${deletedCount} forms deleted successfully`;
    } else if (removedCount > 0) {
      message = `Removed from ${removedCount} forms successfully`;
    }

    return res.status(200).json(ReturnCode(200, message));
  } catch (error) {
    console.error("Delete Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

export async function GetAllForm(req: Request, res: Response) {
  try {
    const { limit = "5", page = "1" } = req.query;

    const p = Number(page);
    const lt = Number(limit);

    const allForm = await Form.find()
      .skip((p - 1) * lt)
      .limit(lt);

    return res.status(200).json({ ...ReturnCode(200), data: allForm });
  } catch (error) {
    console.log("Get All Form", error);
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
    | "hidecond"
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
    const lt = Number(limit);

    // Early validation for query parameter
    if (
      [
        "detail",
        "solution",
        "setting",
        "search",
        "type",
        "createddate",
        "modifieddate",
        "preview",
        "hidecond",
        "total",
        "response",
      ].includes(ty) &&
      !q
    ) {
      return res.status(400).json(ReturnCode(400, "Invalid query"));
    }

    // Cache commonly used projections
    const basicProjection = "title type createdAt updatedAt";

    switch (ty) {
      case "detail":
      case "solution":
      case "response":
      case "hidecond": {
        const user = req.user;
        if (!user) {
          return res.status(401).json(ReturnCode(401));
        }

        const query = isValidObjectId(q) ? { _id: q } : { title: q };

        const detailForm = await Form.findOne(query)
          .select(`${basicProjection} totalpage setting contentIds user owners`)
          .populate({ path: "user", select: "email" })
          .lean();

        if (!detailForm) {
          return res.status(400).json(ReturnCode(400, "No Form Found"));
        }

        // Debug form access - extract user ID from populated user object
        const formUserId =
          detailForm.user &&
          typeof detailForm.user === "object" &&
          detailForm.user._id
            ? detailForm.user._id.toString()
            : detailForm.user?.toString() || "";

        console.log("Form Access Debug:", {
          formId: detailForm._id,
          userId: user.id,
          formUser: detailForm.user,
          formUserId,
          formOwners: detailForm.owners,
          userObjectId: new Types.ObjectId(user.id),
        });

        // Check if user has access to this form
        const hasAccess = hasFormAccess(detailForm, user.id.toString());
        const isOwner = isPrimaryOwner(detailForm, user.id.toString());

        console.log("Access Check Results:", {
          hasAccess,
          isOwner,
          isCollaborator: hasAccess && !isOwner,
        });

        if (!hasAccess) {
          return res.status(403).json(ReturnCode(403, "Access denied"));
        }

        const resultContent = await Content.find({
          $and: [
            {
              _id: { $in: detailForm.contentIds },
            },
            { page: p },
          ],
        })
          .select(
            `_id idx title type text multiple checkbox range numrange date require page conditional parentcontent ${
              ty === "solution" ? "answer score hasAnswer isValidated" : ""
            }`
          )
          .lean()
          .sort({ idx: 1 });

        // Add validation summary for solution tab
        let validationSummary = null;
        if (ty === "solution") {
          try {
            validationSummary = await SolutionValidationService.validateForm(
              q as string
            );
          } catch (error) {
            console.error("Validation error:", error);
          }
        }

        // Add access information to the response
        const responseData = {
          ...detailForm,
          contents:
            resultContent.map((content) => ({
              ...content,
              parentcontent:
                content.parentcontent?.qId === content._id.toString()
                  ? undefined
                  : content.parentcontent,
            })) || [],
          contentIds: undefined,
          validationSummary,
          isOwner: isOwner,
          isCollaborator: hasAccess && !isOwner,
        };

        return res.status(200).json({
          ...ReturnCode(200),
          data: responseData,
        });
      }

      case "total": {
        const user = req.user;
        if (!user) {
          return res.status(401).json(ReturnCode(401));
        }

        const formdata = await Form.findById(q)
          .select("totalpage totalscore contentIds user owners")
          .lean();

        if (!formdata) {
          return res.status(404).json(ReturnCode(404, "Form not found"));
        }

        // Check if user has access to this form
        if (!hasFormAccess(formdata, user.id.toString())) {
          return res.status(403).json(ReturnCode(403, "Access denied"));
        }

        return res.status(200).json({
          ...ReturnCode(200),
          data: {
            totalpage: formdata?.totalpage ?? 0,
            totalscore: formdata?.totalscore ?? 0,
            totalquestion: formdata?.contentIds?.length,
          },
        });
      }

      case "setting": {
        const user = req.user;
        if (!user) {
          return res.status(401).json(ReturnCode(401));
        }

        const form = await Form.findById(q)
          .select("_id title type setting user owners")
          .lean();

        if (!form) {
          return res.status(404).json(ReturnCode(404, "Form not found"));
        }

        // Check if user has access to this form
        if (!hasFormAccess(form, user.id.toString())) {
          return res.status(403).json(ReturnCode(403, "Access denied"));
        }

        return res.status(200).json({
          ...ReturnCode(200),
          data: {
            _id: form._id,
            title: form.title,
            type: form.type,
            setting: form.setting,
          },
        });
      }

      case "user": {
        const user = req.user;
        if (!user) {
          return res.status(401).json(ReturnCode(401));
        }

        // Build the query for user forms
        const userQuery = {
          $or: [{ user: user.id }, { owners: user.id }],
        };

        // Get total count for pagination
        const totalCount = await Form.countDocuments(userQuery);

        // Find forms where user is either the primary owner or a collaborator
        const userForms = await Form.find(userQuery)
          .skip((p - 1) * lt)
          .limit(lt)
          .select(basicProjection)
          .populate({ path: "responses", select: "_id" })
          .populate({ path: "user", select: "email" })
          .lean();

        const formattedForms = userForms.map((form) => ({
          ...form,
          updatedAt: form.updatedAt
            ? FormatToGeneralDate(form.updatedAt)
            : undefined,
          createdAt: form.createdAt
            ? FormatToGeneralDate(form.createdAt)
            : undefined,
          isOwner: form.user._id.toString() === user.id.toString(),
          isCollaborator:
            form.owners &&
            form.owners.some(
              (owner: any) => owner.toString() === user.id.toString()
            ),
        }));

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / lt);
        const hasNextPage = p < totalPages;
        const hasPrevPage = p > 1;

        return res.status(200).json({
          ...ReturnCode(200),
          data: formattedForms,
          pagination: {
            currentPage: p,
            totalPages,
            totalCount,
            limit: lt,
            hasNextPage,
            hasPrevPage,
          },
        });
      }

      default: {
        // Handle search, type, createddate, modifieddate cases
        const conditions =
          {
            search: { title: { $regex: q, $options: "i" } },
            type: { type: q },
            createddate: { createdAt: new Date(q as string) },
            modifieddate: { updatedAt: new Date(q as string) },
          }[ty as never] || {};

        // Get total count for pagination
        const totalCount = await Form.countDocuments(conditions);

        const forms = await Form.find(conditions)
          .skip((p - 1) * lt)
          .limit(lt)
          .select(basicProjection)
          .lean();

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / lt);
        const hasNextPage = p < totalPages;
        const hasPrevPage = p > 1;

        return res.status(200).json({
          ...ReturnCode(200),
          data: forms,
          pagination: {
            currentPage: p,
            totalPages,
            totalCount,
            limit: lt,
            hasNextPage,
            hasPrevPage,
          },
        });
      }
    }
  } catch (error) {
    console.error(
      "Error in GetFilterForm:",
      error instanceof Error ? error.message : error
    );
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

export async function ValidateFormBeforeAction(
  req: CustomRequest,
  res: Response
) {
  const { formId, action } = req.query;
  const user = req.user;

  if (!user) {
    return res.status(401).json(ReturnCode(401));
  }

  if (!formId || typeof formId !== "string") {
    return res.status(400).json(ReturnCode(400, "Form ID is required"));
  }

  try {
    // Check if user has access to this form
    const form = await Form.findById(formId).select("user owners").lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!hasFormAccess(form, user.id.toString())) {
      return res.status(403).json(ReturnCode(403, "Access denied"));
    }

    const validationSummary = await SolutionValidationService.validateForm(
      formId
    );
    const errors = await SolutionValidationService.getFormValidationErrors(
      formId
    );

    // Different validation requirements based on action
    let canProceed = true;
    let warnings: string[] = [];

    switch (action) {
      case "save":
        // Allow saving even with missing answers/scores, just provide warnings
        canProceed = true;
        warnings = errors;
        break;

      case "next_page":
      case "switch_tab":
        // Allow navigation with warnings
        canProceed = true;
        warnings = errors;
        break;

      case "send_form":
        // Strict validation for sending form
        canProceed = errors.length === 0;
        break;

      default:
        canProceed = errors.length === 0;
    }

    return res.status(200).json({
      ...ReturnCode(200),
      data: {
        ...validationSummary,
        errors,
        warnings,
        canProceed,
        action,
      },
    });
  } catch (error) {
    console.error("Validate Form Before Action Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to validate form"));
  }
}
