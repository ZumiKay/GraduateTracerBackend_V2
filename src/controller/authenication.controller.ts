import { Request, Response } from "express";
import User, { UserType } from "../model/User.model";
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
import {
  handleDatabaseError,
  generateOperationId,
} from "../utilities/MongoErrorHandler";

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
    const operationId = generateOperationId("login");

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
      if (handleDatabaseError(error, res, "user login")) {
        return;
      }

      console.error(`[${operationId}] Login Error:`, error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public Logout = async (req: Request, res: Response) => {
    const operationId = generateOperationId("logout");

    try {
      const refresh_token =
        req.cookies?.[process.env.REFRESH_TOKEN_COOKIE ?? ""];
      if (!refresh_token) return res.status(204).json(ReturnCode(204));

      await Usersession.deleteOne({ session_id: refresh_token });

      this.clearAccessTokenCookie(res);
      this.clearRefreshTokenCookie(res);
      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      if (handleDatabaseError(error, res, "user logout")) {
        return;
      }

      console.log(`[${operationId}] Logout Error`, error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public ForgotPassword = async (req: Request, res: Response) => {
    const { ty, email, code, password, html } = req.body as ForgotPasswordType;
    const operationId = generateOperationId("forgot_password");

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
      if (handleDatabaseError(error, res, "forgot password operation")) {
        return;
      }

      console.log(`[${operationId}] forgot password`, error);
      return res.status(500).json(ReturnCode(500));
    }
  };
  public CheckSession = async (req: Request, res: Response) => {
    const operationId = generateOperationId("check_session");

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
      if (handleDatabaseError(error, res, "session check")) {
        return;
      }

      console.error(`[${operationId}] Check Session Error:`, error);
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  };

  public RefreshToken = async (req: Request, res: Response) => {
    const operationId = generateOperationId("refresh_token");

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
      if (handleDatabaseError(error, res, "token refresh")) {
        return;
      }

      console.log(`[${operationId}] Refresh Token`, error);
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
}

export default new AuthenticationController();
