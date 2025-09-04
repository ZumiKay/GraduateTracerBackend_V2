import { model, Schema, Types } from "mongoose";
import { ContentType, RangeType } from "./Content.model";
import { returnscore } from "./Form.model";

export type ResponseAnswerType =
  | string
  | number
  | boolean
  | RangeType<number>
  | RangeType<Date>
  | Date
  | Array<number>;

export type ResponseAnswerReturnType = {
  key: number;
  val: ResponseAnswerType;
};

export interface ResponseSetType {
  questionId: Types.ObjectId;
  question: ContentType;
  response: ResponseAnswerType | ResponseAnswerReturnType;
  score?: number;
  isManuallyScored?: boolean;
}

export enum completionStatus {
  completed = "completed",
  partial = "partial",
  abandoned = "abandoned",
}

export interface FormResponseType {
  _id: Types.ObjectId;
  formId: Types.ObjectId;
  userId?: Types.ObjectId;
  guest?: GuestType;
  responseset: Array<ResponseSetType>;
  returnscore?: returnscore;
  totalScore?: number;
  isCompleted?: boolean;
  submittedAt?: Date;
  isAutoScored?: boolean;
  completionStatus?: completionStatus;
  respondentEmail?: string;
  respondentName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GuestType {
  _id?: Types.ObjectId;
  email: string;
  name?: string;
}
//Sub Doc
const ResponseSetSchema = new Schema<ResponseSetType>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: "Content",
    required: true,
    index: true,
  },
  response: {
    type: Schema.Types.Mixed,
    required: true,
  },
  score: {
    type: Number,
    required: false,
  },
  isManuallyScored: {
    type: Boolean,
    default: false,
  },
});

const GuestSchema = new Schema<GuestType>({
  email: {
    required: false,
    type: String,
  },
  name: {
    type: String,
    required: false,
  },
});

// Main schema for form responses
const ResponseSchema = new Schema<FormResponseType>(
  {
    formId: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
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
    returnscore: {
      type: String,
      enum: returnscore,
      required: false,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      required: false,
    },
    isAutoScored: {
      type: Boolean,
      default: false,
    },
    completionStatus: {
      type: String,
      enum: completionStatus,
      default: "partial",
    },
    respondentEmail: {
      type: String,
      required: false,
    },
    respondentName: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

ResponseSchema.index({ userId: 1, formId: 1 });
ResponseSchema.index({ createdAt: 1 });
ResponseSchema.index({ submittedAt: 1 });
ResponseSchema.index({ totalScore: 1 });

// Pre-save middleware to calculate total score
ResponseSchema.pre("save", function (next) {
  if (this.responseset && this.responseset.length > 0) {
    this.totalScore = this.responseset.reduce((total, response) => {
      return total + (response.score || 0);
    }, 0);
  }
  next();
});

const FormResponse = model("Response", ResponseSchema);

export default FormResponse;
