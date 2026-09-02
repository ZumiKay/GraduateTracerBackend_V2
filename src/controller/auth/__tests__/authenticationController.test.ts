import Request from "supertest";
import User, { ROLE, UserType } from "../../../model/User.model";
import app from "../../../app";
import {
  GenerateToken,
  getDateByNumDay,
  ReturnCode,
} from "../../../utilities/helper";
import bcrypt from "bcrypt";
import Usersession from "../../../model/Usersession.model";
import HandleEmail from "../../../utilities/email";
import sessionCache from "../../../utilities/sessionCache";

// Mocked modules
jest.mock("../../../database", () => jest.fn());
jest.mock("../../../model/User.model");
jest.mock("../../../model/Usersession.model");
jest.mock("bcrypt");
jest.mock("../../../utilities/email");
jest.mock("../../../middleware/Traffic.middleware", () => ({
  __esModule: true,
  default: {
    LoginRateLimit: (req: any, res: any, next: any) => next(),
    ApiRateLimit: (req: any, res: any, next: any) => next(),
    PasswordResetRateLimit: (req: any, res: any, next: any) => next(),
    Ratelimit: (req: any, res: any, next: any) => next(),
  },
}));

describe("Authentications Route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionCache.clear();
    (bcrypt.genSaltSync as jest.Mock).mockReturnValue("salt");
    (bcrypt.hashSync as jest.Mock).mockReturnValue("hashedpassword");
  });

  describe("/registeruser", () => {
    test("200 status", async () => {
      const sampleRegisterUserdata: UserType = {
        email: "test@example.com",
        name: "testname",
        password: "pass@11223345",
        role: ROLE.USER,
      } as never;

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(sampleRegisterUserdata);

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleRegisterUserdata)
        .set("Accept", "application/json");

      expect(superTest.status).toBe(201);
      expect(superTest.body).toStrictEqual(ReturnCode(201, "User registered"));
    });

    test("400 status on invalid body validation", async () => {
      const sampleRegisterUserdata: UserType = {
        email: "')01029302@@@@@@@@@@@@g.com",
        name: "testname",
        password: "pass@11223345",
        role: ROLE.USER,
      } as never;

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(sampleRegisterUserdata);

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleRegisterUserdata)
        .set("Accept", "application/json");

      expect(superTest.status).toBe(400);
      expect(superTest.body?.errors).toBeDefined();
    });

    test("400 status when username or email already exists", async () => {
      const sampleRegisterUserdata: UserType = {
        email: "existing@example.com",
        name: "existinguser",
        password: "pass@11223345",
        role: ROLE.USER,
      } as never;

      (User.findOne as jest.Mock).mockResolvedValue(sampleRegisterUserdata);

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleRegisterUserdata)
        .set("Accept", "application/json");

      expect(superTest.status).toBe(400);
      expect(superTest.body).toStrictEqual(
        ReturnCode(400, "Username or email already exist"),
      );
    });
  });

  describe("/login", () => {
    let sampleUser: Partial<UserType> = {};
    beforeEach(() => {
      sampleUser = {
        email: "test@example.com",
        name: "testuser",
        role: ROLE.USER,
        password: "hashedpassword",
      };
    });

    test("200 status on successful login", async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(sampleUser),
        }),
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      (Usersession.create as jest.Mock).mockResolvedValue({});

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUser.email,
          password: "pass@12345",
          rememberMe: true,
        });

      expect(superTest.status).toBe(200);
      expect(superTest.header?.["set-cookie"]).toBeDefined();
      expect(superTest.body.data).toBeDefined();
    });

    test("404 status when user does not exist", async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: "notfound@example.com",
          password: "pass@12345",
        });

      expect(superTest.status).toBe(404);
      expect(superTest.body).toStrictEqual(
        ReturnCode(404, "Incorrect Credential"),
      );
    });

    test("404 status when password does not match", async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(sampleUser),
        }),
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUser.email,
          password: "wrongpass@12345",
        });

      expect(superTest.status).toBe(404);
      expect(superTest.body).toStrictEqual(
        ReturnCode(404, "Incorrect Credential"),
      );
    });

    test("400 status when payload validation fails", async () => {
      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: "invalid-email-format",
          password: "short",
        });

      expect(superTest.status).toBe(400);
      expect(superTest.body?.errors).toBeDefined();
    });
  });

  describe("/checksession", () => {
    test("200 status when valid session exists in database", async () => {
      const refreshToken = "valid_refresh_token";
      const expireDate = getDateByNumDay(7);
      const mockSession = {
        _id: "session_123",
        session_id: refreshToken,
        expireAt: expireDate,
        user: {
          _id: "user_123",
          email: "test@example.com",
          name: "testuser",
          role: ROLE.USER,
        },
      };

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockSession),
            }),
          }),
        }),
      });
      (Usersession.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const superTest = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);

      expect(superTest.status).toBe(200);
      expect(superTest.body.data).toBeDefined();
      expect(superTest.body.data.isAuthenticated).toBe(true);
      expect(superTest.body.data.user.email).toBe("test@example.com");
    });

    test("200 status when session exists in cache", async () => {
      const refreshToken = "cached_refresh_token";
      sessionCache.set(refreshToken, {
        userId: "user_cached_123",
        email: "cached@example.com",
        name: "cacheduser",
        role: ROLE.USER,
        expiresAt: new Date().toISOString(),
      });

      const superTest = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);

      expect(superTest.status).toBe(200);
      expect(superTest.body.data.isAuthenticated).toBe(true);
      expect(superTest.body.data.user.email).toBe("cached@example.com");
      expect(Usersession.findOne).not.toHaveBeenCalled();
    });

    test("401 status when refresh token cookie is missing", async () => {
      const superTest = await Request(app).get(
        process.env.API_BASEURL + "/checksession",
      );

      expect(superTest.status).toBe(401);
      expect(superTest.body).toStrictEqual(
        ReturnCode(401, "No session found"),
      );
    });

    test("401 status when session is expired or not found in database", async () => {
      const refreshToken = "expired_refresh_token";

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });
      (Usersession.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const superTest = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);

      expect(superTest.status).toBe(401);
      expect(superTest.body).toStrictEqual(
        ReturnCode(401, "Session expired"),
      );
    });
  });

  describe("/logout", () => {
    test("200 status when refresh token cookie is provided", async () => {
      const refreshToken = "logout_refresh_token";
      (Usersession.deleteOne as jest.Mock).mockResolvedValue({});

      const superTest = await Request(app)
        .delete(process.env.API_BASEURL + "/logout")
        .set("Cookie", [`${process.env.REFRESH_TOKEN_COOKIE}=${refreshToken}`]);

      expect(superTest.status).toBe(200);
      expect(superTest.body).toStrictEqual(ReturnCode(200));
      expect(Usersession.deleteOne).toHaveBeenCalledWith({
        session_id: refreshToken,
      });
    });

    test("204 status when refresh token cookie is missing", async () => {
      const superTest = await Request(app).delete(
        process.env.API_BASEURL + "/logout",
      );

      expect(superTest.status).toBe(204);
    });
  });

  describe("/refreshtoken", () => {
    test("200 status when valid refresh token is provided", async () => {
      const validTokenPayload = {
        sub: "user_123",
        role: ROLE.USER,
      };
      const validRefreshToken = GenerateToken(validTokenPayload, "7d");

      const mockSession = {
        _id: "session_123",
        session_id: validRefreshToken,
        expireAt: getDateByNumDay(7),
        user: {
          _id: "user_123",
          email: "test@example.com",
          role: ROLE.USER,
        },
      };

      const mockPopulateResult = {
        ...mockSession,
        exec: jest.fn().mockResolvedValue(mockSession),
        then: (resolve: any, reject?: any) =>
          Promise.resolve(mockSession).then(resolve, reject),
      };

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue(mockPopulateResult),
      });

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/refreshtoken")
        .set("Cookie", [
          `${process.env.REFRESH_TOKEN_COOKIE}=${validRefreshToken}`,
        ]);

      expect(superTest.status).toBe(200);
      expect(superTest.header?.["set-cookie"]).toBeDefined();
      expect(superTest.body).toStrictEqual(ReturnCode(200));
    });

    test("401 status when refresh token cookie is missing", async () => {
      const superTest = await Request(app).post(
        process.env.API_BASEURL + "/refreshtoken",
      );

      expect(superTest.status).toBe(401);
      expect(superTest.body).toStrictEqual(
        ReturnCode(401, "No refresh token provided"),
      );
    });

    test("401 status when refresh token is invalid", async () => {
      (Usersession.deleteOne as jest.Mock).mockResolvedValue({});

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/refreshtoken")
        .set("Cookie", [
          `${process.env.REFRESH_TOKEN_COOKIE}=invalid_refresh_token`,
        ]);

      expect(superTest.status).toBe(401);
      expect(superTest.body).toStrictEqual(
        ReturnCode(401, "Invalid refresh token"),
      );
    });

    test("403 status when session is expired or not found in database", async () => {
      const validTokenPayload = {
        sub: "user_123",
        role: ROLE.USER,
      };
      const validRefreshToken = GenerateToken(validTokenPayload, "7d");

      (Usersession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const superTest = await Request(app)
        .post(process.env.API_BASEURL + "/refreshtoken")
        .set("Cookie", [
          `${process.env.REFRESH_TOKEN_COOKIE}=${validRefreshToken}`,
        ]);

      expect(superTest.status).toBe(403);
      expect(superTest.body).toStrictEqual(
        ReturnCode(403, "Session expired or invalid"),
      );
    });
  });

  describe("/forgotpassword", () => {
    test("200 status for ty: 'vfy' when verification code is sent via email", async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (HandleEmail as jest.Mock).mockResolvedValue({
        success: true,
        message: "Email sent successfully",
      });

      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "vfy",
          email: "test@example.com",
          html: "Your reset code is: $code$",
        });

      expect(superTest.status).toBe(200);
      expect(superTest.body).toStrictEqual(ReturnCode(200));
      expect(HandleEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Reset Password",
        expect.stringMatching(/Your reset code is: \d{6}/),
      );
    });

    test("500 status for ty: 'vfy' when email sending fails", async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (HandleEmail as jest.Mock).mockResolvedValue({
        success: false,
        message: "SMTP error",
      });

      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "vfy",
          email: "test@example.com",
          html: "Your reset code is: $code$",
        });

      expect(superTest.status).toBe(500);
      expect(superTest.body).toStrictEqual(
        ReturnCode(500, "Fail to send email"),
      );
    });

    test("400 status for ty: 'vfy' when email is missing", async () => {
      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "vfy",
          html: "Your reset code is: $code$",
        });

      expect(superTest.status).toBe(400);
      expect(superTest.body).toStrictEqual(ReturnCode(400));
    });

    test("200 status for ty: 'confirm' when code is valid", async () => {
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: "user_123",
        email: "test@example.com",
      });

      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "confirm",
          code: "123456",
        });

      expect(superTest.status).toBe(200);
      expect(superTest.body).toStrictEqual(ReturnCode(200));
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { code: "123456" },
        { code: null },
      );
    });

    test("404 status for ty: 'confirm' when code is invalid", async () => {
      (User.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "confirm",
          code: "invalid_code",
        });

      expect(superTest.status).toBe(404);
      expect(superTest.body).toStrictEqual(
        ReturnCode(404, "Invalid Code"),
      );
    });

    test("200 status for ty: 'change' when password is provided", async () => {
      (User.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "change",
          email: "test@example.com",
          password: "NewPassword@123",
        });

      expect(superTest.status).toBe(200);
      expect(superTest.body).toStrictEqual(ReturnCode(200));
      expect(User.updateOne).toHaveBeenCalledWith(
        { email: "test@example.com" },
        { password: expect.any(String) },
      );
    });

    test("400 status for ty: 'change' when password is missing", async () => {
      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "change",
          email: "test@example.com",
        });

      expect(superTest.status).toBe(400);
      expect(superTest.body).toStrictEqual(ReturnCode(400));
    });

    test("400 status when invalid request type is provided", async () => {
      const superTest = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "invalid_ty",
        });

      expect(superTest.status).toBe(400);
      expect(superTest.body).toStrictEqual(
        ReturnCode(400, "Invalid request type"),
      );
    });
  });
});
