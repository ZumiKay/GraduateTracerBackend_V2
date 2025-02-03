import { Schema, model, Types } from "mongoose";
import z from "zod";
import { ContentType } from "./Content.model";
import FormResponse, { FormResponseType } from "./Response.model";

export enum SubmitType {
  Once = "ONCE",
  Multiple = "MULTIPLE",
}

export enum TypeForm {
  Normal = "NORMAL",
  Quiz = "QUIZ",
}

export enum returnscore {
  partial = "PARTIAL",
  manual = "MANUAL",
}

interface FromSettingType {
  _id?: string;
  qcolor?: string;
  bg?: string;
  navbar?: string;
  text?: string;
  submitonce?: boolean;
  email?: boolean;
  returnscore?: returnscore;
}

export interface FormType {
  _id: Types.ObjectId;
  title: string;
  type: TypeForm;
  contentIds?: Array<Types.ObjectId>;
  contents?: Array<ContentType>;
  requiredemail?: boolean;
  submittype: SubmitType;
  user: Types.ObjectId;
  setting?: FromSettingType;
  respondants?: Array<Types.ObjectId>;
  responses?: Array<FormResponseType>;
  createdAt?: Date;
  updatedAt?: Date;
}

const FormSettingSchema = new Schema<FromSettingType>({
  qcolor: {
    type: String,
    default: "#000000",
  },

  bg: {
    type: String,
    default: "#fff",
  },
  navbar: {
    type: String,
    default: null,
  },
  text: {
    type: String,
    default: "#000000",
  },
  submitonce: {
    type: Boolean,
    default: false,
  },
  email: { type: Boolean, default: false },
  returnscore: {
    type: String,
    enum: Object.values(returnscore),
    default: null,
    required: false,
  },
});

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
      required: false,
    },
    setting: FormSettingSchema,

    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the related collection
      required: true,
    },
    respondants: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: false,
    },
    responses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Response", // References the Response model
        default: [],
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

FormSchema.index({ user: 1 });
FormSchema.index({ type: 1 });
FormSchema.index({ title: "text" }); // If full-text search is needed
FormSchema.index({ _id: 1, responses: 1 });

//Pre-remove Hook
FormSchema.pre("deleteOne", async function (next) {
  const formId = this.getQuery()._id;
  await FormResponse.deleteMany({ formId });
  next();
});

const Form = model<FormType>("Form", FormSchema);

export default Form;

export const createFormValidate = z.object({
  body: z.object({
    title: z.string().min(1, "Name is required"),
    type: z.nativeEnum(TypeForm),
    contentIds: z.array(z.string()).optional(),
  }),
});
