import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/customType";
import { ReturnCode } from "../utilities/helper";
import JWT from "jsonwebtoken";
import Usersession from "../model/Usersession.model";
import User from "../model/User.model";

export enum GetPublicFormDataTyEnum {
  initial = "initial",
  verify = "verify",
  data = "data",
}

export interface GetPublicFormDataType {
  p?: string;
  ty?: GetPublicFormDataTyEnum;
  vfy?: string;
  isSwitched?: string;
}

class AuthenticateMiddleWare {
  public VerifyToken = (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const accessToken =
        req?.cookies[process.env.ACCESS_TOKEN_COOKIE ?? "access_token"];

      if (!accessToken)
        return res
          .status(401)
          .json(ReturnCode(401, "No access token provided"));

      const verify = this.VerifyJWT(accessToken);

      if (!verify) {
        return res.status(403).json(ReturnCode(403, "Invalid access token"));
      }

      req.user = verify as any;
      return next();
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(403).json(ReturnCode(403, "Access token expired"));
      }
      console.error("Token verification error:", error);
      return res.status(500).json(ReturnCode(500, "Token verification failed"));
    }
  };

  public VerifyTokenAndSession = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const accessToken =
        req?.cookies[process.env.ACCESS_TOKEN_COOKIE ?? "access_token"];
      const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];

      if (!accessToken) {
        return res
          .status(401)
          .json(ReturnCode(401, "No access token provided"));
      }

      const decoded = this.VerifyJWT(accessToken);
      if (!decoded) {
        return res.status(403).json(ReturnCode(403, "Invalid access token"));
      }

      if (refreshToken) {
        const session = await Usersession.findOne({
          session_id: refreshToken,
          user: (decoded as any).id,
          expireAt: { $gte: new Date() },
        });

        if (!session) {
          return res
            .status(401)
            .json(ReturnCode(401, "Session expired or invalid"));
        }
      }

      const user = await User.findById((decoded as any).id).select(
        "_id email role"
      );
      if (!user) {
        return res.status(401).json(ReturnCode(401, "User no longer exists"));
      }

      req.user = {
        ...(decoded as any),
        userDetails: {
          _id: user._id,
          email: user.email,
          role: user.role,
        },
      } as any;
      return next();
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(403).json(ReturnCode(403, "Access token expired"));
      }
      console.error("Token and session verification error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Authentication verification failed"));
    }
  };

  public VerifyRefreshToken = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];

    if (!refreshToken)
      return res.status(401).json(ReturnCode(401, "No refresh token provided"));

    try {
      const isVerify = this.VerifyJWT(refreshToken);

      if (!isVerify)
        return res.status(401).json(ReturnCode(401, "Invalid refresh token"));

      const isValid = await Usersession.findOne({
        session_id: refreshToken,
        expireAt: { $gte: new Date() },
      }).populate({ path: "user", select: "_id email role" });

      if (!isValid || !isValid.user) {
        if (isValid) {
          await Usersession.deleteOne({ session_id: refreshToken });
        }
        return res.status(403).json(ReturnCode(403, "Session expired"));
      }

      req.session = isValid;
      req.user = isValid.user as any;

      return next();
    } catch (error: any) {
      console.error("Refresh token verification error:", error);

      if (error.name === "TokenExpiredError") {
        return res.status(403).json(ReturnCode(403, "Refresh token expired"));
      }
      return res
        .status(500)
        .json(ReturnCode(500, "Refresh token verification failed"));
    }
  };

  public RequireAdmin = (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json(ReturnCode(401, "User not authenticated"));
      }

      const userRole = req.user.userDetails?.role || req.user.role;
      if (userRole !== "ADMIN") {
        return res.status(403).json(ReturnCode(403, "Admin access required"));
      }

      return next();
    } catch (error) {
      console.error("Admin check error:", error);
      return res.status(500).json(ReturnCode(500, "Permission check failed"));
    }
  };

  private VerifyJWT(token: string) {
    const verify = JWT.verify(token, process.env.JWT_SECRET ?? "secret");
    return verify;
  }
}

export default new AuthenticateMiddleWare();
