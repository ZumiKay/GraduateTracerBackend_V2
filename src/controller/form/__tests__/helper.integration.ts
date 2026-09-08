import bcrypt, { compareSync } from "bcrypt";
import User, { ROLE, UserType } from "../../../model/User.model";
import { Types } from "mongoose";
import Form, { FormType, TypeForm } from "../../../model/Form.model";
import { MockContentFactory } from "../../../utilities/mockdata";
import FormResponse, {
  RespondentType,
  ResponseCompletionStatus,
} from "../../../model/Response.model";
import Content, { ContentType } from "../../../model/Content.model";
import { GenerateToken, getDateByNumDay } from "../../../utilities/helper";
import Formsession from "../../../model/Formsession.model";
import Usersession from "../../../model/Usersession.model";

export const testEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/graduatetracer_test",
  RESPONDENT_TOKEN_JWT_SECRET: "test_respondent_jwt_secret_key_12345",
  ACCESS_RESPONDENT_COOKIE: "graduate_access_resp",
  RESPONDENT_COOKIE: "graduate_refresh_resp",
  REFRESH_TOKEN_COOKIE: "graduate_refreshT",
  ACCESS_TOKEN_COOKIE: process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT",
  JWT_SECRET: "test_jwt_secret_key_12345",
  INVITE_LINK_SECRET:
    process.env.INVITE_LINK_SECRET || "test_invite_secret_key_12345",
};

export const mockTrafficMiddleware = () =>
  jest.mock("../../../middleware/Traffic.middleware", () => ({
    __esModule: true,
    default: {
      LoginRateLimit: (req: any, res: any, next: any) => next(),
      ApiRateLimit: (req: any, res: any, next: any) => next(),
      PasswordResetRateLimit: (req: any, res: any, next: any) => next(),
      Ratelimit: (req: any, res: any, next: any) => next(),
    },
  }));

export const mockEmailSender = () =>
  jest.mock("../../../utilities/email", () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue({
      success: true,
      message: "Email sent successfully",
    }),
  }));
const sampleUserData = {
  email: "respondent_user@example.com",
  name: "respondent_user",
  password: "Password@12345",
  role: ROLE.USER,
};

export const createTestUser = async (overrides?: Partial<UserType>) => {
  const password = overrides?.password ?? sampleUserData.password;
  const hashedPassword = bcrypt.hashSync(password, 10);
  return await User.create({
    ...sampleUserData,
    ...overrides,
    password: hashedPassword,
  });
};

export const createTestForm = async (
  userId: Types.ObjectId,
  overrides?: Partial<FormType>,
) => {
  return await Form.create({
    title: "Integration Test Quiz Form",
    type: TypeForm.Quiz,
    totalpage: 3,
    totalscore: 50,
    user: userId,
    setting: {
      acceptResponses: true,
      acceptGuest: true,
      email: true,
      submitonce: true,
    },
    ...overrides,
  });
};

/**Create questions with formId require
 * @requires Form
 */
export const createQuestionsWithFormId = async ({
  formId,
  replaceQuestion,
}: {
  formId: Types.ObjectId;
  replaceQuestion?: Array<ContentType>;
}) => {
  try {
    if (replaceQuestion) {
      await Content.deleteMany({ formId });
    }
    const sampleTestQuestions = replaceQuestion
      ? replaceQuestion.map((q) => ({ page: 1, ...q, formId }))
      : MockContentFactory.createSampleForm(formId);

    const createdContent = await Content.create([...sampleTestQuestions]);
    return createdContent;
  } catch (error) {
    console.log("createQuestionsWithFormId", error);
  }
};

