import { NextFunction, RequestHandler, Response } from "express";
import { CustomRequest, UserToken } from "../types/customType";
import { ReturnCode } from "../utilities/helper";
import JWT, { JsonWebTokenError } from "jsonwebtoken";
import Usersession from "../model/Usersession.model";
import authenicationController from "../controller/auth/authenication.controller";

// ==================== Types & Enums ====================

export enum GetPublicFormDataTyEnum {
  initial = "initial",
  verify = "verify",
  data = "data",
}

export interface GetPublicFormDataType {
  p?: string;
  ty?: GetPublicFormDataTyEnum;
  vfy?: string;
  isSwitched?: string;
}

interface TokenPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface VerifiedTokenResult {
  isValid: boolean;
  isExpired: boolean;
  data?: TokenPayload;
}

// ==================== Constants ====================

const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: "30m",
  ACCESS_TOKEN_EXPIRY_MINUTES: 30,
} as const;

const ERROR_MESSAGES = {
  NO_ACCESS_TOKEN: "No access token provided",
  NO_REFRESH_TOKEN: "No refresh token provided",
  INVALID_ACCESS_TOKEN: "Invalid access token",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  ACCESS_TOKEN_EXPIRED: "Access token expired",
  REFRESH_TOKEN_EXPIRED: "Refresh token expired",
  SESSION_EXPIRED: "Session expired or invalid",
  USER_NOT_EXISTS: "User no longer exists",
  NOT_AUTHENTICATED: "User not authenticated",
  ADMIN_REQUIRED: "Admin access required",
  VERIFICATION_FAILED: "Token verification failed",
  PERMISSION_CHECK_FAILED: "Permission check failed",
  MISSING_ENV_VARS: "Missing required environment variables",
} as const;

const ERROR_CODES = {
  TOKEN_MISSING: "TOKEN_MISSING",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  REFRESH_REQUIRED: "REFRESH_REQUIRED",
} as const;

// ==================== Authentication Middleware Class ====================

class AuthenticateMiddleWare {
  // ==================== Private Helper Methods ====================

  /**
   * Validates required environment variables
   */
  private validateEnvVars(): boolean {
    return !!(
      process.env.JWT_SECRET &&
      process.env.ACCESS_TOKEN_COOKIE &&
      process.env.REFRESH_TOKEN_COOKIE
    );
  }

