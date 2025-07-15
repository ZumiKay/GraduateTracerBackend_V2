import { model, Schema, Types } from "mongoose";

export enum QuestionType {
  MultipleChoice = "multiple",
  CheckBox = "checkbox",
  Text = "texts",
  Number = "number",
  Date = "date",
  RangeDate = "rangedate",
  Selection = "selection",
  RangeNumber = "rangenumber",
  ShortAnswer = "shortanswer",
  Paragraph = "paragraph",
}

export interface RangeType<t> {
  start: t;
  end: t;
}

export interface CheckboxQuestionType {
  _id?: Types.ObjectId;
  idx: number;
  content: string;
}

export interface ConditionalType {
  _id: Types.ObjectId;
  key: number;
  contentId: Types.ObjectId;
  contentIdx?: number;
}

export interface ParentContentType {
  _id?: string;
  qId: string;
  qIdx?: number;
  optIdx: Number;
}

export interface AnswerKey {
  _id?: Types.ObjectId;
  answer:
    | string
    | number
    | Date
    | RangeType<Date>
    | RangeType<number>
    | Array<number>;
  isCorrect?: boolean; // For validation purposes
}

export interface ContentType {
  _id?: string;
  title: ContentTitle;
  type: QuestionType;
  formId: Types.ObjectId;
  multiple?: Array<CheckboxQuestionType>;
  text?: string;
  checkbox?: Array<CheckboxQuestionType>;
  range?: RangeType<string>;
  numrange?: RangeType<number>;
  date?: Date;
  score?: number;
  answer?: AnswerKey;
  conditional?: Array<ConditionalType>;
  parentcontent?: ParentContentType;
  require?: boolean;
  page?: number;
  hasAnswer?: boolean; // Flag to indicate if question has an answer
  isValidated?: boolean; // Flag to indicate if question is validated
}

//Sub Documents
const CheckboxQuestionSchema = new Schema<CheckboxQuestionType>({
  idx: {
    type: Number,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});

const RangeSchema = new Schema<RangeType<Date> | RangeType<number>>({
  start: {
    type: Schema.Types.Mixed, // Can handle Date or Number
    required: true,
  },
  end: {
    type: Schema.Types.Mixed, // Can handle Date or Number
    required: true,
  },
});

const ConditionalSchema = new Schema<ConditionalType>({
  key: {
    type: "Number",
    required: true,
  },
  contentId: {
    type: Schema.Types.ObjectId,
    ref: "Content",
    required: true,
  },
});

const AnswerKeySchema = new Schema<AnswerKey>({
  answer: {
    type: Schema.Types.Mixed, // Handles string, number, date, ranges, arrays
    required: true,
  },
  isCorrect: {
    type: Boolean,
    default: true,
  },
});

//Title Schema

interface ContentTitle {
  type: string;
  content: Array<any>;
}

const TitleSchema = new Schema<ContentTitle>({
  type: {
    type: String,
    required: true,
  },
  content: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

//Parent Document

const ContentSchema = new Schema<ContentType>({
  formId: {
    type: Schema.ObjectId,
    required: true,
  },
  title: {
    type: TitleSchema,
    required: true,
  },
  type: {
    type: "string",
    enum: Object.values(QuestionType),
    required: true,
  },
  text: {
    type: "string",
  },
  checkbox: {
    type: [CheckboxQuestionSchema],
  },
  multiple: {
    type: [CheckboxQuestionSchema],
  },
  range: {
    type: RangeSchema,
  },
  numrange: {
    type: RangeSchema,
  },
  date: {
    type: Date,
  },
  answer: {
    type: AnswerKeySchema,
  },
  conditional: {
    type: [ConditionalSchema],
  },
  parentcontent: {
    type: Object,
    required: false,
  },
  score: {
    type: Number,
    default: 0,
  },
  require: {
    type: Boolean,
    default: false,
  },
  page: {
    type: Number,
    default: 1,
  },
  hasAnswer: {
    type: Boolean,
    default: false,
  },
  isValidated: {
    type: Boolean,
    default: false,
  },
});

//Pre-save middleware to update form total score
ContentSchema.pre("save", async function (next) {
  try {
    const Form = require("./Form.model").default;

    // Calculate total score for all contents in this form
    const allContents = await Content.find({ formId: this.formId });
    const totalScore =
      allContents.reduce((sum, content) => {
        return sum + (content.score || 0);
      }, 0) + (this.score || 0);

    // Update the form's total score
    await Form.findByIdAndUpdate(this.formId, { totalscore: totalScore });

    next();
  } catch (error) {
    next(error as never);
  }
});

//Pre-remove middleware to update form total score
ContentSchema.pre("deleteOne", async function (next) {
  try {
    const Form = require("./Form.model").default;
    const contentToDelete = await this.model.findOne(this.getQuery());

    if (contentToDelete) {
      const remainingContents = await Content.find({
        formId: contentToDelete.formId,
        _id: { $ne: contentToDelete._id },
      });

      const totalScore = remainingContents.reduce((sum, content) => {
        return sum + (content.score || 0);
      }, 0);

      await Form.findByIdAndUpdate(contentToDelete.formId, {
        totalscore: totalScore,
      });
    }

    next();
  } catch (error) {
    next(error as never);
  }
});

//Indexes
ContentSchema.index({ formId: 1, page: 1 });
ContentSchema.index({ idx: 1 });

const Content = model("Content", ContentSchema);

export default Content;