export const createResponse = async ({
  formId,
  userId,
  respondentEmail,
  questions,
}: {
  formId: string;
  userId: string;
  respondentEmail?: string;
  questions?: Array<ContentType>;
}) => {
  try {
    let email = respondentEmail;
    if (!email && userId) {
      const user = await User.findById(userId).lean();
      email = user?.email;
    }
    return await FormResponse.create({
      formId,
      userId,
      respondentEmail: email,
      respondentType: RespondentType.user,
      completionStatus: ResponseCompletionStatus.submitted,
      totalScore: 90,
      submittedAt: new Date(),
      responseset: questions
        ? questions.map((q) => MockContentFactory.generateResponseSet(q))
        : [
            MockContentFactory.createResponseSet({
              question: new Types.ObjectId(),
            }),
          ],
    });
  } catch (error) {
    console.log("FormResponse Test", error);
  }
};
export const loggedUserInForm = async ({
  email,
  password,
  formId,
}: Pick<UserType, "email" | "password"> & {
  formId?: string | Types.ObjectId;
}) => {
  const isUser = await User.findOne({ email }).lean();

  if (!isUser) {
    console.log("Integration", "No user found");
    return;
  }
  const isValid = bcrypt.compareSync(password, isUser.password);

  if (!isValid) {
    console.log("Integration", "Wrong Password");
    return;
  }

  //create formsession

  const payload = {
    id: isUser._id.toString(),
    email: isUser.email,
    ...(formId ? { formId: formId.toString() } : {}),
  };
  const accessToken = GenerateToken(
    payload,
    "30m",
    process.env.RESPONDENT_TOKEN_JWT_SECRET,
  );
  const refreshToken = GenerateToken(
    payload,
    "12h",
    process.env.RESPONDENT_TOKEN_JWT_SECRET,
  );
  await Formsession.create({
    form: formId ? new Types.ObjectId(formId) : undefined,
    access_id: accessToken,
    session_id: refreshToken,
    expiredAt: getDateByNumDay(1),
    respondentEmail: isUser.email,
    respondentName: isUser.name,
  });

  return { accessToken, refreshToken };
};

export interface NormalUserLoginResult {
  user: any;
  accessToken: string;
  refreshToken: string;
  cookies: string[];
  cookieHeader: string[];
}

export type LoginNormalUserOptions =
  | {
      email?: string;
      password?: string;
      user?: Partial<UserType> & { _id?: any };
      rememberMe?: boolean;
    }
  | (Partial<UserType> & { _id?: any });

/**
 * Helper to log in a normal system user, generate access/refresh JWT tokens,
 * record a Usersession in MongoDB, and return authentication cookies ready for Supertest.
 */
export const loginNormalUser = async (
  options?: LoginNormalUserOptions,
): Promise<NormalUserLoginResult | undefined> => {
  let targetUser: any = null;
  let rememberMe = false;

  if (!options) {
    targetUser =
      (await User.findOne({ email: sampleUserData.email }).lean()) ||
      (await createTestUser());
  } else if ("user" in options && options.user) {
    targetUser = options.user;
    rememberMe = options.rememberMe ?? false;
  } else if (
    "_id" in options &&
    options._id &&
    !("password" in options && !("email" in options))
  ) {
    targetUser = options;
  } else if ("email" in options && options.email) {
    rememberMe = (options as any).rememberMe ?? false;
    const foundUser = await User.findOne({ email: options.email }).lean();
    if (!foundUser) return undefined;
    if ("password" in options && options.password) {
      const isMatch =
        options.password === foundUser.password ||
        compareSync(options.password, foundUser.password);
      if (!isMatch) return undefined;
    }
    targetUser = foundUser;
  } else if ("_id" in options && options._id) {
    targetUser = options;
  }

  if (!targetUser) {
    return undefined;
  }

  const userId =
    typeof targetUser._id?.toString === "function"
      ? targetUser._id.toString()
      : String(targetUser._id || targetUser.id);

  const role = targetUser.role || ROLE.USER;

  const tokenPayload = {
    sub: userId,
    role,
    jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
  };

  const secret = process.env.JWT_SECRET || testEnv.JWT_SECRET;
  const accessToken = GenerateToken(tokenPayload, "15m", secret);
  const refreshToken = GenerateToken(
    tokenPayload,
    rememberMe ? "7d" : "1d",
    secret,
  );

  const sessionExpireAt = rememberMe ? getDateByNumDay(7) : getDateByNumDay(1);

  await Usersession.create({
    session_id: refreshToken,
    expireAt: sessionExpireAt,
    user: new Types.ObjectId(userId),
  });

  const accessCookieName =
    process.env.ACCESS_TOKEN_COOKIE || testEnv.ACCESS_TOKEN_COOKIE;
  const refreshCookieName =
    process.env.REFRESH_TOKEN_COOKIE || testEnv.REFRESH_TOKEN_COOKIE;

  const cookies = [
    `${accessCookieName}=${accessToken}`,
    `${refreshCookieName}=${refreshToken}`,
  ];

  return {
    user: targetUser,
    accessToken,
    refreshToken,
    cookies,
    cookieHeader: cookies,
  };
};

export const loggedNormalUser = loginNormalUser;
