import { Request, Response } from "express";
import { FormatToGeneralDate, ReturnCode } from "../utilities/helper";
import Form, { FormType } from "../model/Form.model";
import { CustomRequest } from "../types/customType";
import { isValidObjectId, Types } from "mongoose";
import Content from "../model/Content.model";
import SolutionValidationService from "../services/SolutionValidationService";

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

export async function EditForm(req: Request, res: Response) {
  const { _id, setting, ...updateData } = req.body.data as FormType;

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
        const query = isValidObjectId(q) ? { _id: q } : { title: q };

        const detailForm = await Form.findOne(query)
          .select(`${basicProjection} totalpage setting contentIds`)
          .lean();

        if (!detailForm) {
          return res.status(400).json(ReturnCode(400, "No Form Found"));
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

        return res.status(200).json({
          ...ReturnCode(200),
          data: {
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
          },
        });
      }

      case "total": {
        const formdata = await Form.findById(q)
          .select("totalpage totalscore contentIds")
          .lean();

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
        const form = await Form.findById(q)
          .select("_id title type setting")
          .lean();
        return res.status(200).json({ ...ReturnCode(200), data: form });
      }

      case "user": {
        const user = req.user;
        if (!user) {
          return res.status(401).json(ReturnCode(401));
        }

        const userForms = await Form.find({ user: user.id })
          .skip((p - 1) * lt)
          .limit(lt)
          .select(basicProjection)
          .populate({ path: "responses", select: "_id" })
          .lean();

        const formattedForms = userForms.map((form) => ({
          ...form,
          updatedAt: form.updatedAt
            ? FormatToGeneralDate(form.updatedAt)
            : undefined,
          createdAt: form.createdAt
            ? FormatToGeneralDate(form.createdAt)
            : undefined,
        }));

        return res
          .status(200)
          .json({ ...ReturnCode(200), data: formattedForms });
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

        const forms = await Form.find(conditions)
          .skip((p - 1) * lt)
          .limit(lt)
          .select(basicProjection)
          .lean();

        return res.status(200).json({ ...ReturnCode(200), data: forms });
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

export async function ValidateFormBeforeAction(req: Request, res: Response) {
  const { formId, action } = req.query;

  if (!formId || typeof formId !== "string") {
    return res.status(400).json(ReturnCode(400, "Form ID is required"));
  }

  try {
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
