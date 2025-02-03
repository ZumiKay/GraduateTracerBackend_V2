import { Request, Response } from "express";
import { FormatToGeneralDate, ReturnCode } from "../utilities/helper";
import Form, { FormType } from "../model/Form.model";
import { CustomRequest } from "../types/customType";
import { isValidObjectId } from "mongoose";

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

export async function EditForm(req: Request, res: Response) {
  const { _id, setting, ...updateData } = req.body as FormType;

  try {
    // Validate _id
    if (!_id) return res.status(400).json(ReturnCode(400, "Invalid Form ID"));

    // Construct update query dynamically
    const updateQuery: any = { ...updateData };

    if (setting) {
      Object.keys(setting).forEach((key) => {
        updateQuery[`setting.${key}`] = setting[key as never]; // Use dot notation
      });
    }

    console.log({ updateQuery });

    // Update the form
    const updatedForm = await Form.findByIdAndUpdate(
      _id,
      { $set: updateQuery }, // Apply update query
      { new: true, projection: "_id" } // Return `_id` for confirmation
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
  try {
    const { ids } = req.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json(ReturnCode(400, "Invalid request: No IDs provided"));
    }

    const { deletedCount } = await Form.deleteMany({ _id: { $in: ids } });

    if (deletedCount === 0) {
      return res.status(404).json(ReturnCode(404, "No forms found to delete"));
    }

    return res
      .status(200)
      .json(ReturnCode(200, `${deletedCount} forms deleted successfully`));
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
    | "setting";
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
    if (!ty) {
      return res.status(400).json(ReturnCode(400, "Invalid type or query"));
    }

    let filterdForm: Array<FormType> | FormType | null = null;

    if (ty === "detail") {
      if (q === undefined)
        return res.status(400).json(ReturnCode(400, "Invalid query"));
      const deatilform = await Form.findOne({
        ...(isValidObjectId(q) ? { _id: q } : { title: q }),
      })
        .select("title type setting createdAt updatedAt contentIds")
        .populate({
          path: "contentIds",
          select:
            "_id title type text checkbox range numrange date score require",
        })
        .lean()
        .exec(); // Ensure execution for populated results
      if (!deatilform) {
        return res.status(400).json({ ...ReturnCode(400, "No Form Found") });
      }

      filterdForm = {
        ...deatilform,
        contents: deatilform.contentIds ?? [],
        contentIds: undefined,
      } as unknown as FormType;
    } else if (ty === "setting") {
      //Get Form Setting
      if (!q) return res.status(400).json(ReturnCode(400, "Invalid query"));
      filterdForm = (await Form.findById(q).select("setting")) as FormType;
    } else if (ty === "user") {
      const user = req.user;

      if (!user) return res.status(401).json(ReturnCode(401));

      const userform = await Form.find({ user: user.id })
        .skip((p - 1) * lt)
        .limit(lt)
        .select("title type createdAt updatedAt")
        .lean()
        .populate({ path: "responses", select: "_id" })
        .exec();

      filterdForm = userform.map((form) => ({
        ...form,
        updatedAt: form.updatedAt
          ? FormatToGeneralDate(form.updatedAt)
          : undefined,
        createdAt: form.createdAt
          ? FormatToGeneralDate(form.createdAt)
          : undefined,
      })) as Array<FormType>;
    } else {
      // Search by title, type, created date, modified date
      if (!q) return res.status(400).json(ReturnCode(400, "Invalid query"));
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
