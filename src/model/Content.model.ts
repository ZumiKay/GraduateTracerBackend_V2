import { model, Schema, Types } from "mongoose";

export enum QuestionType {
  MultipleChoice = "multiple",
  CheckBox = "checkbox",
  Text = "texts",
  Number = "number",
  Date = "date",
  Range = "range",
  Selection = "select",
}

export interface RangeType<t> {
  start: t;
  end: t;
}

export interface CheckboxQuestionType {
  idx: number;
  content: string;
}

export interface ConditionalType {
  _id: Types.ObjectId;
  key: Types.ObjectId;
  QuestionIds: Array<Types.ObjectId>;
}

export interface AnswerKey {
  _id: Types.ObjectId;
  answer:
    | string
    | number
    | Date
    | RangeType<Date>
    | RangeType<number>
    | Array<number>;
}

export interface ContentType {
  _id: Types.ObjectId;
  title: string;
  type: QuestionType;
  formId: Types.ObjectId;
  text?: string;
  checkbox?: Array<CheckboxQuestionType>;
  range?: RangeType<Date>;
  numrange?: RangeType<number>;
  date?: Date;
  score?: number;
  answer?: AnswerKey;
  conditional?: ConditionalType;
  require?: boolean;
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
    type: Schema.Types.ObjectId,
    ref: "Content", // Refers to another content
    required: true,
  },
  QuestionIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "Content", // Refers to follow-up questions
      required: true,
    },
  ],
});

const AnswerKeySchema = new Schema<AnswerKey>({
  answer: {
    type: Schema.Types.Mixed, // Handles string, number, date, ranges, arrays
    required: true,
  },
});

//Parent Document

const ContentSchema = new Schema<ContentType>({
  title: {
    type: "string",
    required: true,
    unique: true,
  },
  type: {
    type: "string",
    enum: Object.values(QuestionType),
    required: true,
  },
  text: {
    type: "string",
    default: null,
  },
  checkbox: {
    type: [CheckboxQuestionSchema],
    default: [],
  },
  range: {
    type: RangeSchema,
    default: null,
  },
  numrange: {
    type: RangeSchema,
    default: null,
  },
  date: {
    type: Date,
    default: null,
  },
  answer: {
    type: AnswerKeySchema,
    default: null,
  },
  conditional: {
    type: [ConditionalSchema],
    default: null,
  },
  score: {
    type: Number,
    default: null,
  },
  require: {
    type: Boolean,
    default: false,
  },
});

const Content = model("Content", ContentSchema);

export default Content;
