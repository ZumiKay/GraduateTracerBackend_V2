import Request from "supertest";
import mongoose from "mongoose";
import app from "../../../app";
import User, { ROLE, UserType } from "../../../model/User.model";
import Usersession from "../../../model/Usersession.model";
import sessionCache from "../../../utilities/sessionCache";
import HandleEmail from "../../../utilities/email";
import bcrypt from "bcrypt";
import { ReturnCode } from "../../../utilities/helper";

// Mock email utility to prevent sending actual external emails during tests
jest.mock("../../../utilities/email", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    success: true,
    message: "Email sent successfully",
  }),
}));

// Mock traffic rate limits for fast integration test execution
jest.mock("../../../middleware/Traffic.middleware", () => ({
  __esModule: true,
  default: {
    LoginRateLimit: (req: any, res: any, next: any) => next(),
    ApiRateLimit: (req: any, res: any, next: any) => next(),
    PasswordResetRateLimit: (req: any, res: any, next: any) => next(),
    Ratelimit: (req: any, res: any, next: any) => next(),
  },
}));

describe("Authentication Controller - Docker Integration Tests", () => {
  const dbUri =
    process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/graduatetracer_test";

  beforeAll(async () => {
    // Ensure mongoose is connected to the test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(dbUri);
    }
  });

  afterAll(async () => {
    // Clean up collections and close database connection
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Usersession.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    sessionCache.clear();
    jest.clearAllMocks();
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Usersession.deleteMany({});
    }
  });

  const sampleUserData = {
    email: "integration_user@example.com",
    name: "integration_user",
    password: "Password@12345",
    role: ROLE.USER,
  };

  describe("POST /registeruser - Real Database Registration", () => {
    test("successfully creates a new user document in MongoDB with hashed password", async () => {
      const res = await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData)
        .set("Accept", "application/json");

      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual(ReturnCode(201, "User registered"));

      // Verify document in MongoDB
      const savedUser = await User.findOne({ email: sampleUserData.email });
      expect(savedUser).not.toBeNull();
      expect(savedUser?.name).toBe(sampleUserData.name);
      expect(savedUser?.role).toBe(ROLE.USER);
      expect(savedUser?.password).not.toBe(sampleUserData.password);
      expect(
        bcrypt.compareSync(sampleUserData.password, savedUser!.password),
      ).toBe(true);
    });

    test("prevents duplicate registration with 400 when email and name already exist", async () => {
      // First registration
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);

      // Duplicate registration attempt
      const duplicateRes = await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);

      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body).toStrictEqual(
        ReturnCode(400, "Username or email already exist"),
      );

      const userCount = await User.countDocuments({
        email: sampleUserData.email,
      });
      expect(userCount).toBe(1);
    });
  });

  describe("POST /login & Session Lifecycle", () => {
    beforeEach(async () => {
      // Register test user directly via API
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);
    });

    test("logs in with valid credentials, sets cookies, and creates Usersession in MongoDB", async () => {
      const res = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: sampleUserData.password,
          rememberMe: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(sampleUserData.email);
      expect(res.headers["set-cookie"]).toBeDefined();

      const cookies = res.headers["set-cookie"] as unknown as string[];
      const refreshCookieName =
        process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
      const refreshTokenCookie = cookies.find((c) =>
        c.startsWith(`${refreshCookieName}=`),
      );
      expect(refreshTokenCookie).toBeDefined();

      // Extract raw token value
      const refreshToken = refreshTokenCookie?.split(";")[0].split("=")[1];
      expect(refreshToken).toBeDefined();

      // Verify Usersession exists in MongoDB
      const dbSession = await Usersession.findOne({ session_id: refreshToken });
      expect(dbSession).not.toBeNull();
      expect(dbSession?.user).toBeDefined();
    });

    test("returns 404 on incorrect password", async () => {
      const res = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: "WrongPassword@999",
        });

      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual(ReturnCode(404, "Incorrect Credential"));

      const sessionCount = await Usersession.countDocuments({});
      expect(sessionCount).toBe(0);
    });

    test("returns 404 on non-existent user", async () => {
      const res = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: "nonexistent@example.com",
          password: "Password@12345",
        });

      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual(ReturnCode(404, "Incorrect Credential"));
    });
  });

  describe("GET /checksession - End-to-End Session Verification", () => {
    let refreshCookieHeader: string;

    beforeEach(async () => {
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);

      const loginRes = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: sampleUserData.password,
          rememberMe: true,
        });

      const cookies = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookieName =
        process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
      refreshCookieHeader = cookies.find((c) =>
        c.startsWith(`${refreshCookieName}=`),
      )!;
    });

    test("returns 200 with user profile when valid session cookie is provided", async () => {
      const res = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [refreshCookieHeader]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.isAuthenticated).toBe(true);
      expect(res.body.data.user.email).toBe(sampleUserData.email);
    });

    test("returns 401 when session cookie is missing", async () => {
      const res = await Request(app).get(
        process.env.API_BASEURL + "/checksession",
      );

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401, "No session found"));
    });

    test("returns 401 when session has been removed from database", async () => {
      sessionCache.clear();
      await Usersession.deleteMany({});

      const res = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [refreshCookieHeader]);

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401, "Session expired"));
    });
  });

  describe("POST /refreshtoken - Real Token Rotation", () => {
    let refreshCookieHeader: string;

    beforeEach(async () => {
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);

      const loginRes = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: sampleUserData.password,
          rememberMe: true,
        });

      const cookies = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookieName =
        process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
      refreshCookieHeader = cookies.find((c) =>
        c.startsWith(`${refreshCookieName}=`),
      )!;
    });

    test("successfully issues new access token cookie when valid refresh token provided", async () => {
      const res = await Request(app)
        .post(process.env.API_BASEURL + "/refreshtoken")
        .set("Cookie", [refreshCookieHeader]);

      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();

      const cookies = res.headers["set-cookie"] as unknown as string[];
      const accessCookieName =
        process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT";
      const hasAccessToken = cookies.some((c) =>
        c.startsWith(`${accessCookieName}=`),
      );
      expect(hasAccessToken).toBe(true);
    });

    test("returns 401 when refresh token cookie is absent", async () => {
      const res = await Request(app).post(
        process.env.API_BASEURL + "/refreshtoken",
      );

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(
        ReturnCode(401, "No refresh token provided"),
      );
    });
  });

  describe("PUT /forgotpassword - Full Reset Flow in MongoDB", () => {
    beforeEach(async () => {
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);
    });

    test("executes complete reset flow: verify code -> confirm code -> change password -> login with new password", async () => {
      // Step 1: Request reset code (vfy)
      const vfyRes = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "vfy",
          email: sampleUserData.email,
          html: "Your reset code is $code$",
        });

      expect(vfyRes.status).toBe(200);
      expect(HandleEmail).toHaveBeenCalled();

      // Retrieve generated code from database
      const userWithCode = await User.findOne({ email: sampleUserData.email });
      expect(userWithCode?.code).toBeDefined();
      const resetCode = String(userWithCode!.code);

      // Step 2: Confirm reset code (confirm)
      const confirmRes = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "confirm",
          code: resetCode,
        });

      expect(confirmRes.status).toBe(200);

      // Verify code was cleared in MongoDB
      const userClearedCode = await User.findOne({
        email: sampleUserData.email,
      });
      expect(userClearedCode?.code).toBeNull();

      // Step 3: Change password (change)
      const newPassword = "NewSecurePassword@2026";
      const changeRes = await Request(app)
        .put(process.env.API_BASEURL + "/forgotpassword")
        .send({
          ty: "change",
          email: sampleUserData.email,
          password: newPassword,
        });

      expect(changeRes.status).toBe(200);

      // Step 4: Verify user can login with NEW password
      const newLoginRes = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: newPassword,
        });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.email).toBe(sampleUserData.email);

      // Old password should now fail
      const oldLoginRes = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: sampleUserData.password,
        });

      expect(oldLoginRes.status).toBe(404);
    });
  });

  describe("DELETE /logout - End-to-End Logout", () => {
    let refreshCookieHeader: string;
    let refreshToken: string;

    beforeEach(async () => {
      await Request(app)
        .post(process.env.API_BASEURL + "/registeruser")
        .send(sampleUserData);

      const loginRes = await Request(app)
        .post(process.env.API_BASEURL + "/login")
        .send({
          email: sampleUserData.email,
          password: sampleUserData.password,
        });

      const cookies = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookieName =
        process.env.REFRESH_TOKEN_COOKIE || "graduate_refreshT";
      refreshCookieHeader = cookies.find((c) =>
        c.startsWith(`${refreshCookieName}=`),
      )!;
      refreshToken = refreshCookieHeader.split(";")[0].split("=")[1];
    });

    test("deletes session from database and invalidates auth session", async () => {
      // Verify session exists prior to logout
      let session = await Usersession.findOne({ session_id: refreshToken });
      expect(session).not.toBeNull();

      // Perform logout
      const logoutRes = await Request(app)
        .delete(process.env.API_BASEURL + "/logout")
        .set("Cookie", [refreshCookieHeader]);

      expect(logoutRes.status).toBe(200);

      // Verify session is deleted from MongoDB
      session = await Usersession.findOne({ session_id: refreshToken });
      expect(session).toBeNull();

      // Verify subsequent checksession fails
      sessionCache.clear();
      const checkRes = await Request(app)
        .get(process.env.API_BASEURL + "/checksession")
        .set("Cookie", [refreshCookieHeader]);

      expect(checkRes.status).toBe(401);
    });
  });
});
