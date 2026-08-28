import { NextFunction, Response } from "express";
import { CustomRequest, RESPONSES } from "../types/customType";
import Formsession from "../model/Formsession.model";
import { isValidObjectId } from "mongoose";
import Form from "../model/Form.model";
import UserMiddleware, {
  GetPublicFormDataTyEnum,
  GetPublicFormDataType,
} from "./User.middleware";
import { JwtPayload } from "jsonwebtoken";
import {
  ExtractTokenPayload,
  GenerateToken,
  getDateByMinute,
} from "../utilities/helper";
import FormsessionService from "../controller/form/formsession.controller";
import { isValidObjectIdString } from "../utilities/formHelpers";

export interface FormSessionJWTPayloadType extends JwtPayload {
  email: string;
}

export default class FormsessionMiddleware {
  /**
   * Validates environment configuration for cookies
   */
  private static validateCookieConfig(): boolean {
    return !!(
      process.env.RESPONDENT_COOKIE && process.env.ACCESS_RESPONDENT_COOKIE
    );
  }

  /**
   * Validates form ID parameter
   */
  private static validateFormId(formId?: string): boolean {
    return !!(formId && isValidObjectId(formId));
  }

  public static VerifyFormsession = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!this.validateCookieConfig()) {
      res.status(500).json(RESPONSES.missingCookieConfig());
      return;
    }
    //Verify required param
    const { formId } = req.params as { formId?: string };

    if (!this.validateFormId(formId)) {
      res.status(400).json(RESPONSES.invalidFormId());
      return;
    }
    try {
      //Verify initial formdata
      const form = await Form.findById(formId)
        .select("type setting.email setting.acceptResponses")
        .lean();
      if (!form?.setting?.acceptResponses) {
        res.status(403).json(RESPONSES.formClosed());
        return;
      }

      if (!form.setting.email) {
        next();
        return;
      }

      // Extract both session_id and access_id from cookies
      const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE as string];
      const accessToken =
        req.cookies[process.env.ACCESS_RESPONDENT_COOKIE as string];

      if (!sessionToken) {
        res.status(401).json(RESPONSES.missingSessionToken());
        return;
      }

      // Verify session token
      const extractedSessionToken = ExtractTokenPayload({
        token: sessionToken,
        customSecret: process.env.RESPONDENT_TOKEN_JWT_SECRET as string,
      });

      //invalid token handle
      if (!extractedSessionToken) {
        await Formsession.deleteOne({ session_id: sessionToken });
        res.status(401).json(RESPONSES.invalidSessionToken());
        return;
      }

      try {
        // Find session using both session_id and access_id for validation
        const sessionQuery = {
          $and: [
            { form: formId },
            { session_id: sessionToken },
            ...(accessToken ? [{ access_id: accessToken }] : []),
          ],
        };

        const isSession = await Formsession.findOne(sessionQuery).lean();

        if (!isSession) {
          res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE as string);
          res.clearCookie(process.env.RESPONDENT_COOKIE as string);

          res.status(401).json(RESPONSES.sessionNotFound());
          return;
        }

        //Access Token Handler
        const verifiedAccessToken = accessToken
          ? ExtractTokenPayload({
              token: accessToken,
              customSecret: process.env.RESPONDENT_TOKEN_JWT_SECRET,
            })
          : undefined;

        // Renew access tokens if needed happen cuz session token still valid
        if (!verifiedAccessToken) {
          const newAccessId = GenerateToken(
            { email: isSession.respondentEmail },
            "30m",
          );

          // Update both session_id and access_id in database
          await Formsession.updateOne(
            { session_id: sessionToken },
            {
              access_id: newAccessId,
            },
          );

          const newExtractedAccessToken = FormsessionService.ExtractToken({
            token: newAccessId,
          });

          req.formsession = {
            sub: sessionToken,
            access_token: newAccessId,
            access_payload: newExtractedAccessToken,
          } as never;

          FormsessionService.setCookie(
            res,
            newAccessId,
            process.env.ACCESS_RESPONDENT_COOKIE as string,
            getDateByMinute(30),
          );

          next();
          return;
        }

        // No renewal needed - use existing tokens
        req.formsession = {
          sub: sessionToken,
          access_token: accessToken,
          access_payload: verifiedAccessToken,
        } as never;
        next();
      } catch (error) {
        console.error("Token renewal failed:", error);
        res.status(500).json(RESPONSES.tokenRenewalError());
      }
    } catch (error) {
      console.error("Verify Form session error:");
      res.status(500).json(RESPONSES.internalServerError());
    }
  };

  public static VerifyRespondentFormSessionData = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const { ty } = req.query as GetPublicFormDataType;
    const { formId } = req.params as { formId?: string };

    if (!formId || !isValidObjectIdString(formId)) {
      res.status(400).json(RESPONSES.missingFormId());
      return;
    }

    try {
      switch (ty) {
        case GetPublicFormDataTyEnum.initial: {
          // Check for both session and access tokens
          const isLoggedIn = process.env.RESPONDENT_COOKIE
            ? req.cookies[process.env.RESPONDENT_COOKIE]
            : undefined;

          if (isLoggedIn) {
            await this.VerifyFormsession(req, res, next);
            return;
          }

          next();
          return;
        }
        case GetPublicFormDataTyEnum.data: {
          //Verify Session with both tokens
          await this.VerifyFormsession(req, res, next);
          return;
        }

        case GetPublicFormDataTyEnum.preview: {
          await UserMiddleware.VerifyToken(req, res, next);
          return;
        }

        default:
          return res.status(400).json(RESPONSES.invalidRequestType());
      }
    } catch (error) {
      console.error("Verify Respondent Form session error:", error);
      return res.status(500).json(RESPONSES.internalServerError());
    }
  };
  public static VerifyUserRespondentLogin = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!process.env.REFRESH_TOKEN_COOKIE)
      return res.status(500).json(RESPONSES.missingRefreshTokenConfig());

    const existCookie = req.cookies[process.env.REFRESH_TOKEN_COOKIE];
    try {
      if (!existCookie) {
        return next();
      }

      await UserMiddleware.VerifyRefreshToken(req, res, next);
    } catch (error) {
      console.error("Verify User Response Login error:", error);
      return res.status(500).json(RESPONSES.internalServerError());
    }
  };
}
