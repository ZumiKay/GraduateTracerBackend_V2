import { Request } from "express";
import { ROLE } from "../model/User.model";
import { Types } from "mongoose";

interface UserToken {
  id: Types.ObjectId;
  role: ROLE;
  userDetails?: {
    _id: Types.ObjectId;
    email: string;
    role: ROLE;
  };
}

export interface CustomRequest extends Request {
  user?: UserToken;
  session?: any;
}
