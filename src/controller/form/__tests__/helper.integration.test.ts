import mongoose from "mongoose";
import JWT from "jsonwebtoken";
import User, { ROLE } from "../../../model/User.model";
import Usersession from "../../../model/Usersession.model";
import {
  testEnv,
  createTestUser,
  loginNormalUser,
  loggedNormalUser,
} from "./helper.integration";

describe("Normal User Login Helper Integration Tests", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }
  });

  beforeEach(async () => {
    process.env = testEnv;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Usersession.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  test("successfully logs in when passed a user document directly", async () => {
    const user = await createTestUser({
      name: "Direct User",
      email: `direct_${Date.now()}@gmail.com`,
      role: ROLE.USER,
    });

    const result = await loginNormalUser(user);

    expect(result).toBeDefined();
    expect(result?.user._id.toString()).toBe(user._id.toString());
    expect(result?.accessToken).toBeDefined();
    expect(result?.refreshToken).toBeDefined();
    expect(result?.cookies).toHaveLength(2);
    expect(result?.cookies[0]).toContain(`${testEnv.ACCESS_TOKEN_COOKIE}=`);
    expect(result?.cookies[1]).toContain(`${testEnv.REFRESH_TOKEN_COOKIE}=`);

    // Verify token validity
    const verified = JWT.verify(result!.accessToken, testEnv.JWT_SECRET) as any;
    expect(verified.sub).toBe(user._id.toString());

    // Verify Usersession in DB
    const session = await Usersession.findOne({ session_id: result?.refreshToken });
    expect(session).toBeDefined();
    expect(session?.user?.toString()).toBe(user._id.toString());
  });

  test("successfully logs in when passed { user } in options", async () => {
    const user = await createTestUser({
      name: "Options User",
      email: `options_${Date.now()}@gmail.com`,
      role: ROLE.ADMIN,
    });

    const result = await loginNormalUser({ user, rememberMe: true });

    expect(result).toBeDefined();
    expect(result?.user._id.toString()).toBe(user._id.toString());

    const verified = JWT.verify(result!.accessToken, testEnv.JWT_SECRET) as any;
    expect(verified.role).toBe(ROLE.ADMIN);

    const session = await Usersession.findOne({ session_id: result?.refreshToken });
    expect(session).toBeDefined();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const diff = session!.expireAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(sevenDaysMs - 60000);
  });

  test("successfully logs in when passed { email, password }", async () => {
    const email = `cred_${Date.now()}@gmail.com`;
    const password = "Password@12345";
    const user = await createTestUser({ email, password });

    const result = await loginNormalUser({ email, password });

    expect(result).toBeDefined();
    expect(result?.user.email).toBe(email);

    const session = await Usersession.findOne({ session_id: result?.refreshToken });
    expect(session).toBeDefined();
    expect(session?.user?.toString()).toBe(user._id.toString());
  });

  test("returns undefined when password does not match", async () => {
    const email = `wrongpass_${Date.now()}@gmail.com`;
    await createTestUser({ email, password: "CorrectPassword123" });

    const result = await loginNormalUser({ email, password: "WrongPassword" });
    expect(result).toBeUndefined();
  });

  test("returns undefined when email does not exist", async () => {
    const result = await loginNormalUser({
      email: "nonexistent_email_123@gmail.com",
      password: "Password@12345",
    });
    expect(result).toBeUndefined();
  });

  test("auto-creates or finds default user when called with no arguments", async () => {
    const result = await loginNormalUser();

    expect(result).toBeDefined();
    expect(result?.user).toBeDefined();
    expect(result?.accessToken).toBeDefined();
    expect(result?.cookies).toHaveLength(2);
  });

  test("loggedNormalUser alias works identically to loginNormalUser", async () => {
    expect(loggedNormalUser).toBe(loginNormalUser);
  });
});
