import { Request, Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import Form, { FormType } from "../../model/Form.model";
import { CustomRequest } from "../../types/customType";
import { Types } from "mongoose";
import Content from "../../model/Content.model";
import {
  hasFormAccess,
  validateFormRequest,
} from "../../utilities/formHelpers";

// Re-export functions from extracted modules
export {
  ManageFormCollaborator,
  GetFormCollaborators,
  RemoveSelfFromForm,
  ChangePrimaryOwner,
  ConfirmOwnershipTransfer,
  CancelOwnershipTransfer,
  ResendPendingInvitation,
  DeletePendingCollaborator,
} from "./form.collaborator.controller";
export {
  GetFilterForm,
  ValidateFormBeforeAction,
} from "./form.query.controller";
export { GetFilledForm, GetFormDetails } from "./form.response.controller";

export async function CreateForm(req: CustomRequest, res: Response) {
  const formdata = req.body as FormType;
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(401, "Unauthorized"));

  try {
    const createdForm = await Form.create({
      ...formdata,
      user: new Types.ObjectId(user.sub),
    });
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
    if (!hasFormAccess(form, new Types.ObjectId(user.sub)))
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

    for (const form of forms) {
      if (!hasFormAccess(form, new Types.ObjectId(user.sub)))
        return res
          .status(403)
          .json(ReturnCode(403, "Access denied to one or more forms"));
    }

    // Use Form.deleteMany for efficiency
    await Form.deleteMany({
      _id: { $in: ids },
      user: new Types.ObjectId(user.sub),
    });

    return res.status(200).json(ReturnCode(200, "Forms deleted successfully"));
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

    if (!hasFormAccess(form, new Types.ObjectId(user.sub))) {
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
