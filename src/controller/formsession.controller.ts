import { Response } from "express";
import { CustomRequest } from "../types/customType";
import {
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

interface RespodentLoginProps {
  formId: string;
  email: string;
  rememberMe: boolean;
  password?: string;
  isGuest?: boolean;
  isSwitched?: boolean | string;
}

export default class FormsessionService {
  // 📋 Validation schemas - defined once for reuse

  private static readonly respondentLoginSchema = z.object({
    formId: z.string().min(1),
    email: z.string().email(),
    rememberMe: z.boolean(),
    password: z.string().optional(),
    isGuest: z.boolean().optional(),
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
    expireIn?: string;
  }): Promise<string> {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
    }

    // ⚡ Enhanced base payload with more entropy
    const basePayload = {
      email,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2),
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

      const session_id = GenerateToken(
        payload,
        expireIn,
        process.env.RESPONDENT_TOKEN_JWT_SECRET
      );

      // ⚡ Optimized existence check with lean query
      const existingSession = await Formsession.exists({ session_id }).lean();

      if (!existingSession) {
        return session_id;
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

  private static calculateExpiredAt(
    req: CustomRequest,
    rememberMe: boolean,
    isGuest?: boolean,
    isSwitched?: boolean
  ): Date {
    const hasJWT = req.user?.exp;
    const shouldUseJWT = hasJWT && !isGuest && !isSwitched;

    if (shouldUseJWT && req.user?.exp) {
      return new Date(req.user.exp * 1000);
    }

    return getDateByMinute(rememberMe ? 24 * 60 * 60 : 60 * 60);
  }

  public static async handleAutoLoginDuplicateSession(
    email: string,
    formId: string,
    form: { type: TypeForm; setting?: { submitonce?: boolean } }
  ): Promise<string | null> {
    try {
      // Check if this form type requires duplicate session handling
      const requiresDuplicateSessionHandling =
        form.type === TypeForm.Quiz ||
        (form.type === TypeForm.Normal && form.setting?.submitonce === true);

      if (!requiresDuplicateSessionHandling) {
        console.log(
          `Skipping auto-login duplicate session check for form ${formId} - type: ${form.type}, submitonce: ${form.setting?.submitonce}`
        );
        return null;
      }

      const existingSession = await Formsession.findOne({
        respondentEmail: email,
        form: formId,
      }).lean();

      if (!existingSession) {
        return null;
      }

      const isActive = this.ExtractToken({
        token: existingSession.session_id,
      });

      if (isActive) {
        console.log(
          `Auto-login duplicate active session detected for email: ${email}, formId: ${formId}, formType: ${form.type}`
        );

        // Generate removal code and send email for duplicate session
        const removeCode = await this.GenerateUniqueRemoveCode({
          formsession: Formsession,
        });

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

        return removeCode.toString();
      } else {
        console.log(
          `Removing expired session for auto-login: ${email}, formId: ${formId}`
        );
        // Remove expired session before creating new one
        await Formsession.deleteOne({ _id: existingSession._id });
        return null;
      }
    } catch (error) {
      console.error(
        `Error handling auto-login duplicate session for ${email}:`,
        error
      );
      // If there's an error handling duplicate session, continue with session creation
      return null;
    }
  }

  private static async handleDuplicateSession(
    email: string,
    formId: string,
    res: Response,
    form: { type: TypeForm; setting?: { submitonce?: boolean } }
  ): Promise<boolean> {
    try {
      // ⚡ Early exit - check if this form type requires duplicate session handling
      const requiresDuplicateSessionHandling =
        form.type === TypeForm.Quiz ||
        (form.type === TypeForm.Normal && form.setting?.submitonce === true);

      if (!requiresDuplicateSessionHandling) {
        return false; // Skip expensive database operations
      }

      // ⚡ Optimized query with selective fields and index usage
      const existingSession = await Formsession.findOne({
        respondentEmail: email,
        form: formId,
      })
        .select("session_id access_id _id")
        .lean()
        .exec();

      if (!existingSession) {
        return false;
      }

      // ⚡ Batch token validation for better performance
      const [isSessionActive, isAccessActive] = [
        this.ExtractToken({ token: existingSession.session_id }),
        existingSession.access_id
          ? this.ExtractToken({ token: existingSession.access_id })
          : false,
      ];

      if (isSessionActive) {
        // ⚡ Duplicate Session Detected
        if (isAccessActive) {
          try {
            // ⚡ Parallel operations for removal code generation and database update
            const [removeCode] = await Promise.all([
              this.GenerateUniqueRemoveCode({ formsession: Formsession }),
            ]);

            // ⚡ Parallel database update and email sending
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
          });

          await Formsession.updateOne(
            { session_id: existingSession.session_id },
            { access_id: newAccessId }
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

  public static RespondentLogin = async (req: CustomRequest, res: Response) => {
    // ⚡ Early environment variable validation
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

    const { formId, email, password, rememberMe, isGuest } =
      req.body as RespodentLoginProps;

    // ⚡ Early validation to fail fast
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

    try {
      // ⚡ Optimized parallel queries with selective fields
      const [form, userData] = await Promise.all([
        Form.findById(formId)
          .select(
            "type setting.acceptResponses setting.acceptGuest setting.submitonce"
          )
          .lean()
          .exec(), // .exec() for better performance

        // Only query user if needed
        !isGuest && password
          ? User.findOne({ email }).select("email password").lean().exec()
          : Promise.resolve(null),
      ]);

      // ⚡ Early form validation with specific error messages
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

      if (form.type === TypeForm.Normal) {
        return res.status(204).json({
          success: true,
          status: 204,
          message: "Normal form type",
        });
      }

      // ⚡ Early guest validation
      if (isGuest && !form.setting?.acceptGuest) {
        return res.status(403).json({
          success: false,
          status: 403,
          message: "Form does not accept guest",
          error: "GUEST_NOT_ALLOWED",
        });
      }

      // ⚡ Optimized user authentication for non-guest users
      if (!isGuest) {
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

        // ⚡ Password validation happens after all other checks
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

      // ⚡ Handle existing active sessions (this already handles response)
      const hasDuplicateSession = await this.handleDuplicateSession(
        email,
        formId,
        res,
        form
      );

      if (hasDuplicateSession) {
        return; // Response already sent by handleDuplicateSession
      }

      // ⚡ Pre-calculate expiredAt for reuse
      const expiredAt = this.calculateExpiredAt(req, rememberMe, isGuest);
      const accessExpiredAt = getDateByMinute(30);

      // ⚡ Parallel token generation and session creation
      let session_id: string;
      let access_id: string;

      try {
        [session_id, access_id] = await Promise.all([
          this.GenerateUniqueSessionId({ email }),
          this.GenerateUniqueAccessId({ email, formId }),
        ]);
      } catch (tokenError) {
        console.error("Token generation error:", tokenError);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to generate session tokens",
          error: "TOKEN_GENERATION_ERROR",
        });
      }

      // ⚡ Single database operation for session creation
      try {
        await Formsession.create({
          form: formId,
          session_id,
          access_id,
          expiredAt,
          respondentEmail: email,
          isGuest,
        });
      } catch (sessionCreateError) {
        console.error("Session creation error:", sessionCreateError);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Failed to create session",
          error: "SESSION_CREATION_ERROR",
        });
      }

      // ⚡ Early return for guest users (no cookies needed)
      if (isGuest) {
        return res.status(200).json({
          success: true,
          status: 200,
          message: "Guest login successful",
          data: {
            session_id,
            timeStamp: expiredAt.getTime(),
          },
        });
      }

      // ⚡ Cookie setting for non-guest users
      try {
        this.setCookie(res, session_id, undefined, expiredAt);
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
        });
      } catch (cookieError) {
        console.error("Cookie setting error:", cookieError);
        return res.status(500).json({
          success: false,
          status: 500,
          message: "Login successful but failed to set cookies",
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
    // ⚡ Early environment validation
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

    // ⚡ Optimized parameter validation
    if (!code) return res.status(404).json(ReturnCode(404));

    const isSkipAutoLogin = skiplogin ? parseInt(skiplogin, 10) : undefined;
    if (isSkipAutoLogin !== 1 || (isSkipAutoLogin && isNaN(isSkipAutoLogin))) {
      return res.status(400).json(ReturnCode(400));
    }

    console.log({ code }, { isSkipAutoLogin });

    try {
      // ⚡ Optimized database query with lean() and specific field selection
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

      // ⚡ Early validation with better error handling
      if (!formsession) {
        return res.status(404).json(ReturnCode(404, "Invalid code"));
      }

      const form = formsession.form as Pick<FormType, "setting">;
      if (!form?.setting?.acceptResponses) {
        return res.status(404).json(ReturnCode(404, "Form is closed"));
      }

      // ⚡ Skip login optimization - early return
      if (isSkipAutoLogin === 1) {
        await Formsession.deleteOne({ _id: formsession._id }).lean();
        return res.status(200).json(ReturnCode(200));
      }

      // ⚡ Parallel ID generation for better performance
      const [newUniqueSessionId, newUniqueAccessId] = await Promise.all([
        this.GenerateUniqueSessionId({
          email: formsession.respondentEmail,
        }),
        formsession.isGuest
          ? Promise.resolve(null) // Don't generate access ID for guests
          : this.GenerateUniqueAccessId({
              email: formsession.respondentEmail,
            }),
      ]);

      // ⚡ Optimized expiration date calculation
      const expiredAt = formsession.isGuest
        ? getDateByNumDay(1)
        : getDateByNumDay(7);

      // ⚡ Atomic session update
      await Formsession.updateOne(
        { _id: formsession._id },
        {
          session_id: newUniqueSessionId,
          expiredAt,
          // ⚡ Clear removeCode after use for security
          $unset: { removeCode: 1 },
        }
      ).lean();

      // ⚡ Optimized response handling
      if (formsession.isGuest) {
        return res.status(200).json({
          ...ReturnCode(200, "Success"),
          data: {
            session_id: newUniqueSessionId,
            email: formsession.respondentEmail,
            name: formsession.respondentName,
            timeStamp: expiredAt.getTime(),
            isActive: true,
          },
        });
      } else {
        // ⚡ Optimized cookie setting for non-guest users
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "PROD",
          sameSite: "strict" as const,
        };

        // Set main session cookie
        res.cookie(
          process.env.RESPONDENT_COOKIE as string,
          newUniqueSessionId,
          { ...cookieOptions, maxAge: expiredAt.getTime() - Date.now() }
        );

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
      }
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
      !process.env.RESPONDENT_TOKEN_JWT_SECRET
    ) {
      return res.status(500).json(ReturnCode(500));
    }
    const respondentCookie =
      req.cookies[process.env.RESPONDENT_COOKIE as string];

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
      }) as JwtPayload | null;

      if (!extractedToken || !extractedToken.exp) {
        return res.status(401).json(ReturnCode(401));
      }

      const isExpired =
        session.expiredAt >= new Date() ||
        extractedToken.exp >= new Date().getTime();

      if (isExpired) {
        //*Renew Session
        const newSessionId = await this.GenerateUniqueSessionId({
          email: session.respondentEmail,
        });

        await Formsession.updateOne(
          { _id: session._id },
          { session_id: newSessionId }
        );

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "PROD",
          sameSite: "strict" as const,
        };

        res.cookie(
          process.env.RESPONDENT_COOKIE as string,
          newSessionId,
          cookieOptions
        );
      }

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          email: session.respondentEmail,
          isGuest: session.isGuest,
        },
      });
    } catch (error) {
      console.log("Session verification", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public static ExtractToken = ({ token }: { token: string }) => {
    try {
      const isValid = JWT.verify(
        token,
        process.env.RESPONDENT_TOKEN_JWT_SECRET || "secret"
      );

      if (isValid) {
        return isValid;
      }
      return null;
    } catch (_) {
      return null;
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
