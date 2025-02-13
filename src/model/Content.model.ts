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
  key: number;
  contentId: Types.ObjectId;
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
  _id?: string;
  title: ContentTitle;
  type: QuestionType;
  formId: Types.ObjectId;
  text?: string;
  checkbox?: Array<CheckboxQuestionType>;
  range?: RangeType<Date>;
  numrange?: RangeType<number>;
  date?: Date;
  score?: number;
  answer?: AnswerKey;
  conditional?: Array<ConditionalType>;
  require?: boolean;
  page?: number;
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
    type: Number,
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
    default: null,
  },
  checkbox: {
    type: [CheckboxQuestionSchema],
    default: null,
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
  page: {
    type: Number,
    default: 1,
  },
});

ContentSchema.index({ formId: 1, page: 1 });

const Content = model("Content", ContentSchema);

export default Content;
