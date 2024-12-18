import { Schema, model, Types } from "mongoose";
import z from "zod";
import { ContentType } from "./Content.model";

export enum SubmitType {
  Once = "once",
  Mutiple = "multiple",
}

export enum TypeForm {
  Normal = "NORMAL",
  Quiz = "Quiz",
}

export interface FormType {
  _id: Types.ObjectId;
  title: string;
  type: TypeForm;
  contentIds?: Array<Types.ObjectId>;
  contents?: Array<ContentType>;
  submittype: SubmitType;
  user: Types.ObjectId;
  createdAt?: Date; // Auto-added by Mongoose
  updatedAt?: Date; // Auto-added by Mongoose
}

const FormSchema = new Schema<FormType>(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TypeForm),
    },
    contentIds: {
      type: [Schema.Types.ObjectId],
      ref: "Content", // Reference to the related collection
    },
    submittype: {
      type: String,
      required: true,
      enum: Object.values(SubmitType),
      default: SubmitType.Once, // Default value
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the related collection
      required: true,
    },
  },
  { timestamps: true }
);

FormSchema.index({ user: 1 });
FormSchema.index({ type: 1 });
FormSchema.index({ title: "text" }); // If full-text search is needed

const Form = model<FormType>("Form", FormSchema);

export default Form;

export const createFormValidate = z.object({
  body: z.object({
    title: z.string().min(1, "Name is required"),
    type: z.nativeEnum(TypeForm),
    contentIds: z.array(z.string()).optional(),
    submittype: z.nativeEnum(SubmitType),
  }),
});
