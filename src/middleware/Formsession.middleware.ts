import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/customType";
import { ReturnCode } from "../utilities/helper";
import FormsessionService from "../controller/formsession.controller";
import Formsession from "../model/Formsession.model";
import { isValidObjectId } from "mongoose";
import Form, { TypeForm } from "../model/Form.model";
import UserMiddleware, {
  GetPublicFormDataTyEnum,
  GetPublicFormDataType,
} from "./User.middleware";
import { JwtPayload } from "jsonwebtoken";

export default class FormsessionMiddleware {
  private static calculateTokenExpiresIn(dbExpiredAt: Date): string {
    const now = new Date();
    const timeDiff = dbExpiredAt.getTime() - now.getTime();

    const hoursRemaining = Math.ceil(timeDiff / (1000 * 60 * 60));

    // Ensure minimum of 1 hour
    return `${Math.max(hoursRemaining, 1)}h`;
  }

  public static VerifyFormsession = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!process.env.RESPONDENT_COOKIE)
      return res.status(500).json(ReturnCode(500, "Internal Error"));

    //Verify required param
    const { formId } = req.params as { formId?: string };
    if (!formId || !isValidObjectId(formId))
      return res.status(400).json(ReturnCode(400));

    try {
      //Verify initial formdata
      const form = await Form.findById(formId)
        .select("type setting.email setting.acceptResponses")
        .lean();
      if (!form?.setting?.acceptResponses)
        return res.status(403).json(ReturnCode(403, "Form is closed"));

      if (form?.type === TypeForm.Normal) {
        return next();
      }

      const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE];

      if (!sessionToken) {
        return res.status(401).json(ReturnCode(401));
      }

      const extractedToken = FormsessionService.ExtractToken({
        token: sessionToken,
      }) as JwtPayload;

      if (extractedToken === null) {
        //Unauthorized
        return res.status(401).json(ReturnCode(401));
      }
      try {
        const isSession = await Formsession.findOne({
          $and: [{ form: formId }, { session_id: sessionToken }],
        });

        if (!isSession) {
          return res.status(401).json(ReturnCode(401, "Session not found"));
        }

        const dbExpiredAt = new Date(isSession.expiredAt);
        if (dbExpiredAt <= new Date()) {
          await Formsession.deleteOne({ session_id: sessionToken });
          return res.status(401).json(ReturnCode(401, "Session expired"));
        }

        // Check if token is expired or about to expire (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        const tokenExp = extractedToken.exp;
        const fiveMinutesFromNow = now + 5 * 60; // 5 minutes buffer

        if (tokenExp && tokenExp < fiveMinutesFromNow) {
          console.log(
            `Token renewal triggered for token expiring at ${new Date(
              tokenExp * 1000
            )}`
          );

          const newSessionId = await FormsessionService.GenerateUniqueSessionId(
            {
              email: isSession.respondentEmail,
              expireIn: this.calculateTokenExpiresIn(dbExpiredAt),
            }
          );

          // Update the session_id in database
          await Formsession.updateOne(
            { session_id: sessionToken },
            { session_id: newSessionId }
          );

          // Set new cookie with the new token
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            sameSite: "strict" as const,
            expires: dbExpiredAt,
          };

          res.cookie(
            process.env.RESPONDENT_COOKIE,
            newSessionId,
            cookieOptions
          );

          const newExtractedToken = FormsessionService.ExtractToken({
            token: newSessionId,
          }) as JwtPayload;

          req.formsession = {
            ...newExtractedToken,
            sub: newSessionId,
          } as never;
          return next();
        }
      } catch (error) {
        console.error("Token renewal failed:", error);
        return res.status(500).json(ReturnCode(500, "Token renewal failed"));
      }

      req.formsession = { ...extractedToken, sub: sessionToken } as never;
      return next();
    } catch (error) {
      console.log("Verfy Forn session", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public static VerifyRespondentFormSessionData = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { ty } = req.query as GetPublicFormDataType;
    const { formId } = req.params as { formId?: string };

    if (!formId)
      return res.status(400).json(ReturnCode(400, "Form id is missing"));

    try {
      switch (ty) {
        case GetPublicFormDataTyEnum.initial: {
          return next();
        }
        case GetPublicFormDataTyEnum.data: {
          //Verify Sesion
          await this.VerifyFormsession(req, res, next);
          return;
        }

        default:
          return res.status(400).json(ReturnCode(400));
      }
    } catch (error) {
      console.log("Verify Respondent Form session", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
  public static VerifyUserRespondentLogin = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!process.env.REFRESH_TOKEN_COOKIE)
      return res.status(500).json(ReturnCode(500));

    const existCookie = req.cookies[process.env.REFRESH_TOKEN_COOKIE];
    try {
      if (!existCookie) {
        return next();
      }

      await UserMiddleware.VerifyRefreshToken(req, res, next);
    } catch (error) {
      console.log("Verify User Response Login", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
}
