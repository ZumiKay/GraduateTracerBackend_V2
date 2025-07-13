import { model, Schema, Types } from "mongoose";
import { RangeType } from "./Content.model";
import { returnscore } from "./Form.model";

export interface ResponseSetType {
  questionId: Types.ObjectId;
  response:
    | string
    | number
    | boolean
    | RangeType<number>
    | RangeType<Date>
    | Date;
  score?: number;
}

export interface FormResponseType {
  _id: Types.ObjectId;
  formId: Types.ObjectId;
  userId?: Types.ObjectId;
  guest?: GuestType;
  responseset: Array<ResponseSetType>;
  returnscore?: returnscore;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GuestType {
  _id: Types.ObjectId;
  email: string;
}

//Sub Doc
const ResponseSetSchema = new Schema<ResponseSetType>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: "Content",
    required: true,
    index: true, // Indexing `questionId` for faster lookups
  },
  response: {
    type: Schema.Types.Mixed, // Allows flexible response types
    required: true,
  },
  score: {
    type: Number,
    required: false,
  },
});

const GuestSchema = new Schema<GuestType>({
  email: {
    required: false,
    type: String,
  },
});

// Main schema for form responses
const ResponseSchema = new Schema<FormResponseType>(
  {
    formId: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      index: true, // Indexing `formId` for faster retrieval by form
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true, // Indexing `userId` for faster retrieval by user
    },
    guest: {
      type: GuestSchema,
      required: false,
    },
    responseset: {
      type: [ResponseSetSchema],
      validate: {
        validator: (responses: ResponseSetType[]) => responses.length > 0,
        message: "Responseset must contain at least one response.",
      },
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for queries involving both `userId` and `formId`
ResponseSchema.index({ userId: 1, formId: 1 });
ResponseSchema.index({ createdAt: 1 });

const FormResponse = model("Response", ResponseSchema);

export default FormResponse;
