import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/customType";
import { ReturnCode } from "../utilities/helper";
import JWT from "jsonwebtoken";
import Usersession from "../model/Usersession.model";

class AuthenticateMiddleWare {
  public VerifyToken = (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const accessToken =
        req?.cookies[process.env.ACCESS_TOKEN_COOKIE ?? "access_token"];

      if (!accessToken) return res.status(401).json(ReturnCode(401));

      const verify = this.VerifyJWT(accessToken);

      if (!verify) {
        return res.status(403).json(ReturnCode(403));
      }

      req.user = verify as any;

      return next();
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(403).json(ReturnCode(403));
      }
      return res.status(500).json({ ...ReturnCode(500), error });
    }
  };

  public VerifyRefreshToken = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];

    if (!refreshToken) return res.status(401).json(ReturnCode(401));
    try {
      const isVerify = this.VerifyJWT(refreshToken);

      if (!isVerify)
        return res.status(401).json(ReturnCode(401, "Unauthenticated"));

      const isValid = await Usersession.findOne({
        $and: [
          { session_id: refreshToken },
          {
            expireAt: {
              $gte: new Date(),
            },
          },
        ],
      });

      if (!isValid) return res.status(403).json(ReturnCode(403));

      return next();
    } catch (error: any) {
      console.log("Verify Refresh Token", error);

      if (error.name === "TokenExpiredError") {
        return res.status(403).json(ReturnCode(403));
      }
      return res.status(500).json(ReturnCode(500));
    }
  };

  //Helper
  private VerifyJWT(token: string) {
    const verify = JWT.verify(token, process.env.JWT_SECRET ?? "secret");

    return verify;
  }
  private extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.split(" ")[1];
  }
}

export default new AuthenticateMiddleWare();
