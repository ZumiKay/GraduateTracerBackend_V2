import Request from "supertest";
import mongoose, { Types } from "mongoose";
import app from "../../../app";
import Form, { TypeForm } from "../../../model/Form.model";
import Formsession from "../../../model/Formsession.model";
import FormResponse from "../../../model/Response.model";
import User, { ROLE } from "../../../model/User.model";
import Usersession from "../../../model/Usersession.model";
import { GenerateToken, ReturnCode } from "../../../utilities/helper";
import {
  createTestForm,
  createTestUser,
  mockEmailSender,
  mockTrafficMiddleware,
  testEnv,
} from "./helper.integration";

// Mock email utility to prevent sending actual external emails during tests
mockEmailSender();
mockTrafficMiddleware();

describe("Formsession Controller - Integration Tests", () => {
  const baseURL = "/v0/api/response";
  const dbUri = process.env.DATABASE_URL;

  const sampleUserData = {
    email: "respondent_user@example.com",
    name: "respondent_user",
    password: "Password@12345",
    role: ROLE.USER,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(dbUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Formsession.deleteMany({});
      await Form.deleteMany({});
      await User.deleteMany({});
      await Usersession.deleteMany({});
      await FormResponse.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...testEnv };

    if (mongoose.connection.readyState !== 0) {
      await Formsession.deleteMany({});
      await Form.deleteMany({});
      await User.deleteMany({});
      await Usersession.deleteMany({});
      await FormResponse.deleteMany({});
    }
  });

  /* ---------------------------- Respondent Login ---------------------------- */
  describe("POST /respondentlogin", () => {
    test("status 500 -> Invalid server configuration when secret or cookies are missing", async () => {
      process.env = {
        ...process.env,
        RESPONDENT_TOKEN_JWT_SECRET: undefined,
      } as never;

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({});

      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual(ReturnCode(500));
    });

    test("status 400 -> Validation failure when formId is missing", async () => {
      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual(ReturnCode(400));
    });

    test("status 404 -> Form not found", async () => {
      const nonExistentFormId = new Types.ObjectId().toString();

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: nonExistentFormId,
          email: "guest@example.com",
          isGuest: true,
        });

      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual(ReturnCode(404, "Form not found"));
    });

    test("status 403 -> Form is closed (acceptResponses is false)", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: false },
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: "guest@example.com",
          isGuest: true,
        });

      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual(ReturnCode(403, "Form is closed"));
    });

    test("status 204 -> Form is normal type (TypeForm.Normal)", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        type: TypeForm.Normal,
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: "guest@example.com",
          isGuest: true,
        });

      expect(res.status).toBe(204);
    });

    test("status 403 -> Guest login when form does not accept guests", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, acceptGuest: false },
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: "guest@example.com",
          isGuest: true,
        });

      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual(
        ReturnCode(403, "Form don't accept guest"),
      );
    });

    test("status 400 -> Guest login with email that belongs to a registered user", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: user.email,
          isGuest: true,
        });

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual(
        ReturnCode(400, "User exist please login as user"),
      );
    });

    test("status 200 -> Guest login successful, creates Formsession and sets cookies", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const guestEmail = "newguest@example.com";

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: guestEmail,
          isGuest: true,
          name: "Guest Tester",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.data.isGuest).toBe(true);

      // Verify cookies
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      const respondentCookie = cookies.find((c: string) =>
        c.startsWith(`${process.env.RESPONDENT_COOKIE}=`),
      );
      const accessCookie = cookies.find((c: string) =>
        c.startsWith(`${process.env.ACCESS_RESPONDENT_COOKIE}=`),
      );
      expect(respondentCookie).toBeDefined();
      expect(accessCookie).toBeDefined();

      // Verify session in MongoDB
      const savedSession = await Formsession.findOne({
        respondentEmail: guestEmail,
        form: form._id,
      });
      expect(savedSession).not.toBeNull();
      expect(savedSession?.isGuest).toBe(true);
      expect(savedSession?.respondentName).toBe("Guest Tester");
    });

    test("status 400 -> Registered user login missing password", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: user.email,
          isGuest: false,
        });

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual(ReturnCode(400));
    });

    test("status 401 -> Invalid user", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: "unknown_user@example.com",
          password: "Password@12345",
          isGuest: false,
        });

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401));
    });

    test("status 401 -> Invalid password", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: user.email,
          password: "WrongPassword@123",
          isGuest: false,
        });

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401));
    });

    test("status 200 -> Registered user login", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: user.email,
          password: sampleUserData.password,
          isGuest: false,
          rememberMe: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.data.isGuest).toBe(false);

      const savedSession = await Formsession.findOne({
        respondentEmail: user.email,
        form: form._id,
      });
      expect(savedSession).not.toBeNull();
      expect(savedSession?.isGuest).toBe(false);
    });

    test("status 200 -> Existing user login", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const userRefreshToken = GenerateToken(
        { email: user.email, role: user.role, _id: user._id },
        "7d",
        process.env.JWT_SECRET,
      );

      await Usersession.create({
        user: user._id,
        session_id: userRefreshToken,
        expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .set("Cookie", [
          `${process.env.REFRESH_TOKEN_COOKIE}=${userRefreshToken}`,
        ])
        .send({
          formId: form._id.toString(),
          existed: "1",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");

      const savedSession = await Formsession.findOne({
        respondentEmail: user.email,
        form: form._id,
      });
      expect(savedSession).not.toBeNull();
    });

    test("status 403 -> Active duplicate session sends removal email", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const email = "active_respondent@example.com";

      // Create an existing active session
      const activeSessionToken = GenerateToken(
        { email },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );
      const activeAccessToken = GenerateToken(
        { email, formId: form._id.toString() },
        "30m",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: activeSessionToken,
        access_id: activeAccessToken,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: email,
        isGuest: true,
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email,
          isGuest: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("already an active session");

      const updatedSession = await Formsession.findOne({
        respondentEmail: email,
        form: form._id,
      });
      expect(updatedSession?.removeCode).toBeDefined();
      expect(updatedSession?.removeCode).not.toBeNull();
    });

    test("status 200 -> Reactivates session when session is active but has no access token", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const email = "reactivate_respondent@example.com";

      const activeSessionToken = GenerateToken(
        { email },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: activeSessionToken,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: email,
        isGuest: true,
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email,
          isGuest: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Session reactivated successfully");

      const updatedSession = await Formsession.findOne({
        respondentEmail: email,
        form: form._id,
      });
      expect(updatedSession?.access_id).toBeDefined();
    });

    test("status 200 -> Includes isResponsed if user has already submitted a response", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        totalscore: 100,
        setting: {
          acceptResponses: true,
          acceptGuest: true,
          email: true,
          submitonce: true,
        },
      });
      const guestEmail = "already_submitted@example.com";

      await FormResponse.create({
        formId: form._id,
        respondentEmail: guestEmail,
        totalScore: 85,
        submittedAt: new Date(),
        responseset: [
          {
            question: new Types.ObjectId(),
            response: "Answer 1",
            score: 85,
          },
        ],
      });

      const res = await Request(app)
        .post(baseURL + "/respondentlogin")
        .send({
          formId: form._id.toString(),
          email: guestEmail,
          isGuest: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isResponsed).toBeDefined();
      expect(res.body.data.isResponsed.totalScore).toBe(85);
      expect(res.body.data.isResponsed.maxScore).toBe(100);
    });
  });

  /* --------------------------- Verify Formsession --------------------------- */

  describe("GET /verifyformsession/:formId", () => {
    test("status 400 -> Non-existent formId", async () => {
      const nonExistentFormId = new Types.ObjectId().toString();

      const res = await Request(app).get(
        `${baseURL}/verifyformsession/${nonExistentFormId}`,
      );

      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual(ReturnCode(400));
    });

    test("status 200 -> Form does not require authentication (setting.email is false)", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: false },
      });

      const res = await Request(app).get(
        `${baseURL}/verifyformsession/${form._id.toString()}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.isNormalForm).toBe(true);
    });

    test("status 401 -> Missing session cookie when authentication is required", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: true },
      });

      const res = await Request(app).get(
        `${baseURL}/verifyformsession/${form._id.toString()}`,
      );

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401));
    });

    test("status 401 -> Session not found in database", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: true },
      });

      const validToken = GenerateToken(
        { email: "someone@example.com" },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      const res = await Request(app)
        .get(`${baseURL}/verifyformsession/${form._id.toString()}`)
        .set("Cookie", [`${process.env.RESPONDENT_COOKIE}=${validToken}`]);

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401));
    });

    test("status 401 -> Expired session token cleans up Formsession from database", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: true },
      });
      const email = "expired_user@example.com";

      const expiredToken = GenerateToken(
        { email },
        "-1m",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: expiredToken,
        expiredAt: new Date(Date.now() - 60000),
        respondentEmail: email,
      });

      const res = await Request(app)
        .get(`${baseURL}/verifyformsession/${form._id.toString()}`)
        .set("Cookie", [`${process.env.RESPONDENT_COOKIE}=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual(ReturnCode(401, "Session expired"));

      const sessionInDb = await Formsession.findOne({
        session_id: expiredToken,
      });
      expect(sessionInDb).toBeNull();
    });

    test("status 200 -> Valid session with valid access token returns respondent data", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: true },
      });
      const email = "valid_user@example.com";

      const sessionToken = GenerateToken(
        { email },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );
      const accessToken = GenerateToken(
        { email, formId: form._id.toString() },
        "30m",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        access_id: accessToken,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: email,
        respondentName: "Valid User",
        isGuest: true,
      });

      const res = await Request(app)
        .get(`${baseURL}/verifyformsession/${form._id.toString()}`)
        .set("Cookie", [
          `${process.env.RESPONDENT_COOKIE}=${sessionToken}`,
          `${process.env.ACCESS_RESPONDENT_COOKIE}=${accessToken}`,
        ]);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(200);
      expect(res.body.data.respondentEmail).toBe(email);
      expect(res.body.data.respondentName).toBe("Valid User");
      expect(res.body.data.isGuest).toBe(true);
    });

    test("status 200 -> Valid session with missing/expired access token regenerates access cookie", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: true, email: true },
      });
      const email = "renew_access@example.com";

      const sessionToken = GenerateToken(
        { email },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: email,
        respondentName: "Renew Access User",
        isGuest: false,
      });

      const res = await Request(app)
        .get(`${baseURL}/verifyformsession/${form._id.toString()}`)
        .set("Cookie", [`${process.env.RESPONDENT_COOKIE}=${sessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.respondentEmail).toBe(email);

      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      const accessCookie = cookies.find((c: string) =>
        c.startsWith(`${process.env.ACCESS_RESPONDENT_COOKIE}=`),
      );
      expect(accessCookie).toBeDefined();

      const updatedSession = await Formsession.findOne({
        session_id: sessionToken,
      });
      expect(updatedSession?.access_id).toBeDefined();
    });
  });

  /* ----------------------------- Session removal ---------------------------- */
  describe("PATCH /sessionremoval/:code", () => {
    test("status 404 -> Code does not match any session", async () => {
      const res = await Request(app).patch(
        `${baseURL}/sessionremoval/invalid_code_999`,
      );

      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual(ReturnCode(404, "Invalid code"));
    });

    test("status 200 -> Verify query returns 200 for valid removeCode", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const code = "654321";

      const sessionToken = GenerateToken(
        { email: "verify_code@example.com" },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        removeCode: code,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: "verify_code@example.com",
      });

      const res = await Request(app).patch(
        `${baseURL}/sessionremoval/${code}?verify=1`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual(ReturnCode(200));
    });

    test("status 403 -> Verify query returns 403 for non-existent removeCode", async () => {
      const res = await Request(app).patch(
        `${baseURL}/sessionremoval/non_existent_code?verify=1`,
      );

      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual(ReturnCode(403));
    });

    test("status 200 -> skiplogin=1 terminates session and deletes from MongoDB", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const code = "123456";

      const sessionToken = GenerateToken(
        { email: "terminate@example.com" },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        removeCode: code,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: "terminate@example.com",
      });

      const res = await Request(app).patch(
        `${baseURL}/sessionremoval/${code}?skiplogin=1`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual(ReturnCode(200, "Session Terminated"));

      const sessionInDb = await Formsession.findOne({ removeCode: code });
      expect(sessionInDb).toBeNull();
    });

    test("status 404 -> Session replacement fails if form is closed", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id, {
        setting: { acceptResponses: false },
      });
      const code = "789123";

      const sessionToken = GenerateToken(
        { email: "closed_form@example.com" },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        removeCode: code,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: "closed_form@example.com",
      });

      const res = await Request(app).patch(`${baseURL}/sessionremoval/${code}`);

      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual(ReturnCode(404, "Form is closed"));
    });

    test("status 200 -> Replaces active session with new tokens and sets cookies", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const code = "555666";
      const oldSessionToken = GenerateToken(
        { email: "replace_me@example.com" },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      const sessionDoc = await Formsession.create({
        form: form._id,
        session_id: oldSessionToken,
        removeCode: code,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: "replace_me@example.com",
        isGuest: false,
      });

      const res = await Request(app).patch(`${baseURL}/sessionremoval/${code}`);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual(ReturnCode(200, "Logging to form"));

      // Check cookies
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      const respondentCookie = cookies.find((c: string) =>
        c.startsWith(`${process.env.RESPONDENT_COOKIE}=`),
      );
      expect(respondentCookie).toBeDefined();

      // Check session in database updated
      const updatedSession = await Formsession.findById(sessionDoc._id);
      expect(updatedSession?.session_id).not.toBe(oldSessionToken);
      expect(updatedSession?.removeCode).toBeFalsy();
    });
  });

  /* ----------------------------- Session Loggout ---------------------------- */

  describe("DELETE /sessionlogout/:formId", () => {
    test("status 401 -> Missing session cookie", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);

      const res = await Request(app).delete(
        `${baseURL}/sessionlogout/${form._id.toString()}`,
      );

      expect(res.status).toBe(401);
    });

    test("status 200 -> Logs out respondent, removes session from DB and clears cookies", async () => {
      const user = await createTestUser();
      const form = await createTestForm(user._id);
      const email = "logout_user@example.com";

      const sessionToken = GenerateToken(
        { email },
        "1d",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );
      const accessToken = GenerateToken(
        { email, formId: form._id.toString() },
        "30m",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );

      await Formsession.create({
        form: form._id,
        session_id: sessionToken,
        access_id: accessToken,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        respondentEmail: email,
      });

      const res = await Request(app)
        .delete(`${baseURL}/sessionlogout/${form._id.toString()}`)
        .set("Cookie", [
          `${process.env.RESPONDENT_COOKIE}=${sessionToken}`,
          `${process.env.ACCESS_RESPONDENT_COOKIE}=${accessToken}`,
        ]);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual(ReturnCode(200, "Logged Out"));

      const sessionInDb = await Formsession.findOne({
        session_id: sessionToken,
      });
      expect(sessionInDb).toBeNull();
    });
  });
});
