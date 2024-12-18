import { Request, Response } from "express";
import User from "../model/User.model";
import {
  GenerateToken,
  getDateByNumDay,
  ReturnCode,
} from "../utilities/helper";
import bcrypt from "bcrypt";
import Usersession from "../model/Usersession.model";

interface Logindata {
  email: string;
  password: string;
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

      this.clearRefreshTokenCookie(res);
      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log("Logout Error", error);
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

      return res.status(200).json({ ...ReturnCode(200), token: newToken });
    } catch (error) {
      console.log("Refresh Token", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

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
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(process.env.REFRESH_TOKEN_COOKIE || "refresh_token", {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
    });
  }
}

export default new AuthenticationController();
