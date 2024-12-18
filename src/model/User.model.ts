import { model, Schema, Types } from "mongoose";

export enum ROLE {
  ADMIN = "ADMIN",
  USER = "USER",
}

export interface UserType {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: ROLE;
  code?: string;
}

const UserSchema = new Schema<UserType>({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ROLE,
    default: ROLE.USER,
    required: true,
  },
  code: {
    type: String,
    default: null,
  },
});

const User = model("User", UserSchema);

export default User;
