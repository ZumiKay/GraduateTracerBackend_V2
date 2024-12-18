import { model, Schema, Types } from "mongoose";
import { UserType } from "./User.model";

interface UsersessionschemaType {
  session_id: string;
  user: UserType;
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
  },
  { timestamps: true }
);
UsersessionSchema.index({ session_id: 1 });
UsersessionSchema.index({ user: 1 });

const Usersession = model("Usersession", UsersessionSchema);

export default Usersession;
