import { Request, Response } from "express";
import User from "../model/User.model";
import {
  GenerateToken,
  getDateByMinute,
  getDateByNumDay,
  hashedPassword,
  RandomNumber,
  ReturnCode,
} from "../utilities/helper";
import bcrypt, { compareSync } from "bcrypt";
import Usersession from "../model/Usersession.model";
import HandleEmail from "../utilities/email";
import JWT from "jsonwebtoken";
import { isObjectIdOrHexString, isValidObjectId, Types } from "mongoose";
import Form from "../model/Form.model";

interface Logindata {
  email: string;
  password: string;
}

interface ForgotPasswordType {
  ty: "vfy" | "confirm" | "change";
  email: string;
  code: string;
  password: string;
  html: string;
}

class AuthenticationController {
  public Login = async (req: Request, res: Response) => {
    const { email, password } = req.body as Logindata;

    try {
      const user = await User.findOne({ email }).select("email password role");

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(404).json(ReturnCode(404, "Incorrect Credential"));
      }

      const TokenPayload = { id: user._id, role: user.role };
      const AccessToken = GenerateToken(TokenPayload, "15m");
      const RefreshToken = GenerateToken(TokenPayload, "1d");

      //Create Login Session
      await Usersession.create({
        session_id: RefreshToken,
        expireAt: getDateByNumDay(1),
        user: user._id,
        guest: null,
      });

      this.setAccessTokenCookie(res, AccessToken);
      this.setRefreshTokenCookie(res, RefreshToken);
      return res.status(200).json({ ...ReturnCode(200), token: AccessToken });
    } catch (error) {
      console.error("Login Error:", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public Logout = async (req: Request, res: Response) => {
    try {
      const refresh_token =
        req.cookies?.[process.env.REFRESH_TOKEN_COOKIE ?? ""];
      if (!refresh_token) return res.status(204).json(ReturnCode(204));

      await Usersession.deleteOne({ session_id: refresh_token });

      this.clearAccessTokenCookie(res);
      this.clearRefreshTokenCookie(res);
      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log("Logout Error", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public ForgotPassword = async (req: Request, res: Response) => {
    const { ty, email, code, password, html } = req.body as ForgotPasswordType;
    try {
      switch (ty) {
        case "vfy":
          {
            if (!email) return res.status(400).json(ReturnCode(400));

            let generateCode = RandomNumber(6);
            let isUnqiue = false;

            while (!isUnqiue) {
              const isCode = await User.findOne({ code: generateCode });
              if (!isCode) {
                isUnqiue = true;
              }
              generateCode = RandomNumber(6);
            }
            await User.findOneAndUpdate(
              { email },
              {
                code: generateCode,
              }
            );

            //Send Code Email
            const sendemail = await HandleEmail(
              email,
              "Reset Password",
              html.replace("$code$", generateCode.toString())
            );

            if (!sendemail.success) {
              return res
                .status(500)
                .json(ReturnCode(500, "Fail to send email"));
            }
          }

          break;
        case "confirm":
          {
            const isValid = await User.findOneAndUpdate(
              { code },
              { code: null }
            );

            if (!isValid)
              return res.status(404).json(ReturnCode(404, "Invalid Code"));
          }
          break;
        case "change":
          {
            if (!password) return res.status(400).json(ReturnCode(400));
            const changePassword = hashedPassword(password);

            await User.updateOne({ email }, { password: changePassword });
          }
          break;

        default:
          {
            res.status(400).json(ReturnCode(400, "Invalid request type"));
          }
          break;
      }

      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log("forgot password", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
  public CheckSession = async (req: Request, res: Response) => {
    try {
      const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];
      const accessToken = req?.cookies[process.env.ACCESS_TOKEN_COOKIE ?? ""];

      if (!refreshToken) {
        return res
          .status(204)
          .json({ authenticated: false, message: "No refresh token found" });
      }

      // Verify the refresh token is still valid
      const userSession = await Usersession.findOne({
        $and: [
          {
            session_id: refreshToken,
          },
          {
            expireAt: { $gte: new Date() },
          },
          {
            respondent: null,
          },
        ],
      }).populate({ path: "user", select: "_id email role" });

      if (!userSession || !userSession.user) {
        if (userSession) {
          await Usersession.deleteOne({ session_id: refreshToken });
        }

        // Clear cookies
        this.clearAccessTokenCookie(res);
        this.clearRefreshTokenCookie(res);

        return res.status(401).json(ReturnCode(401, "Session Expired"));
      }

      const user = userSession.user as any;

      const currentUser = await User.findById(user._id).select(
        "_id email role"
      );
      if (!currentUser) {
        // User was deleted, clean up session
        await Usersession.deleteOne({ session_id: refreshToken });
        this.clearAccessTokenCookie(res);
        this.clearRefreshTokenCookie(res);

        return res.status(401).json(ReturnCode(401, "User no longer exists"));
      }

      // Verify access token if present
      let tokenValid = false;
      if (accessToken) {
        try {
          const decoded = JWT.verify(
            accessToken,
            process.env.JWT_SECRET || "secret"
          ) as any;
          tokenValid = decoded.id === user._id.toString();
        } catch (error) {
          // Access token invalid/expired, but refresh token is valid
          tokenValid = false;
        }
      }

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          user: {
            _id: currentUser._id,
            email: currentUser.email,
            role: currentUser.role,
          },
          session: {
            sessionId: userSession.session_id,
            expireAt: userSession.expireAt,
            createdAt: userSession.createdAt,
          },
          authenticated: true,
          tokenValid,
          requiresRefresh: !tokenValid,
        },
      });
    } catch (error) {
      console.error("Check Session Error:", error);
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  };

  public RefreshToken = async (req: Request, res: Response) => {
    try {
      const refresh_token =
        req.cookies?.[process.env.REFRESH_TOKEN_COOKIE ?? ""];

      const user = await Usersession.findOne({
        session_id: refresh_token,
      })
        .populate("user")
        .exec();

      if (!user || !user.user) return res.status(404).json(ReturnCode(404));

      const TokenPayload = { id: user.user._id, role: user.user.role };

      const newToken = GenerateToken(TokenPayload, "1h");

      this.setAccessTokenCookie(res, newToken);

      return res.status(200).json({ ...ReturnCode(200), token: newToken });
    } catch (error) {
      console.log("Refresh Token", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  //Respondent Authentication
  public RespodnentLogin = async (req: Request, res: Response) => {
    const { email, password }: { email: string; password: string } = req.body;
    try {
      const isUser = await User.findOne({ email })
        .select("_id password ")
        .lean()
        .exec();
      if (!isUser) return res.status(401).json(ReturnCode(401));

      const compareUser = compareSync(password, isUser.password);

      if (!compareUser) throw "Invalid Credential";
      const accessToken = GenerateToken({ email }, "1h");

      //Create User Session
      await Usersession.create({
        session_id: accessToken,
        user: isUser._id,
      });

      console.log(process.env?.RESPONDENT_COOKIE);
      //Set Cookie
      res.cookie(
        process.env?.RESPONDENT_COOKIE ?? "respondent_accessT",
        accessToken
      );

      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      const err = error as Error;
      console.log("Respondent Login", err);
      return res
        .status(500)
        .json(ReturnCode(500, err?.message ?? "Error Occured"));
    }
  };

  public CheckRespondentSession = async (req: Request, res: Response) => {
    const id = req.cookies?.[process.env.RESPONDENT_COOKIE ?? ""] as string;
    try {
      if (!id || !isObjectIdOrHexString(new Types.ObjectId(id)))
        return res
          .status(400)
          .json({ ...ReturnCode(400), data: { isError: true } });

      const respondentSession = await Usersession.findOne({
        session_id: id,
      })
        .select("session_id expireAt user")
        .populate("user")
        .lean();

      if (!respondentSession)
        return res
          .status(401)
          .json({ ...ReturnCode(401), data: { isError: true } });
      const isExpired = respondentSession.expireAt < new Date();

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          session_id: respondentSession.session_id,
          userdata: respondentSession.user,
          isExpired,
        },
      });
    } catch (error) {
      console.log("Check Respondent Session", error);
      return res
        .status(500)
        .json({ ...ReturnCode(500), data: { isError: true } });
    }
  };

  public RenewRespondentSession = async (req: Request, res: Response) => {
    const { formId } = req.body as {
      formId: string;
    };
    const session_id = req.cookies?.[
      process.env.RESPONDENT_COOKIE ?? ""
    ] as string;
    if (!session_id)
      return res.status(400).json(ReturnCode(400, "No session found"));
    try {
      if (!formId || !isValidObjectId(new Types.ObjectId(formId)))
        return res.status(400).json(ReturnCode(400));
      const session = await Usersession.findOne({ session_id })
        .populate("user")
        .lean()
        .exec();
      if (!session) {
        return res.status(400).json(ReturnCode(400, "Can't Renew Session"));
      }

      //Check form status
      const isAccept = await Form.findById(formId).select("setting").lean();

      if (!isAccept || !isAccept.setting?.acceptResponses)
        return res
          .status(400)
          .json(
            ReturnCode(
              400,
              `${!isAccept ? "No Form is found" : "Form has closed"}`
            )
          );

      //renew session
      const new_session_id = GenerateToken(
        { email: session.user?.email },
        "1hr"
      );

      res.cookie(
        process.env.RESPONDENT_COOKIE ?? "respondent_accessT",
        new_session_id,
        {
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "PROD",
          expires: getDateByMinute(60),
        }
      );

      await Promise.all([
        Usersession.deleteOne({ session_id }),
        Usersession.create({
          session_id: new_session_id,
          user: session.user,
        }),
      ]);

      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log("Renew Respondent Session", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public RespondentLogout = async (req: Request, res: Response) => {
    try {
      const session_id =
        req.cookies?.[process.env.RESPONDENT_COOKIE ?? ""] ?? null;
      if (!session_id) return res.status(204).json(ReturnCode(204));

      const session = await Usersession.findOneAndDelete({ session_id });

      if (!session) return res.status(204).json(ReturnCode(204));

      res.clearCookie(process.env.RESPONDENT_COOKIE ?? "respondent_accessT");
      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log("Respondent Logout", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  private setAccessTokenCookie(res: Response, token: string): void {
    res.cookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", token, {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
      expires: getDateByMinute(15),
    });
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(
      process.env.REFRESH_TOKEN_COOKIE || "refresh_token",
      refreshToken,
      {
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
        expires: getDateByNumDay(1),
      }
    );
  }
  private clearAccessTokenCookie(res: Response): void {
    res.clearCookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
    });
  }
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(process.env.REFRESH_TOKEN_COOKIE || "refresh_token", {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
    });
  }
  private isDateExpire(val: Date) {
    const now = new Date();
    return val.getTime() < now.getTime();
  }
}

export default new AuthenticationController();
