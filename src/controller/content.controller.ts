import { z } from "zod";
import Content, { ContentType, QuestionType } from "../model/Content.model";
import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Form from "../model/Form.model";

export const ContentValidate = z.object({
  body: z.object({
    formId: z.string().min(1, "Form is required"),
    contents: z.object({
      title: z.string().min(1, "Question is required"),
      type: z.nativeEnum(QuestionType),
      text: z.string().optional(),
      socre: z.number().optional(),
      require: z.boolean(),
    }),
  }),
});

interface AddFormContentType {
  formId: string;
  contents: ContentType;
}

export async function AddFormContent(req: Request, res: Response) {
  const data = req.body as AddFormContentType;
  try {
    const AddContent = await Content.create(data.contents);

    const AddedContentIds = AddContent.id;

    //Assign to form
    const updateForm = await Form.updateOne(
      { _id: data.formId },
      { contentIds: AddedContentIds }
    );
    if (updateForm.modifiedCount === 0) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    return res.status(201).json(ReturnCode(201, "Form Updated"));
  } catch (error) {
    console.log("Add Form Content", error);
    return res.status(500).json(ReturnCode(500));
  }
}

export async function EditFormContent(
  req: Request,
  res: Response
): Promise<Response> {
  const { contents } = req.body as AddFormContentType;
  try {
    // Validate input
    if (!contents || !contents._id) {
      return res
        .status(400)
        .json(ReturnCode(400, "Invalid content data provided"));
    }

    // Update content
    const updatedContent = await Content.findByIdAndUpdate(
      contents._id,
      contents,
      {
        new: true, // Return the updated document
        runValidators: true, // Run schema validations
      }
    );

    // Check if the content was found and updated
    if (!updatedContent) {
      return res.status(404).json(ReturnCode(404, "Content not found"));
    }

    return res
      .status(200)
      .json(ReturnCode(200, "Content updated successfully"));
  } catch (error: any) {
    console.error("Edit Form Content Error:", error.message || error);

    return res.status(500).json(ReturnCode(500, "Internal server error"));
  }
}

export async function DeleteContent(req: Request, res: Response) {
  const { id, formId } = req.body;
  try {
    if (!id || !formId) return res.status(400).json(ReturnCode(400));

    const deletedContent = await Content.findByIdAndDelete(id);

    if (!deletedContent) {
      return res.status(404).json(ReturnCode(404, "Content not found"));
    }

    // Update the Form by removing the deleted content's ID
    if (formId) {
      await Form.updateOne(
        { _id: formId },
        { $pull: { contentIds: id } } // Remove the ID from the contentIds array
      );
    }

    return res.status(200).json(ReturnCode(200, "Content Deleted"));
  } catch (error) {
    console.log("Delete Content", error);
    return res.status(200).json(ReturnCode(500));
  }
}