  /**
   * Extracts and verifies a JWT token
   */
  private verifyJWT(token: string): VerifiedTokenResult {
    try {
      const decoded = JWT.verify(
        token,
        process.env.JWT_SECRET ?? "secret"
      ) as TokenPayload;

      return {
        isValid: true,
        isExpired: false,
        data: decoded,
      };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return { isValid: false, isExpired: true };
      }
      return { isValid: false, isExpired: false };
    }
  }

  /**
   * Retrieves tokens from cookies
   */
  private getTokensFromCookies(req: CustomRequest): {
    accessToken: string | undefined;
    refreshToken: string | undefined;
  } {
    return {
      accessToken: req.cookies[process.env.ACCESS_TOKEN_COOKIE as string],
      refreshToken: req.cookies[process.env.REFRESH_TOKEN_COOKIE as string],
    };
  }

  /**
   * Validates and retrieves active session
   */
  private async validateSession(
    sessionToken: string,
    userId?: string
  ): Promise<any | null> {
    const query: any = {
      session_id: sessionToken,
      expireAt: { $gte: new Date() },
    };

    if (userId) {
      query.user = userId;
    }

    return await Usersession.findOne(query)
      .select("session_id expireAt userId")
      .populate({ path: "user", select: "_id email role" })
      .lean()
      .exec();
  }

  /**
   * Cleans up expired session
   */
  private async cleanupExpiredSession(sessionToken: string): Promise<void> {
    try {
      await Usersession.deleteOne({ session_id: sessionToken });
    } catch (error) {
      console.error("Failed to cleanup expired session:", error);
    }
  }

  // ==================== Public Middleware Methods ====================

  /**
   * Verifies access token (Hybrid approach - no auto-refresh)
   * Returns specific error codes for frontend to handle refresh
   */
  public VerifyToken = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Validate environment variables
    if (!this.validateEnvVars()) {
      res.status(500).json({
        success: false,
        error: ERROR_CODES.TOKEN_INVALID,
        message: ERROR_MESSAGES.MISSING_ENV_VARS,
      });
      return;
    }

    try {
      const { accessToken } = this.getTokensFromCookies(req);

      // Check if access token exists
      if (!accessToken) {
        res.status(401).json({
          success: false,
          error: ERROR_CODES.TOKEN_MISSING,
          message: ERROR_MESSAGES.NO_ACCESS_TOKEN,
        });
        return;
      }

      // Verify access token
      const verifiedToken = this.verifyJWT(accessToken);

      // Token expired - signal frontend to refresh
      if (verifiedToken.isExpired) {
        res.status(401).json({
          success: false,
          error: ERROR_CODES.TOKEN_EXPIRED,
          message: ERROR_MESSAGES.ACCESS_TOKEN_EXPIRED,
          shouldRefresh: true, // Signal to frontend
        });
        return;
      }

      // Token invalid
      if (!verifiedToken.isValid || !verifiedToken.data) {
        authenicationController.clearAccessTokenCookie(res);
        res.status(403).json({
          success: false,
          error: ERROR_CODES.TOKEN_INVALID,
          message: ERROR_MESSAGES.INVALID_ACCESS_TOKEN,
        });
        return;
      }

      req.user = verifiedToken.data as any;
      next();
      return;
    } catch (error: any) {
      console.error("Token verification error:", error);

      res.status(500).json({
        success: false,
        error: ERROR_CODES.TOKEN_INVALID,
        message: ERROR_MESSAGES.VERIFICATION_FAILED,
      });
      return;
    }
  };

  /**
   * Verifies and validates refresh token
   */
  public VerifyRefreshToken = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { refreshToken } = this.getTokensFromCookies(req);

      if (!refreshToken) {
        return res
          .status(401)
          .json(ReturnCode(401, ERROR_MESSAGES.NO_REFRESH_TOKEN));
      }

      // Verify JWT signature
      const verifiedToken = this.verifyJWT(refreshToken);

      //Clean up invalid token
      if (!verifiedToken.isValid) {
        await Usersession.deleteOne({
          session_id: verifiedToken,
        });

        //Clear Cookie

        authenicationController.clearRefreshTokenCookie(res);
        return res
          .status(401)
          .json(ReturnCode(401, ERROR_MESSAGES.INVALID_REFRESH_TOKEN));
      }

      // Validate session in database
      const validSession = await Usersession.findOne({
        session_id: refreshToken,
        expireAt: { $gte: new Date() },
      }).populate({ path: "user", select: "_id email role" });

      if (!validSession || !validSession.user) {
        // Cleanup invalid session
        if (validSession) {
          await this.cleanupExpiredSession(refreshToken);
        }

        return res
          .status(403)
          .json(ReturnCode(403, ERROR_MESSAGES.SESSION_EXPIRED));
      }

      req.session = validSession;
      req.user = validSession.user as unknown as UserToken;

      return next();
    } catch (error) {
      const err = error as JsonWebTokenError;
      console.error("Refresh token verification error:", error);

      if (err.name === "TokenExpiredError") {
        return res
          .status(403)
          .json(ReturnCode(403, ERROR_MESSAGES.REFRESH_TOKEN_EXPIRED));
      }

      return res
        .status(500)
        .json(ReturnCode(500, ERROR_MESSAGES.VERIFICATION_FAILED));
    }
  };

  /**
   * Middleware to require admin role
   */
  public RequireAdmin = (
    req: CustomRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(ReturnCode(401, ERROR_MESSAGES.NOT_AUTHENTICATED));
      }

      const userRole = req.user.userDetails?.role || req.user.role;

      if (userRole !== "ADMIN") {
        return res
          .status(403)
          .json(ReturnCode(403, ERROR_MESSAGES.ADMIN_REQUIRED));
      }

      return next();
    } catch (error) {
      console.error("Admin check error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, ERROR_MESSAGES.PERMISSION_CHECK_FAILED));
    }
  };
}

export default new AuthenticateMiddleWare();
