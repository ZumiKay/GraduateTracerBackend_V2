import { model, Schema, Types } from "mongoose";
import { UserType } from "./User.model";

interface UsersessionschemaType {
  session_id: string;
  user: UserType;
  respondent?: boolean;
  guest?: string;
  expireAt: Date;
  createdAt: Date;
}

const UsersessionSchema = new Schema<UsersessionschemaType>(
  {
    session_id: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expireAt: {
      type: Schema.Types.Date,
      required: true,
    },
    respondent: {
      type: Schema.Types.Boolean,
      required: false,
      default: null,
    },
    guest: {
      type: Schema.Types.String,
      unique: true,
      required: false,
    },
  },
  { timestamps: true }
);
UsersessionSchema.index({ session_id: 1 });
UsersessionSchema.index({ user: 1 });
UsersessionSchema.index({ guest_id: 1 });

const Usersession = model("Usersession", UsersessionSchema);

export default Usersession;
