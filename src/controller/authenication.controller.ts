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
import bcrypt from "bcrypt";
import Usersession from "../model/Usersession.model";
import HandleEmail from "../utilities/email";

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

      if (!refreshToken) {
        return res.status(400).json({});
      }

      const isUser = await Usersession.findOne({
        session_id: refreshToken,
      }).populate({ path: "user", select: "_id email role" });

      if (!isUser) {
        return res.status(401).json(ReturnCode(401, "Session Expired"));
      }

      return res.status(200).json({ data: isUser });
    } catch (error) {
      console.log("Check Session", error);
      return res.status(500).json(ReturnCode(500));
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
