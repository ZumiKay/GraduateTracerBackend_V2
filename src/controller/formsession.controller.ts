import { Response } from "express";
import { CustomRequest, UserToken } from "../types/customType";
import {
  ExtractTokenPaylod,
  GenerateToken,
  getDateByMinute,
  getDateByNumDay,
  ReturnCode,
} from "../utilities/helper";
import { z } from "zod";
import JWT, { JwtPayload } from "jsonwebtoken";
import Formsession, { Formsessiondatatype } from "../model/Formsession.model";
import { Model } from "mongoose";
import { sendRemovalLinkEmail } from "../utilities/removalEmail";
import Form, { FormType, TypeForm } from "../model/Form.model";
import User from "../model/User.model";
import { compareSync } from "bcrypt";
import Usersession from "../model/Usersession.model";

interface RespodentLoginProps {
  formId: string;
  email: string;
  name?: string;
  rememberMe: boolean;
  password?: string;
  isGuest?: boolean;
  isSwitched?: boolean | string;
  existed?: string;
}

export default class FormsessionService {
  // 📋 Validation schemas - defined once for reuse

  private static readonly respondentLoginSchema = z.object({
    formId: z.string().min(1),
    email: z.string().email().optional(),
    rememberMe: z.boolean().optional(),
    password: z.string().optional(),
    isGuest: z.boolean().optional(),
    existed: z.string().optional(),
  });

  private static readonly sendEmailSchema = z.object({
    respondentEmail: z.string().email(),
    removeCode: z.string().min(1),
    formId: z.string().optional(),
  });

  public static async GenerateUniqueSessionId({
    email,
    maxAttempts = 3, // ⚡ Reduced attempts for better performance
    expireIn = "1d",
  }: {
    email: string;
    maxAttempts?: number;
    expireIn?: string | number;
  }): Promise<string> {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
    }

    const basePayload = {
      email,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2),
      process: process.pid, // Process ID for multi-instance uniqueness
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const payload = {
        ...basePayload,
        attempt,
        entropy: Math.random().toString(36).substring(2),
        nanotime: process.hrtime.bigint().toString(), // High-resolution time
      };

      const session_id = GenerateToken(
        payload,
        expireIn,
        process.env.RESPONDENT_TOKEN_JWT_SECRET
      );

      const existingSession = await Formsession.exists({ session_id }).lean();

