import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Form, { FormType } from "../model/Form.model";
import { CustomRequest } from "../types/customType";

export async function CreateForm(req: CustomRequest, res: Response) {
  const formdata = req.body as FormType;
  const user = req.user;

  if (!user) return res.status(401).json(ReturnCode(404));
  try {
    //Form Creation

    await Form.create({ ...formdata, user: user.id });

    return res.status(201).json(ReturnCode(201, "Form Created"));
  } catch (error: any) {
    console.log("Create Form", error);

    if (error.name === "Validation Error") {
      return res.status(400).json(ReturnCode(400));
    }

    return res.status(500).json(ReturnCode(500));
  }
}

export async function EditForm(req: Request, res: Response) {
  const { _id, ...updateData } = req.body as FormType;

  try {
    // Validate _id
    if (!_id) return res.status(400).json(ReturnCode(400, "Invalid Form ID"));

    // Update form using minimal query
    const updatedForm = await Form.findByIdAndUpdate(
      _id,
      { $set: updateData }, // Only set fields that need updating
      { new: true, projection: "_id" } // Return only `_id` for confirmation
    );

    // Handle not found
    if (!updatedForm) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    return res.status(200).json(ReturnCode(200, "Form Updated"));
  } catch (error: any) {
    console.error("Edit Form Error:", error.message);
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}

export async function DeleteForm(req: Request, res: Response) {
  const id = req.body;
  try {
    if (!id) return res.status(400).json(ReturnCode(400));

    const deleted = await Form.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json(ReturnCode(404));

    return res.status(200).json(ReturnCode(200));
  } catch (error) {
    console.log("Delete Form", error);
    return res.status(500).json(ReturnCode(500));
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
  ty?: "search" | "type" | "createddate" | "modifieddate" | "detail" | "user";
  q?: string;
  page?: string;
  limit?: string;
}
export async function GetFilterForm(req: CustomRequest, res: Response) {
  const {
    ty,
    q,
    page = "1",
    limit = "5",
  } = req.query as GetFilterFormParamType;

  const p = Number(page);
  const lt = Number(limit);

  try {
    if (!ty || !q) {
      return res.status(400).json(ReturnCode(400, "Invalid type or query"));
    }

    let filterdForm;

    if (ty === "detail") {
      filterdForm = await Form.findById(q)
        .populate({
          path: "contentIds",
          select:
            "_id title type text checkbox range numrange date score require",
        })
        .exec(); // Ensure execution for populated results
    } else if (ty === "user") {
      const user = req.user;

      if (!user) return res.status(401).json(ReturnCode(401));

      filterdForm = await Form.find({ user: user.id })
        .skip((p - 1) * lt)
        .limit(lt)
        .select("title type createdAt updatedAt");
    } else {
      const conditions =
        ty === "search"
          ? { title: { $regex: q, $options: "i" } }
          : ty === "type"
          ? { type: q }
          : ty === "createddate"
          ? { createdAt: new Date(q) }
          : ty === "modifieddate"
          ? { updatedAt: new Date(q) }
          : ty === "user"
          ? { user: q }
          : {};

      filterdForm = await Form.find(conditions)
        .skip((p - 1) * lt)
        .limit(lt)
        .select("title type createdAt updatedAt");
    }

    return res.status(200).json({ ...ReturnCode(200), data: filterdForm });
  } catch (error: any) {
    console.error("Error in GetFilterForm:", error.message);
    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }
}
