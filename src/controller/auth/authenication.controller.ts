import { Request, Response } from "express";
import User from "../../model/User.model";
import {
  GenerateToken,
  getDateByMinute,
  getDateByNumDay,
  hashedPassword,
  RandomNumber,
  ReturnCode,
} from "../../utilities/helper";
import bcrypt from "bcrypt";
import Usersession from "../../model/Usersession.model";
import HandleEmail from "../../utilities/email";
import sessionCache from "../../utilities/sessionCache";

interface Logindata {
  email: string;
  name: string;
  password: string;
  rememberMe?: boolean;
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
    const { email, password, rememberMe } = req.body as Logindata;

    try {
      const user = await User.findOne({
        $or: [
          {
            email,
          },
          { name: email },
        ],
      })
        .select("email name password role")
        .lean();

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(404).json(ReturnCode(404, "Incorrect Credential"));
      }

      //Login session creation
      const TokenPayload = { sub: user._id, role: user.role };
      const AccessToken = GenerateToken(TokenPayload, "15m");
      const RefreshToken = GenerateToken(
        TokenPayload,
        rememberMe ? "7d" : "1d",
      );

      //Create Login Session
      await Usersession.create({
        session_id: RefreshToken,
        expireAt: getDateByNumDay(1),
        user: user._id,
        guest: null,
      });

      //Set Authentication Cookie
      this.setAccessTokenCookie(res, AccessToken);
      this.setRefreshTokenCookie(res, RefreshToken);

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          ...user,
        },
      });
    } catch (error) {
      console.error(`Login Error:`, error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public Logout = async (req: Request, res: Response) => {
    try {
      const refresh_token =
        req.cookies?.[process.env.REFRESH_TOKEN_COOKIE ?? ""];
      if (!refresh_token) return res.status(204).json(ReturnCode(204));

      // Invalidate cache for this session
      sessionCache.invalidate(refresh_token);

      await Usersession.deleteOne({ session_id: refresh_token });

      this.clearAccessTokenCookie(res);
      this.clearRefreshTokenCookie(res);
      return res.status(200).json(ReturnCode(200));
    } catch (error) {
      console.log(`Logout Error`, error);
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
              },
            );

            //Send Code Email
            const sendemail = await HandleEmail(
              email,
              "Reset Password",
              html.replace("$code$", generateCode.toString()),
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
              { code: null },
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
      return res.status(500).json(ReturnCode(500));
    }
  };

  /**
   * Check session for valid user session
   * Optimized for frequent calls with:
   * - In-memory caching (2-minute TTL)
   * - Lean queries for better performance
   * - Reduced field selection
   * - Early returns to minimize processing
   */

  public CheckSession = async (req: Request, res: Response) => {
    try {
      const refreshToken = req?.cookies[process.env.REFRESH_TOKEN_COOKIE ?? ""];

      if (!refreshToken) {
        return res.status(401).json(ReturnCode(401, "No session found"));
      }

      // Check cache first
      const cachedSession = sessionCache.get(refreshToken);
      if (cachedSession) {
        return res.status(200).json({
          ...ReturnCode(200),
          data: {
            user: {
              _id: cachedSession.userId,
              email: cachedSession.email,
              name: cachedSession.name,
              role: cachedSession.role,
            },
            isAuthenticated: true,
          },
        });
      }

      const userSession = await Usersession.findOne({
        session_id: refreshToken,
        expireAt: { $gte: new Date() },
        respondent: null,
      })
        .populate({
          path: "user",
          select: "_id email name role",
        })
        .select("session_id expireAt createdAt user")
        .lean()
        .exec();

      Usersession.deleteMany({
        expireAt: { $lt: new Date() },
      })
        .exec()
        .catch((err) => {
          console.error(`Background cleanup error:`, err);
        });

      if (!userSession?.user) {
        this.clearAccessTokenCookie(res);
        this.clearRefreshTokenCookie(res);
        return res.status(401).json(ReturnCode(401, "Session expired"));
      }

      const user = userSession.user as any;

      // Cache the session data for future requests
      sessionCache.set(refreshToken, {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return res.status(200).json({
        ...ReturnCode(200),
        data: {
          user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          isAuthenticated: true,
        },
      });
    } catch (error) {
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  };

  public RefreshToken = async (req: Request, res: Response) => {
    //Generate MongoDB operation ID

    if (!process.env.REFRESH_TOKEN_COOKIE) {
      return res.status(500).json(ReturnCode(500));
    }

    try {
      const refresh_token =
        req.cookies?.[process.env.REFRESH_TOKEN_COOKIE as string];

      const user = await Usersession.findOne({
        session_id: refresh_token,
      })
        .populate("user")
        .exec();

      if (!user || !user.user) return res.status(404).json(ReturnCode(404));

      const TokenPayload = { sub: user.user._id, role: user.user.role };

      const newToken = GenerateToken(TokenPayload, "30m");

      this.setAccessTokenCookie(res, newToken);

      return res.status(200).json({ ...ReturnCode(200) });
    } catch (error) {
      return res.status(500).json(ReturnCode(500));
    }
  };

  private setAccessTokenCookie(res: Response, token: string): void {
    res.cookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", token, {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
      expires: getDateByMinute(30),
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
      },
    );
  }

  public clearAccessTokenCookie(res: Response): void {
    res.clearCookie(process.env.ACCESS_TOKEN_COOKIE || "access_token", {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
    });
  }

  public clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(process.env.REFRESH_TOKEN_COOKIE || "refresh_token", {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "PROD",
    });
  }
}

export default new AuthenticationController();
