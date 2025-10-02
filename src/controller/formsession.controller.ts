import { Response } from "express";
import { CustomRequest } from "../types/customType";
import {
  GenerateToken,
  getDateByMinute,
  ReturnCode,
} from "../utilities/helper";
import { z } from "zod";
import JWT from "jsonwebtoken";
import Formsession, { Formsessiondatatype } from "../model/Formsession.model";
import { Model, Types } from "mongoose";
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
  private static readonly userRespondentLoginSchema = z.object({
    formId: z.string().min(1),
    rememberMe: z.boolean(),
    isSwitched: z.boolean(),
    email: z.string().email().optional(),
    password: z.string().optional(),
  });

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
    maxAttempts = 10,
    expireIn,
  }: {
    email: string;
    maxAttempts?: number;
    expireIn?: string;
  }): Promise<string> {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET is not configured");
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const session_id = GenerateToken(
        { email, timestamp: Date.now(), random: Math.random() }, // Add entropy
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET
      );

      const existingSession = await Formsession.exists({ session_id });

      if (!existingSession) {
        return session_id;
      }
    }

    const fallbackId = GenerateToken(
      { email, timestamp: Date.now(), random: Math.random().toString(36) },
      expireIn ?? "1d",
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

  public static setCookie(
    res: Response,
    sessionId: string,
    expiredAt?: Date
  ): void {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
      sameSite: "strict" as const,
      maxAge: expiredAt ? expiredAt.getTime() - Date.now() : undefined,
    };

    res.cookie(
      process.env.RESPONDENT_COOKIE as string,
      sessionId,
      cookieOptions
    );
  }

  //Auto logged user and normal user
  public static UserRespondentLogin = async (
    req: CustomRequest,
    res: Response
  ) => {
    let { email, password, rememberMe, formId, isSwitched } =
      req.body as Partial<RespodentLoginProps>;

    // Early validation
    if ((req.user && !isSwitched) || !formId) {
      return res.status(400).json(ReturnCode(400));
    }

    const validationResult = this.userRespondentLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        ...ReturnCode(400),
        errors: validationResult.error.errors,
      });
    }

    try {
      const userQuery = {
        ...(email && { email }),
        ...(req.user?.id && { _id: new Types.ObjectId(req.user.id) }),
      };

      const isUser = await User.findOne(userQuery)
        .lean()
        .select("password email");

      if (!isUser) {
        return res.status(401).json(ReturnCode(401));
      }

      if (!email) email = isUser.email;

      // Password validation only when not switching
      if (!isSwitched) {
        if (!password) {
          return res.status(400).json(ReturnCode(400));
        }
        const isValid = compareSync(password, isUser.password);
        if (!isValid) return res.status(401).json(ReturnCode(401));
      }

      // Parallel session creation
      const [session_id] = await Promise.all([
        this.GenerateUniqueSessionId({ email }),
      ]);

      const expiredAt = this.calculateExpiredAt(
        req,
        rememberMe ?? false,
        false,
        !!isSwitched
      );

      await Formsession.create({
        form: formId,
        session_id,
        expiredAt,
        respondentEmail: email,
      });

      this.setCookie(res, session_id, expiredAt);

      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.error("UserRespondentLogin error:", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
  public static RespondentLogin = async (req: CustomRequest, res: Response) => {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      return res.status(500).json(ReturnCode(500));
    }

    const { formId, email, password, rememberMe, isGuest } =
      req.body as RespodentLoginProps;

    const validationResult = this.respondentLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        ...ReturnCode(400),
        errors: validationResult.error.errors,
      });
    }

    try {
      const [form, existingSession, userData] = await Promise.all([
        Form.findById(formId)
          .select("type setting.acceptResponses setting.acceptGuest")
          .lean(),

        Formsession.findOne({ respondentEmail: email }).lean(),

        !isGuest && password
          ? User.findOne({ email }).lean().select("email password")
          : Promise.resolve(null),
      ]);

      if (!form) {
        return res.status(400).json(ReturnCode(400));
      }

      if (!form.setting?.acceptResponses) {
        return res.status(403).json(ReturnCode(403, "Form is closed"));
      }

      if (form.type === TypeForm.Normal) {
        return res.status(204).json(ReturnCode(204));
      }

      if (existingSession) {
        const isActive = this.ExtractToken({
          token: existingSession.session_id,
        });
        if (isActive) {
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

          return res.status(403).json({
            ...ReturnCode(
              403,
              "There already an active session. If it's not you, please check your email for removal instructions."
            ),
          });
        }
      }

      if (isGuest) {
        if (!form.setting?.acceptGuest) {
          return res
            .status(403)
            .json(ReturnCode(403, "Form does not accept guest"));
        }
      } else {
        if (!password) {
          return res.status(400).json(ReturnCode(400));
        }

        if (!userData) {
          return res.status(401).json(ReturnCode(401));
        }

        const isValidPassword = compareSync(password, userData.password);
        if (!isValidPassword) {
          return res.status(401).json(ReturnCode(401));
        }
      }

      const session_id = await this.GenerateUniqueSessionId({ email });
      const expiredAt = this.calculateExpiredAt(req, rememberMe, isGuest);

      await Formsession.create({
        form: formId,
        session_id,
        expiredAt,
        respondentEmail: email,
        isGuest,
      });

      this.setCookie(res, session_id, expiredAt);

      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.error("RespondentLogin error:", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  //   Replace all active session with new one
  public static ReplaceSession = async (req: CustomRequest, res: Response) => {
    const { code } = req.query as { code?: string };

    if (!code) return res.status(404).json(ReturnCode(404));

    try {
      const isCode = await Formsession.findOne({ removeCode: code })
        .populate({ path: "form", select: "setting.acceptResponses" })
        .lean();

      if (!isCode || !(isCode.form as FormType).setting?.acceptResponses)
        return res
          .status(404)
          .json(ReturnCode(404, isCode ? "Form is closed" : undefined));

      const newUniqueSessionId = await this.GenerateUniqueSessionId({
        email: isCode.respondentEmail,
      });

      //Replace session
      await Formsession.updateOne(
        { _id: isCode._id },
        { session_id: newUniqueSessionId }
      );

      // Set cookie for form session
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
        sameSite: "strict" as const,
      };

      res.cookie(
        process.env.RESPONDENT_COOKIE as string,
        newUniqueSessionId,
        cookieOptions
      );

      return res.status(200).json(ReturnCode(200, "Logging to form"));
    } catch (error) {
      console.log("Replace form session", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public static SignOut = async (req: CustomRequest, res: Response) => {
    try {
      await Formsession.deleteOne({ session_id: req.formsession?.sub });

      //Clear cookie
      res.clearCookie(process.env.RESPONDENT_COOKIE as string);
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
    const bool = ["true", "false"];
    let { isActive } = req.query as { isActive?: string | boolean };

    if (!isActive || (isActive && !bool.includes(isActive as string)))
      return res.status(400).json(ReturnCode(400));

    isActive = isActive === bool[0];

    try {
      const session = await Formsession.findOne({
        session_id: req.formsession,
      }).lean();

      if (!session || !req.formsession || !req.formsession.exp)
        return res.status(400).json(ReturnCode(400));

      const isExpired =
        session.expiredAt >= new Date() ||
        req.formsession.exp >= new Date().getTime();

      if (isExpired) {
        if (!isActive)
          return res.status(200).json({
            ...ReturnCode(200, "Session expire"),
            data: {
              isExpired,
            },
          });
        if (isActive) {
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
      }

      return res.status(204).json(ReturnCode(204));
    } catch (error) {
      console.log("Session verification", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public static ExtractToken = ({ token }: { token: string }) => {
    const isValid = JWT.verify(
      token,
      process.env.RESPONDENT_TOKEN_JWT_SECRET || "secret"
    );

    if (isValid) {
      return isValid;
    }
    return null;
  };
  private static GenerateUniqueRemoveCode = async ({
    formsession,
    maxAttempts = 10,
  }: {
    formsession: Model<Formsessiondatatype>;
    maxAttempts?: number;
  }): Promise<number> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const removeCode = Math.floor(Math.random() * 1000000);

      const existingCode = await formsession.exists({ removeCode });

      if (!existingCode) {
        return removeCode;
      }
    }

    const timestampCode = Math.floor(Date.now() % 1000000);
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
      let formTitle: string | undefined;

      // Get form title if formId is provided
      if (formId) {
        try {
          const form = await Form.findById(formId).select("title").lean();
          if (form) {
            formTitle = form.title || "Form";
          }
        } catch (error) {
          console.error("Error fetching form title:", error);
          // Continue without form title if there's an error
        }
      }

      const result = await sendRemovalLinkEmail(
        respondentEmail,
        removeCode,
        formTitle
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
