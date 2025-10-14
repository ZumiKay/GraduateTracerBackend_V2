import { model, Schema, Types } from "mongoose";
import { FormType } from "./Form.model";

export type FormSessionTokenType = "access" | "refresh";

export interface Formsessiondatatype {
  form: Types.ObjectId | FormType;
  type: Formsessiondatatype;
  session_id: string;
  access_id?: string;
  expiredAt: Date;
  isSwitched: boolean;
  respondentEmail: string;
  respondentName?: string;
  removeCode?: string;
  isGuest?: boolean;
}

const FormSessionSchema = new Schema<Formsessiondatatype>({
  form: {
    type: Schema.Types.ObjectId,
    ref: "Form",
    required: true,
  },

  session_id: {
    type: Schema.Types.String,
    required: true,
    unique: true,
  },
  access_id: {
    type: Schema.Types.String,
    unique: true,
    required: false,
  },
  expiredAt: {
    type: Schema.Types.Date,
    required: true,
  },
  respondentEmail: {
    type: Schema.Types.String,
  },
  respondentName: {
    type: Schema.Types.String,
    required: false,
  },
  isGuest: {
    type: Schema.Types.Boolean,
    required: false,
    default: false,
  },
  removeCode: {
    type: Schema.Types.String,
    default: null,
    unique: true,
    required: false,
  },
});

FormSessionSchema.index({ form: 1 });

//Auto delete when expiredAt is expire
FormSessionSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

const Formsession = model<Formsessiondatatype>(
  "Formsession",
  FormSessionSchema
);

export default Formsession;
