import { model, Schema, Types } from "mongoose";
import { ContentType, RangeType } from "./Content.model";

export type ResponseAnswerType =
  | string
  | number
  | boolean
  | RangeType<number>
  | RangeType<string>
  | Array<number>;

export type ResponseAnswerReturnType = {
  key: number;
  val: ResponseAnswerType;
};

export interface ResponseSetType {
  question: ContentType | Types.ObjectId;
  response: ResponseAnswerType | ResponseAnswerReturnType;
  score?: number;
  scoringMethod?: ScoringMethod;
}

export enum RespondentType {
  user = "USER",
  guest = "GUEST",
}

export enum completionStatus {
  completed = "completed",
  partial = "partial",
  abandoned = "abandoned",
  idle = "idle",
}

export interface FormResponseType {
  _id: Types.ObjectId;
  formId: Types.ObjectId;
  userId?: Types.ObjectId;
  responseset: Array<ResponseSetType>;
  totalScore?: number;
  isCompleted?: boolean;
  submittedAt?: Date;
  completionStatus?: completionStatus;
  respondentEmail?: string;
  respondentName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  respondentType?: RespondentType;

  // Browser fingerprinting fields for anonymous tracking
  respondentFingerprint?: string;
  respondentIP?: string;
  respondentSessionId?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    screen: string;
    timezone: string;
    acceptLanguage: string;
    acceptEncoding: string;
  };
  fingerprintStrength?: number;
}

export interface GuestType {
  _id?: Types.ObjectId;
  email: string;
  name?: string;
}

export enum ScoringMethod {
  AUTO = "auto",
  MANUAL = "manual",
  NONE = "none",
}

export interface SubmitionProcessionReturnType {
  maxScore: number;
  totalScore: number;
  message: string;
}

//Sub Doc
const ResponseSetSchema = new Schema<ResponseSetType>({
  question: {
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
  scoringMethod: {
    type: String,
    enum: ScoringMethod,
    default: ScoringMethod.NONE,
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
    responseset: {
      type: [ResponseSetSchema],
      validate: {
        validator: (responses: ResponseSetType[]) => responses.length > 0,
        message: "Responseset must contain at least one response.",
      },
      required: true,
    },

    totalScore: {
      type: Number,
      default: 0,
    },
    isCompleted: {
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
    respondentType: {
      type: String,
      enum: RespondentType,
      required: false,
      default: null,
    },

    // Browser fingerprinting fields for anonymous tracking
    respondentFingerprint: {
      type: String,
      required: false,
      index: true,
    },
    respondentIP: {
      type: String,
      required: false,
      index: true,
    },

    submittedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

ResponseSchema.index({ userId: 1, formId: 1 });
ResponseSchema.index({ createdAt: 1 });
ResponseSchema.index({ submittedAt: 1 });
ResponseSchema.index({ totalScore: 1 });
// Fingerprinting indexes for duplicate detection
ResponseSchema.index({ formId: 1, respondentFingerprint: 1 });
ResponseSchema.index({ formId: 1, respondentIP: 1 });
ResponseSchema.index({ formId: 1, respondentEmail: 1 });

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
