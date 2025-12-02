import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/customType";
import Formsession from "../model/Formsession.model";
import { isValidObjectId } from "mongoose";
import Form, { TypeForm } from "../model/Form.model";
import UserMiddleware, {
  GetPublicFormDataTyEnum,
  GetPublicFormDataType,
} from "./User.middleware";
import { JwtPayload } from "jsonwebtoken";
import { getDateByMinute, ReturnCode } from "../utilities/helper";
import FormsessionService from "../controller/form/formsession.controller";

export interface FormSessionJWTPayloadType extends JwtPayload {
  email: string;
}

// Response templates for common error scenarios
const RESPONSES = {
  missingCookieConfig: () => ({
    success: false,
    status: 500,
    message: "Server configuration error",
    error: "MISSING_COOKIE_CONFIG",
  }),
  invalidFormId: () => ({
    success: false,
    status: 400,
    message: "Invalid or missing form ID",
    error: "INVALID_FORM_ID",
  }),
  formClosed: () => ({
    success: false,
    status: 403,
    message: "Form is closed",
    error: "FORM_CLOSED",
  }),
  missingSessionToken: () => ({
    success: false,
    status: 401,
    message: "Session token required",
    error: "MISSING_SESSION_TOKEN",
  }),
  invalidSessionToken: () => ({
    success: false,
    status: 401,
    message: "Invalid session token",
    error: "INVALID_SESSION_TOKEN",
  }),
  sessionNotFound: () => ({
    success: false,
    status: 401,
    message: "Session not found",
    error: "SESSION_NOT_FOUND",
  }),
  sessionExpired: () => ({
    success: false,
    status: 401,
    message: "Session expired",
    error: "SESSION_EXPIRED",
  }),
  invalidAccessToken: () => ({
    success: false,
    status: 401,
    message: "Invalid Session",
    error: "INVALID_ACCESS_TOKEN",
  }),
  tokenRenewalError: () => ({
    success: false,
    status: 500,
    message: "Token renewal failed",
    error: "TOKEN_RENEWAL_ERROR",
  }),
  internalServerError: () => ({
    success: false,
    status: 500,
    message: "Internal server error",
    error: "INTERNAL_SERVER_ERROR",
  }),
  missingFormId: () => ({
    success: false,
    status: 400,
    message: "Form ID is missing",
    error: "MISSING_FORM_ID",
  }),
  invalidRequestType: () => ({
    success: false,
    status: 400,
    message: "Invalid request type",
    error: "INVALID_REQUEST_TYPE",
  }),
  missingRefreshTokenConfig: () => ({
    success: false,
    status: 500,
    message: "Server configuration error",
    error: "MISSING_REFRESH_TOKEN_CONFIG",
  }),
} as const;

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

  /**
   * Checks if session has expired
   */
  private static isSessionExpired(
    dbExpiredAt: Date,
    isTokenExpired: boolean | undefined
  ): boolean {
    return dbExpiredAt <= new Date() || !!isTokenExpired;
  }

  public static VerifyFormsession = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!this.validateCookieConfig())
      return res.status(500).json(RESPONSES.missingCookieConfig());

    //Verify required param
    const { formId } = req.params as { formId?: string };

    if (!this.validateFormId(formId))
      return res.status(400).json(RESPONSES.invalidFormId());

    try {
      //Verify initial formdata
      const form = await Form.findById(formId)
        .select("type setting.email setting.acceptResponses")
        .lean();
      if (!form?.setting?.acceptResponses)
        return res.status(403).json(RESPONSES.formClosed());

      if (form?.type === TypeForm.Normal && !form.setting.email) {
        return next();
      }

      // Extract both session_id and access_id from cookies
      const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE as string];
      const accessToken =
        req.cookies[process.env.ACCESS_RESPONDENT_COOKIE as string];

      if (!sessionToken) {
        return res.status(401).json(RESPONSES.missingSessionToken());
      }

      // Verify session token
      const extractedSessionToken = FormsessionService.ExtractToken({
        token: sessionToken,
      });

      if (!extractedSessionToken.data) {
        return res.status(401).json(RESPONSES.invalidSessionToken());
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
          return res.status(401).json(RESPONSES.sessionNotFound());
        }

        const dbExpiredAt = new Date(isSession.expiredAt);
        if (
          this.isSessionExpired(dbExpiredAt, extractedSessionToken.isExpired)
        ) {
          await Formsession.deleteOne({ session_id: sessionToken });
          return res.status(401).json(RESPONSES.sessionExpired());
        }

        //Access Token Handler
        const verifiedAccessToken = accessToken
          ? FormsessionService.ExtractToken({
              token: accessToken,
            })
          : undefined;

        if (
          verifiedAccessToken &&
          !verifiedAccessToken?.isExpired &&
          !verifiedAccessToken?.data
        ) {
          return res.status(401).json(RESPONSES.invalidAccessToken());
        }

        // Renew access tokens if needed
        if (!verifiedAccessToken || verifiedAccessToken.isExpired) {
          const newAccessId = await FormsessionService.GenerateUniqueAccessId({
            email: isSession.respondentEmail,
            expireIn: "30m",
          });

          // Update both session_id and access_id in database
          await Formsession.updateOne(
            { session_id: sessionToken },
            {
              access_id: newAccessId,
            }
          );

          const newExtractedAccessToken = FormsessionService.ExtractToken({
            token: newAccessId,
          });

          req.formsession = {
            ...extractedSessionToken,
            sub: sessionToken,
            access_token: newAccessId,
            access_payload: newExtractedAccessToken,
          } as never;

          FormsessionService.setCookie(
            res,
            newAccessId,
            process.env.ACCESS_RESPONDENT_COOKIE as string,
            getDateByMinute(30)
          );

          return next();
        }

        // No renewal needed - use existing tokens
        req.formsession = {
          ...extractedSessionToken,
          sub: sessionToken,
          access_token: accessToken,
          access_payload: verifiedAccessToken.data,
        } as never;
        return next();
      } catch (error) {
        console.error("Token renewal failed:", error);
        return res.status(500).json(RESPONSES.tokenRenewalError());
      }
    } catch (error) {
      console.error("Verify Form session error:", error);
      return res.status(500).json(RESPONSES.internalServerError());
    }
  };

  public static VerifyRespondentFormSessionData = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    const { ty } = req.query as GetPublicFormDataType;
    const { formId } = req.params as { formId?: string };

    if (!formId) return res.status(400).json(RESPONSES.missingFormId());

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

          return next();
        }
        case GetPublicFormDataTyEnum.data: {
          //Verify Session with both tokens
          await this.VerifyFormsession(req, res, next);
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
    next: NextFunction
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