      if (!existingSession) {
        return session_id;
      }
    }

    const fallbackPayload = {
      ...basePayload,
      fallback: true,
      microseconds: process.hrtime.bigint().toString(),
      uuid: Math.random().toString(36) + Math.random().toString(36), // Double random
    };

    const fallbackId = GenerateToken(
      fallbackPayload,
      expireIn,
      process.env.RESPONDENT_TOKEN_JWT_SECRET
    );

    return fallbackId;
  }

  public static async GenerateUniqueAccessId({
    email,
    formId,
    maxAttempts = 3, // ⚡ Reduced attempts for better performance
    expireIn = "1d",
  }: {
    email: string;
    formId?: string;
    maxAttempts?: number;
    expireIn?: string;
  }): Promise<string> {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
    }

    // ⚡ Enhanced base payload for access_id with more entropy
    const basePayload = {
      email,
      formId: formId || "public",
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2),
      type: "access_id", // Distinguish from session_id
      process: process.pid, // Process ID for multi-instance uniqueness
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // ⚡ Enhanced entropy generation
      const payload = {
        ...basePayload,
        attempt,
        entropy: Math.random().toString(36).substring(2),
        nanotime: process.hrtime.bigint().toString(), // High-resolution time
      };

      const access_id = GenerateToken(
        payload,
        expireIn,
        process.env.RESPONDENT_TOKEN_JWT_SECRET
      );

      // ⚡ Optimized existence check with lean query
      const existingAccess = await Formsession.exists({ access_id }).lean();

      if (!existingAccess) {
        return access_id;
      }
    }

    // ⚡ Enhanced fallback with maximum entropy
    const fallbackPayload = {
      ...basePayload,
      fallback: true,
      microseconds: process.hrtime.bigint().toString(),
      uuid: Math.random().toString(36) + Math.random().toString(36), // Double random
    };

    const fallbackId = GenerateToken(
      fallbackPayload,
      expireIn,
      process.env.RESPONDENT_TOKEN_JWT_SECRET
    );

    return fallbackId;
  }

  private static async handleDuplicateSession(
    email: string,
    formId: string,
    res: Response,
    form: { type: TypeForm; setting?: { submitonce?: boolean } }
  ): Promise<boolean> {
    try {
      const requiresDuplicateSessionHandling =
        form.type === TypeForm.Quiz ||
        (form.type === TypeForm.Normal && form.setting?.submitonce === true);

      if (!requiresDuplicateSessionHandling) {
        return false;
      }

      const existingSession = await Formsession.findOne({
        $and: [{ respondentEmail: email }, { form: formId }],
      })
        .select("session_id access_id _id")
        .lean()
        .exec();

      if (!existingSession) {
        return false;
      }

      const [isSessionActive, isAccessActive] = [
        this.ExtractToken({ token: existingSession.session_id }),
        existingSession.access_id
          ? this.ExtractToken({ token: existingSession.access_id })
          : false,
      ];

      if (isSessionActive) {
        if (isAccessActive) {
          try {
            const [removeCode] = await Promise.all([
              this.GenerateUniqueRemoveCode({ formsession: Formsession }),
            ]);

            await Promise.all([
              Formsession.updateOne(
                { session_id: existingSession.session_id },
                { removeCode }
              ),
              this.SendRemovalEmail({
                respondentEmail: email,
                removeCode: removeCode.toString(),
                formId: formId,
              }),
            ]);

            res.status(403).json({
              success: false,
              status: 403,
              message:
                "There is already an active session. If it's not you, please check your email for removal instructions.",
            });
            return true;
          } catch (emailError) {
            console.error(
              `Error sending removal email for ${email}:`,
              emailError
            );
            res.status(403).json({
              success: false,
              status: 403,
              message:
                "There is already an active session. Please try again later.",
            });
            return true;
          }
        }

        // ⚡ Reactivate session - generate new access_id
        try {
          const newAccessId = await this.GenerateUniqueAccessId({
            email,
            formId, // Include formId for better uniqueness
            expireIn: "30m",
          });

          this.setCookie(
            res,
            newAccessId,
            process.env.ACCESS_RESPONDENT_COOKIE as string,
            getDateByMinute(30)
          );

          await Formsession.updateOne(
            { session_id: existingSession.session_id },
            { access_id: newAccessId, removeCode: null }
          );

          res.status(200).json({
            success: true,
            status: 200,
            message: "Session reactivated successfully",
          });
          return true; // Return true to indicate response was sent
        } catch (reactivateError) {
          console.error(
            `Error reactivating session for ${email}:`,
            reactivateError
          );
          res.status(500).json({
            success: false,
            status: 500,
            message: "Failed to reactivate session",
          });
          return true;
        }
      } else {
        // ⚡ Remove expired session before creating new one
        try {
          await Formsession.deleteOne({ _id: existingSession._id });
          return false;
        } catch (deleteError) {
          console.error(
            `Error deleting expired session for ${email}:`,
            deleteError
          );
          // Continue with normal flow even if deletion fails
          return false;
        }
      }
    } catch (error) {
      console.error(`Error handling duplicate session for ${email}:`, error);
      res.status(500).json({
        success: false,
        status: 500,
        message: "Verification Error",
      });
      return true; // Return true to indicate error response was sent
    }
  }

  public static setCookie(
    res: Response,
    sessionId: string,
    cookie?: string,
    expiredAt?: Date
  ): void {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
      sameSite: "strict" as const,
      maxAge: expiredAt ? expiredAt.getTime() - Date.now() : undefined,
    };

    res.cookie(
      cookie ?? (process.env.RESPONDENT_COOKIE as string),
      sessionId,
      cookieOptions
    );
  }

  /**
   * Handles respondent login for form access with optimized performance
   *
   * Features:
   * - Early validation and fail-fast strategy
   * - Parallel database queries for better performance
   * - Comprehensive error handling with specific error codes
   * - Support for guest and authenticated users
   * - Session reactivation for existing users
   *
   * @param req - Custom request with respondent login data
   * @param res - Express response object
   */
  public static RespondentLogin = async (req: CustomRequest, res: Response) => {
    if (
      !process.env.RESPONDENT_TOKEN_JWT_SECRET ||
      !process.env.ACCESS_RESPONDENT_COOKIE ||
      !process.env.RESPONDENT_COOKIE
    ) {
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_ENV_VARIABLES",
      });
    }

    const validationResult = this.respondentLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Validation failed",
        error: "VALIDATION_ERROR",
        errors: validationResult.error.errors,
      });
    }

    const { formId, email, password, rememberMe, isGuest, name, existed } =
      validationResult.data as RespodentLoginProps;

    try {
      const [form, userData] = await Promise.all([
        Form.findById(formId)
          .select(
            "type setting.acceptResponses setting.acceptGuest setting.submitonce"
          )
          .lean()
          .exec(),

        // Only query user if not guest and password provided
        !isGuest && password
          ? User.findOne({ email }).select("email password").lean().exec()
          : Promise.resolve(null),
      ]);

      if (!form) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Form not found",
          error: "FORM_NOT_FOUND",
        });
      }

      if (!form.setting?.acceptResponses) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: "Form is closed",
          error: "FORM_CLOSED",
        });
      }

      // Normal forms don't require authentication
      if (form.type === TypeForm.Normal) {
        return res.status(204).json({
          success: true,
          status: 204,
          message: "Normal form type",
        });
      }

      // Validate guest access
      if (isGuest && !form.setting?.acceptGuest) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: "Form does not accept guest",
          error: "GUEST_NOT_ALLOWED",
        });
      }

      if (!isGuest && !existed) {
        if (!password) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: "Password required",
            error: "PASSWORD_REQUIRED",
          });
        }

        if (!userData) {
          return res.status(401).json({
            success: false,
            status: 401,
            message: "User not found",
            error: "USER_NOT_FOUND",
          });
        }

        const isValidPassword = compareSync(password, userData.password);
        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            status: 401,
            message: "Invalid password",
            error: "INVALID_PASSWORD",
          });
        }
      }

      let expiredAt: Date | undefined = rememberMe
        ? getDateByNumDay(7)
        : getDateByNumDay(1);
      const accessExpiredAt = getDateByMinute(30);

      //  Generate tokens in parallel
      let session_id: string;
      let access_id: string;

      let isExistedLogin = existed === "1";
      let existedUserRefreshToken: UserToken | string | undefined =
        isExistedLogin &&
        req.cookies[process.env.REFRESH_TOKEN_COOKIE as string];

      //Check usersession if existed login
      if (existedUserRefreshToken) {
        const isVerified = ExtractTokenPaylod({
          token: existedUserRefreshToken as string,
        });

        if (!isVerified) return res.status(401).json(ReturnCode(401));

        const isUser = await Usersession.findOne({
          session_id: existedUserRefreshToken,
        })
          .select("expireAt user")
          .populate("user")
          .lean();

        if (!isUser || !isUser.user?.email)
          return res.status(401).json(ReturnCode(401));

        if (isUser.expireAt <= new Date()) {
          await Usersession.deleteOne({ _id: isUser._id });
          return res.status(401).json(ReturnCode(401));
        }

        existedUserRefreshToken = {
          ...(isVerified as UserToken),
          userDetails: {
            _id: isUser._id,
            email: isUser.user.email as string,
            role: isUser.user.role,
          },
        };
        expiredAt = isUser.expireAt;
      }

      //Duplication session prevention

      const userEmail = (
        isExistedLogin
          ? (existedUserRefreshToken as UserToken).userDetails?.email
          : email
      ) as string;

      const hasDuplicateSession = await this.handleDuplicateSession(
        userEmail,
        formId,
        res,
        form
      );

      if (hasDuplicateSession) {
        return; // Response already sent by handleDuplicateSession
      }

      const expiresInSeconds = expiredAt
        ? Math.floor((expiredAt.getTime() - Date.now()) / 1000)
        : "1d"; //Testing expiration token

      try {
        [session_id, access_id] = await Promise.all([
          this.GenerateUniqueSessionId({
            email: userEmail,
            expireIn: expiresInSeconds,
          }),
          this.GenerateUniqueAccessId({
            email: userEmail,
            formId,
            expireIn: "1m",
          }),
        ]);
      } catch (tokenError) {
        console.error("Token generation error:", tokenError);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to generate session tokens",
          error: "TOKEN_GENERATION_ERROR",
          details:
            process.env.NODE_ENV === "DEV"
              ? tokenError instanceof Error
                ? tokenError.message
                : String(tokenError)
              : undefined,
        });
      }

      try {
        await Formsession.create({
          form: formId,
          session_id,
          access_id,
          expiredAt,
          respondentEmail: userEmail,
          respondentName: name || userEmail.split("@")[0], // Extract name from email if not provided
          isGuest,
        });
      } catch (sessionCreateError) {
        console.error("Session creation error:", sessionCreateError);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to create session",
          error: "SESSION_CREATION_ERROR",
          details:
            process.env.NODE_ENV === "DEV"
              ? sessionCreateError instanceof Error
                ? sessionCreateError.message
                : String(sessionCreateError)
              : undefined,
        });
      }

      // ⚡ Set authentication cookies
      try {
        // Set main session cookie (refresh token)
        this.setCookie(
          res,
          session_id,
          process.env.RESPONDENT_COOKIE,
          expiredAt
        );

        // Set access token cookie
        this.setCookie(
          res,
          access_id,
          process.env.ACCESS_RESPONDENT_COOKIE as string,
          accessExpiredAt
        );

        return res.status(200).json({
          success: true,
          status: 200,
          message: "Login successful",
          data: {
            expiresAt: expiredAt?.toISOString(),
            isGuest,
          },
        });
      } catch (cookieError) {
        console.error("Cookie setting error:", cookieError);

        // Session created but cookies failed - cleanup session
        await Formsession.deleteOne({ session_id }).catch((cleanupError) => {
          console.error(
            "Failed to cleanup session after cookie error:",
            cleanupError
          );
        });

        return res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to set authentication cookies",
          error: "COOKIE_SETTING_ERROR",
        });
      }
    } catch (error) {
      console.error("RespondentLogin error:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error during login",
        error: "INTERNAL_SERVER_ERROR",
        details:
          process.env.NODE_ENV === "DEV"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      });
    }
  };

  //   Replace all active session with new one
  public static ReplaceSession = async (req: CustomRequest, res: Response) => {
    if (
      !process.env.RESPONDENT_TOKEN_JWT_SECRET ||
      !process.env.ACCESS_RESPONDENT_COOKIE ||
      !process.env.RESPONDENT_COOKIE
    ) {
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_ENV_VARIABLES",
      });
    }

    const { code } = req.params as { code?: string };
    const { skiplogin } = req.query as { skiplogin?: string };

    if (!code) return res.status(404).json(ReturnCode(404));

    const isSkipAutoLogin = skiplogin ? parseInt(skiplogin, 10) : undefined;
    if (
      isSkipAutoLogin &&
      (isSkipAutoLogin !== 1 || (isSkipAutoLogin && isNaN(isSkipAutoLogin)))
    ) {
      return res.status(400).json(ReturnCode(400));
    }

    try {
      const formsession = await Formsession.findOne({
        removeCode: parseInt(code),
      })
        .populate({
          path: "form",
          select: "setting.acceptResponses",
          options: { lean: true },
        })
        .select("_id form respondentEmail respondentName isGuest")
        .lean()
        .exec();

      if (!formsession) {
        return res.status(404).json(ReturnCode(404, "Invalid code"));
      }

      const form = formsession.form as Pick<FormType, "setting">;
      if (!form?.setting?.acceptResponses) {
        return res.status(404).json(ReturnCode(404, "Form is closed"));
      }

      if (isSkipAutoLogin === 1) {
        await Formsession.deleteOne({ _id: formsession._id }).lean();
        return res.status(200).json(ReturnCode(200));
      }

      const [newUniqueSessionId, newUniqueAccessId] = await Promise.all([
        this.GenerateUniqueSessionId({
          email: formsession.respondentEmail,
          expireIn: "7d",
        }),

        this.GenerateUniqueAccessId({
          email: formsession.respondentEmail,
          expireIn: "30m",
        }),
      ]);

      const expiredAt = formsession.isGuest
        ? getDateByNumDay(1)
        : getDateByNumDay(7);

      await Formsession.updateOne(
        { _id: formsession._id },
        {
          session_id: newUniqueSessionId,
          access_id: newUniqueAccessId,
          expiredAt,
          $unset: { removeCode: 1 },
        }
      ).lean();

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
        sameSite: "strict" as const,
      };

      // Set main session cookie
      res.cookie(process.env.RESPONDENT_COOKIE as string, newUniqueSessionId, {
        ...cookieOptions,
        maxAge: expiredAt.getTime() - Date.now(),
      });

      // Set access cookie with shorter expiration
      if (newUniqueAccessId) {
        const accessExpiry = getDateByMinute(30);
        res.cookie(
          process.env.ACCESS_RESPONDENT_COOKIE as string,
          newUniqueAccessId,
          { ...cookieOptions, maxAge: accessExpiry.getTime() - Date.now() }
        );
      }

      return res.status(200).json(ReturnCode(200, "Logging to form"));
    } catch (error) {
      console.error("Replace form session error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Session replacement failed"));
    }
  };

  public static SignOut = async (req: CustomRequest, res: Response) => {
    try {
      await Formsession.deleteOne({ session_id: req.formsession?.sub });

      // Clear cookies with the same options used when setting them
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
        sameSite: "strict" as const,
      };

      // Clear both respondent cookies
      res.clearCookie(process.env.RESPONDENT_COOKIE as string, cookieOptions);
      res.clearCookie(
        process.env.ACCESS_RESPONDENT_COOKIE as string,
        cookieOptions
      );

      // Return success only after cookies are cleared
      return res.status(200).json(ReturnCode(200, "Logged Out"));
    } catch (error) {
      console.log("SignOut", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  /*
   *Session verification && Renew
   */
  public static SessionVerification = async (
    req: CustomRequest,
    res: Response
  ) => {
    if (
      !process.env.RESPONDENT_COOKIE ||
      !process.env.RESPONDENT_TOKEN_JWT_SECRET ||
      !process.env.ACCESS_RESPONDENT_COOKIE
    ) {
      return res.status(500).json(ReturnCode(500));
    }
    const respondentCookie =
      req.cookies[process.env.RESPONDENT_COOKIE as string];
    const accessRespondentCookie =
      req.cookies[process.env.ACCESS_RESPONDENT_COOKIE as string];

    //If no logged in session no content
    if (!respondentCookie) {
      return res.status(204).json(ReturnCode(204));
    }

    try {
      const session = await Formsession.findOne({
        session_id: respondentCookie,
      }).lean();

      if (!session) return res.status(401).json(ReturnCode(401));

      const extractedToken = this.ExtractToken({
        token: respondentCookie,
      });

      //Refresh token expired or invalid
      if (extractedToken.isExpired || !extractedToken.data) {
        //Clear invalid session
        res.clearCookie(process.env.RESPONDENT_COOKIE as string);
        res.clearCookie(process.env.ACCESS_RESPONDENT_COOKIE as string);
        await Formsession.deleteOne({ session_id: respondentCookie });
        return res.status(401).json(ReturnCode(401, "Session expired"));
      }

      //Verify AccessTokeno
      const verifiedAccessToken = this.ExtractToken({
        token: accessRespondentCookie,
      });

      if (!verifiedAccessToken.data && !verifiedAccessToken.isExpired) {
        return res.status(401).json({
          ...ReturnCode(401, "Invalid Session"),
          data: {
            respondentEmail: session.respondentEmail,
          },
        });
      }

      //If access token expired, regenerate it
      if (verifiedAccessToken.isExpired) {
        try {
          const newAccessId = await this.GenerateUniqueAccessId({
            email: session.respondentEmail,
            formId: session.form?.toString(),
            expireIn: "30m",
          });

          await Formsession.updateOne(
            { session_id: respondentCookie },
            { access_id: newAccessId }
          );

          this.setCookie(
            res,
            newAccessId,
            process.env.ACCESS_RESPONDENT_COOKIE as string,
            getDateByMinute(30)
          );
        } catch (refreshError) {
          return res
            .status(401)
            .json(ReturnCode(401, "Session refresh failed"));
        }
      }

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          respondentEmail: session.respondentEmail,
          respondentName: session.respondentName,
          isGuest: session.isGuest,
        },
      });
    } catch (error) {
      console.log("Session verification", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public static ExtractToken = ({
    token,
  }: {
    token: string;
  }): { data: string | JwtPayload | null; isExpired?: boolean } => {
    try {
      const isValid = JWT.verify(
        token,
        process.env.RESPONDENT_TOKEN_JWT_SECRET || "secret"
      );

      if (isValid) {
        return { data: isValid };
      }
      return { data: null };
    } catch (error) {
      if (error instanceof JWT.TokenExpiredError) {
        return { data: null, isExpired: true };
      }
      return { data: null };
    }
  };
  private static GenerateUniqueRemoveCode = async ({
    formsession,
    maxAttempts = 5, // Reduced from 10 for better performance
  }: {
    formsession: Model<Formsessiondatatype>;
    maxAttempts?: number;
  }): Promise<number> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate 6-digit codes with better distribution
      const removeCode = Math.floor(100000 + Math.random() * 900000);

      const existingCode = await formsession.exists({ removeCode });

      if (!existingCode) {
        return removeCode;
      }
    }

    // Fallback with timestamp-based uniqueness
    const timestampCode = Math.floor(Date.now() % 900000) + 100000;
    return timestampCode;
  };

  private static SendRemovalEmail = async ({
    respondentEmail,
    removeCode,
    formId,
  }: {
    respondentEmail: string;
    removeCode: string;
    formId?: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      if (!formId) return { success: false, message: "Missing Parameter" };

      // Get form title if formId is provided

      const form = await Form.findById(formId).select("title").lean();

      if (!form) return { success: false, message: "Form not found" };

      const result = await sendRemovalLinkEmail(
        respondentEmail,
        removeCode,
        formId,
        form?.title ?? "Form"
      );

      if (result.success) {
        console.log(`Removal email sent successfully to ${respondentEmail}`);
      } else {
        console.error(
          `Failed to send removal email to ${respondentEmail}: ${result.message}`
        );
      }

      return result;
    } catch (error: any) {
      console.error("SendRemovalEmail error:", error);
      return {
        success: false,
        message: `Failed to send removal email: ${error.message}`,
      };
    }
  };

  public static SendRemovalEmailEndpoint = async (
    req: CustomRequest,
    res: Response
  ) => {
    const { respondentEmail, removeCode, formId } = req.body;

    const validationResult = this.sendEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        ...ReturnCode(400, "Invalid request parameters"),
        errors: validationResult.error.errors,
      });
    }

    try {
      const result = await this.SendRemovalEmail({
        respondentEmail,
        removeCode,
        formId,
      });

      if (result.success) {
        return res.status(200).json({
          ...ReturnCode(200, "Removal email sent successfully"),
        });
      } else {
        return res.status(500).json({
          ...ReturnCode(500, result.message),
        });
      }
    } catch (error) {
      console.error("SendRemovalEmailEndpoint error:", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
}
