import { Request } from "express";
import { ROLE } from "../model/User.model";
import { JwtPayload } from "jsonwebtoken";

export interface UserToken extends JwtPayload {
  sub: string;
  role: ROLE;
  email?: string;
}

interface CustomJWTPayloadType extends JwtPayload {
  email?: string;
  timestamp?: number;
}
interface FormsessionpayloadType extends JwtPayload {
  sub?: string;
  email?: string;
  data?: CustomJWTPayloadType;
  access_token?: string; // The access_id token
  access_payload?: JwtPayload; // Decoded access token payload
}
export interface CustomRequest extends Request {
  user?: UserToken;
  session?: any;
  formsession?: FormsessionpayloadType;
}
