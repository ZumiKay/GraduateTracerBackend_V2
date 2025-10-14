import { Request } from "express";
import { ROLE } from "../model/User.model";
import { Types } from "mongoose";
import { JwtPayload } from "jsonwebtoken";

export interface UserToken extends JwtPayload {
  id: Types.ObjectId;
  role: ROLE;
  userDetails?: {
    _id: Types.ObjectId;
    email: string;
    role: ROLE;
  };
}

interface FormsessionpayloadType extends JwtPayload {
  sub?: string;
  email?: string;
  access_token?: string; // The access_id token
  access_payload?: JwtPayload; // Decoded access token payload
}
export interface CustomRequest extends Request {
  user?: UserToken;
  session?: any;
  formsession?: FormsessionpayloadType;
}
