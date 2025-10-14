import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/customType";
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
    if (!process.env.RESPONDENT_COOKIE || !process.env.ACCESS_RESPONDENT_COOKIE)
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_COOKIE_CONFIG",
      });

    //Verify required param
    const { formId } = req.params as { formId?: string };
    if (!formId || !isValidObjectId(formId))
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Invalid or missing form ID",
        error: "INVALID_FORM_ID",
      });

    try {
      //Verify initial formdata
      const form = await Form.findById(formId)
        .select("type setting.email setting.acceptResponses")
        .lean();
      if (!form?.setting?.acceptResponses)
        return res.status(403).json({
          success: false,
          status: 403,
          message: "Form is closed",
          error: "FORM_CLOSED",
        });

      if (form?.type === TypeForm.Normal) {
        return next();
      }

      // Extract both session_id and access_id from cookies
      const sessionToken = req.cookies[process.env.RESPONDENT_COOKIE];
      const accessToken = req.cookies[process.env.ACCESS_RESPONDENT_COOKIE];

      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: "Session token required",
          error: "MISSING_SESSION_TOKEN",
        });
      }

      // Verify session token
      const extractedSessionToken = FormsessionService.ExtractToken({
        token: sessionToken,
      }) as JwtPayload;

      if (extractedSessionToken === null) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: "Invalid session token",
          error: "INVALID_SESSION_TOKEN",
        });
      }

      // Verify access token if present
      let extractedAccessToken: JwtPayload | null = null;
      if (accessToken) {
        extractedAccessToken = FormsessionService.ExtractToken({
          token: accessToken,
        }) as JwtPayload;
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
          return res.status(401).json({
            success: false,
            status: 401,
            message: "Session not found",
            error: "SESSION_NOT_FOUND",
          });
        }

        const dbExpiredAt = new Date(isSession.expiredAt);
        if (dbExpiredAt <= new Date()) {
          await Formsession.deleteOne({ session_id: sessionToken });
          return res.status(401).json({
            success: false,
            status: 401,
            message: "Session expired",
            error: "SESSION_EXPIRED",
          });
        }

        // Check if session token is expired or about to expire (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        const sessionTokenExp = extractedSessionToken.exp;
        const fiveMinutesFromNow = now + 5 * 60; // 5 minutes buffer

        // Check if access token is expired or missing
        const isAccessTokenExpired =
          !extractedAccessToken ||
          (extractedAccessToken.exp && extractedAccessToken.exp < now);

        // Renew tokens if needed
        if (
          (sessionTokenExp && sessionTokenExp < fiveMinutesFromNow) ||
          isAccessTokenExpired
        ) {
          console.log(
            `Token renewal triggered for session: ${sessionToken.substring(
              0,
              10
            )}...`
          );

          const [newSessionId, newAccessId] = await Promise.all([
            FormsessionService.GenerateUniqueSessionId({
              email: isSession.respondentEmail,
              expireIn: this.calculateTokenExpiresIn(dbExpiredAt),
            }),
            FormsessionService.GenerateUniqueAccessId({
              email: isSession.respondentEmail,
              formId: formId,
              expireIn: "30m", // Access token shorter expiry
            }),
          ]);

          // Update both session_id and access_id in database
          await Formsession.updateOne(
            { session_id: sessionToken },
            {
              session_id: newSessionId,
              access_id: newAccessId,
            }
          );

          // Set new cookies with both tokens
          const sessionCookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            sameSite: "strict" as const,
            expires: dbExpiredAt,
          };

          const accessCookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "PROD",
            sameSite: "strict" as const,
            maxAge: 30 * 60 * 1000, // 30 minutes
          };

          res.cookie(
            process.env.RESPONDENT_COOKIE,
            newSessionId,
            sessionCookieOptions
          );

          res.cookie(
            process.env.ACCESS_RESPONDENT_COOKIE,
            newAccessId,
            accessCookieOptions
          );

          const newExtractedSessionToken = FormsessionService.ExtractToken({
            token: newSessionId,
          }) as JwtPayload;

          const newExtractedAccessToken = FormsessionService.ExtractToken({
            token: newAccessId,
          }) as JwtPayload;

          req.formsession = {
            ...newExtractedSessionToken,
            sub: newSessionId,
            access_token: newAccessId,
            access_payload: newExtractedAccessToken,
          } as never;
          return next();
        }

        // No renewal needed - use existing tokens
        req.formsession = {
          ...extractedSessionToken,
          sub: sessionToken,
          access_token: accessToken,
          access_payload: extractedAccessToken,
        } as never;
        return next();
      } catch (error) {
        console.error("Token renewal failed:", error);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Token renewal failed",
          error: "TOKEN_RENEWAL_ERROR",
        });
      }
    } catch (error) {
      console.error("Verify Form session error:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
      });
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
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Form ID is missing",
        error: "MISSING_FORM_ID",
      });

    try {
      switch (ty) {
        case GetPublicFormDataTyEnum.initial: {
          // Check for both session and access tokens
          const isLoggedIn = process.env.RESPONDENT_COOKIE
            ? req.cookies[process.env.RESPONDENT_COOKIE]
            : undefined;

          const hasAccessToken = process.env.ACCESS_RESPONDENT_COOKIE
            ? req.cookies[process.env.ACCESS_RESPONDENT_COOKIE]
            : undefined;

          if (isLoggedIn || hasAccessToken) {
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
          return res.status(400).json({
            success: false,
            status: 400,
            message: "Invalid request type",
            error: "INVALID_REQUEST_TYPE",
          });
      }
    } catch (error) {
      console.error("Verify Respondent Form session error:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error during session verification",
        error: "INTERNAL_SERVER_ERROR",
      });
    }
  };
  public static VerifyUserRespondentLogin = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!process.env.REFRESH_TOKEN_COOKIE)
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_REFRESH_TOKEN_CONFIG",
      });

    const existCookie = req.cookies[process.env.REFRESH_TOKEN_COOKIE];
    try {
      if (!existCookie) {
        return next();
      }

      await UserMiddleware.VerifyRefreshToken(req, res, next);
    } catch (error) {
      console.error("Verify User Response Login error:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error during user verification",
        error: "INTERNAL_SERVER_ERROR",
      });
    }
  };
}
