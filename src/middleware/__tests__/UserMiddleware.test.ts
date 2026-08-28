import { NextFunction, Response } from "express";
import { CustomRequest, UserToken } from "../../types/customType";
import UserMiddleware from "../User.middleware";
import { ROLE } from "../../model/User.model";
import { GenerateToken, ReturnCode } from "../../utilities/helper";
import Usersession from "../../model/Usersession.model";
import authenicationController from "../../controller/auth/authenication.controller";
import { Types } from "mongoose";

jest.mock("../../model/Usersession.model");
jest.mock("../../controller/auth/authenication.controller");

describe("UserMiddleware Unit Tests", () => {
  let errorSpy: jest.SpyInstance;
  let mockedReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let nextFun: NextFunction;
  const originalEnv = process.env;

  const sampleUser: UserToken = {
    sub: new Types.ObjectId().toString(),
    role: ROLE.USER,
    email: "testuser@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      JWT_SECRET: "testjwtsecret",
      ACCESS_TOKEN_COOKIE: "access_token",
      REFRESH_TOKEN_COOKIE: "refresh_token",
    };

    nextFun = jest.fn();
    mockedReq = {
      body: {},
      cookies: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };

    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("VerifyToken", () => {
    test("should return 500 when required environment variables are missing", async () => {
      process.env = {
        ...originalEnv,
        JWT_SECRET: undefined,
      } as never;

      await UserMiddleware.VerifyToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "TOKEN_INVALID",
        message: "Missing required environment variables",
      });
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should return 401 when access token is missing from cookies", async () => {
      mockedReq.cookies = {};

      await UserMiddleware.VerifyToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "TOKEN_MISSING",
        message: "No access token provided",
      });
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should return 401 with shouldRefresh flag when access token is expired", async () => {
      const expiredAccessToken = GenerateToken(
        sampleUser,
        -1,
        process.env.JWT_SECRET,
      );

      mockedReq.cookies = {
        [process.env.ACCESS_TOKEN_COOKIE as string]: expiredAccessToken,
      };

      await UserMiddleware.VerifyToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "TOKEN_EXPIRED",
        message: "Access token expired",
        shouldRefresh: true,
      });
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should clear cookie and return 403 when access token is invalid / malformed", async () => {
      mockedReq.cookies = {
        [process.env.ACCESS_TOKEN_COOKIE as string]: "invalid.token.structure",
      };

      await UserMiddleware.VerifyToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(
        authenicationController.clearAccessTokenCookie,
      ).toHaveBeenCalledWith(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "TOKEN_INVALID",
        message: "Invalid access token",
      });
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should attach decoded user payload to req.user and call next() when access token is valid", async () => {
      const validAccessToken = GenerateToken(
        sampleUser,
        "30m",
        process.env.JWT_SECRET,
      );

      mockedReq.cookies = {
        [process.env.ACCESS_TOKEN_COOKIE as string]: validAccessToken,
      };

      await UserMiddleware.VerifyToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockedReq.user).toBeDefined();
      expect(mockedReq.user?.sub).toBe(sampleUser.sub);
      expect(mockedReq.user?.role).toBe(sampleUser.role);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(nextFun).toHaveBeenCalled();
    });
  });

  describe("VerifyRefreshToken", () => {
    test("should return 401 when refresh token is missing from cookies", async () => {
      mockedReq.cookies = {};

      await UserMiddleware.VerifyRefreshToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(401, "No refresh token provided"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should delete session, clear refresh cookie, and return 401 when refresh token signature is invalid", async () => {
      const invalidRefreshToken = "invalid.refresh.token";
      mockedReq.cookies = {
        [process.env.REFRESH_TOKEN_COOKIE as string]: invalidRefreshToken,
      };

      (Usersession.deleteOne as jest.Mock).mockResolvedValue({});

      await UserMiddleware.VerifyRefreshToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(Usersession.deleteOne).toHaveBeenCalledWith({
        session_id: invalidRefreshToken,
      });
      expect(
        authenicationController.clearRefreshTokenCookie,
      ).toHaveBeenCalledWith(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(401, "Invalid refresh token"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should return 403 when refresh token is valid JWT but session is expired or not found in database", async () => {
      const validRefreshToken = GenerateToken(
        sampleUser,
        "7d",
        process.env.JWT_SECRET,
      );

      mockedReq.cookies = {
        [process.env.REFRESH_TOKEN_COOKIE as string]: validRefreshToken,
      };

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await UserMiddleware.VerifyRefreshToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(403, "Session expired or invalid"),
      );
      expect(nextFun).not.toHaveBeenCalled();
    });

    test("should attach req.session and req.user and call next() when refresh token and DB session are valid", async () => {
      const validRefreshToken = GenerateToken(
        sampleUser,
        "7d",
        process.env.JWT_SECRET,
      );

      mockedReq.cookies = {
        [process.env.REFRESH_TOKEN_COOKIE as string]: validRefreshToken,
      };

      const mockDbSession = {
        _id: new Types.ObjectId(),
        session_id: validRefreshToken,
        expireAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        user: {
          _id: sampleUser.sub,
          email: sampleUser.email,
          role: sampleUser.role,
        },
      };

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockDbSession),
      });

      await UserMiddleware.VerifyRefreshToken(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockedReq.session).toEqual(mockDbSession);
      expect(mockedReq.user).toEqual(mockDbSession.user);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(nextFun).toHaveBeenCalled();
    });
  });
});
