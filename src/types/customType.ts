import { Request } from "express";
import { ROLE } from "../model/User.model";
import { Types } from "mongoose";

interface UserToken {
  id: Types.ObjectId;
  role: ROLE;
}
export interface CustomRequest extends Request {
  user?: UserToken;
}
