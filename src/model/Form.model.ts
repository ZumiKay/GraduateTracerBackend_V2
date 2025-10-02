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

export enum CollaboratorType {
  owner = "OWNER",
  editor = "EDITOR",
  creator = "CREATOR",
}

export enum DashboardTabType {
  all = "all",
  filledform = "filledForm",
  myform = "myForm",
  otherform = "otherForm",
}

interface FromSettingType {
  _id?: string;
  qcolor?: string;
  bg?: string;
  navbar?: string;
  text?: string;
  submitonce?: boolean;
  email?: boolean;
  autosave?: boolean;
  returnscore?: returnscore;
  acceptResponses?: boolean;
  acceptGuest?: boolean;
}

export interface FormType {
  _id: Types.ObjectId;
  title: string;
  type: TypeForm;
  contentIds?: Array<Types.ObjectId>;
  contents?: Array<ContentType>;
  requiredemail?: boolean;
  submittype: SubmitType;
  user: Types.ObjectId; // Primary owner (creator)
  owners?: Array<Types.ObjectId>; // Additional owners
  editors?: Array<Types.ObjectId>; // Additional editors
  setting?: FromSettingType;
  totalpage?: number;
  totalscore?: number;
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
  autosave: {
    type: Boolean,
    default: false,
  },
  acceptResponses: {
    type: Boolean,
    default: true,
  },
  acceptGuest: {
    type: Boolean,
    default: false,
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
    owners: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
      required: false,
    },
    editors: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: null,
      required: false,
    },
    totalpage: {
      type: Number,
      default: 1,
      required: false,
    },
    totalscore: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

FormSchema.index({ user: 1 });
FormSchema.index({ owners: 1 });
FormSchema.index({ editors: 1 });
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
