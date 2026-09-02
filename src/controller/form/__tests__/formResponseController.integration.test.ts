//FormResponseController Integration Testing
import Request from "supertest";
import mongoose, { Types } from "mongoose";
import app from "../../../app";
import { ReturnCode } from "../../../utilities/helper";
import { RESPONSES } from "../../../types/customType";
import { GetPublicFormDataTyEnum } from "../../../middleware/User.middleware";
import {
  createQuestionsWithFormId,
  createResponse,
  createTestForm,
  createTestUser,
  loggedUserInForm,
  testEnv,
} from "./helper.integration";
import Form, { FormType } from "../../../model/Form.model";
import User, { ROLE, UserType } from "../../../model/User.model";
import Formsession from "../../../model/Formsession.model";
import FormResponse from "../../../model/Response.model";
import Usersession from "../../../model/Usersession.model";
import Content from "../../../model/Content.model";
import JWT from "jsonwebtoken";
import { MockContentFactory } from "../../../utilities/mockdata";

type FormTestingDataType = Pick<
  FormType,
  "id" | "title" | "type" | "totalpage" | "totalscore" | "setting"
>;

describe("FormResponse Controller Integration Test", () => {
  const baseURL = "/v0/api/response";
  let sampleFormData: Partial<FormTestingDataType> | undefined = undefined;
  let sampleUser: Partial<UserType> | undefined = undefined;

  beforeAll(async () => {
    //Mocked DB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = testEnv;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await Usersession.deleteMany({});
    await Content.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("GetPublicFormData", () => {
    let localFormId: Types.ObjectId;
    let localInitialURL: string;

    beforeEach(() => {
      jest.clearAllMocks();
      localFormId = new Types.ObjectId();
      localInitialURL = `${baseURL}/form/${localFormId}`;
    });

    test("400 if missing ty", async () => {
      const superTest = await Request(app).get(localInitialURL);

      expect(superTest.status).toBe(400);
      expect(superTest.body).toStrictEqual(RESPONSES.invalidRequestType());
    });
    test("500 if missing env", async () => {
      process.env = {
        ...testEnv,
        REFRESH_TOKEN_COOKIE: undefined,
      } as never;
      const superTest = await Request(app)
        .get(localInitialURL)
        .query({ ty: GetPublicFormDataTyEnum.initial });

      expect(superTest.status).toBe(500);
      expect(superTest.body).toStrictEqual(ReturnCode(500));
    });

    describe(`ty = ${GetPublicFormDataTyEnum.initial}`, () => {
      let FormOwner: UserType;
      beforeAll(async () => {
        //create user
        FormOwner = await createTestUser();
      });

      afterAll(async () => {
        sampleFormData = undefined;
      });

      test("status 404 if the form is closed", async () => {
        sampleFormData = await createTestForm(FormOwner._id, {
          setting: {
            acceptResponses: false,
            email: true,
          },
        });
        localInitialURL = `${baseURL}/form/${sampleFormData.id}`;
        const superTest = await Request(app).get(localInitialURL).query({
          ty: GetPublicFormDataTyEnum.initial,
        });
        expect(superTest.status).toBe(404);
        expect(superTest.body).toStrictEqual(ReturnCode(404, "Form is closed"));
      });
      describe("Require email form", () => {
        let testRespondent: UserType;
        let loggedIn: { accessToken: string; refreshToken: string } | undefined;
        beforeEach(async () => {
          //Create form and question
          sampleFormData = await createTestForm(FormOwner._id);
          sampleFormData.id &&
            (await createQuestionsWithFormId({
              formId: new Types.ObjectId(sampleFormData.id),
            }));
          localInitialURL = `${baseURL}/form/${sampleFormData.id}`;
          sampleUser = {
            email: "TestRespondent@gmail.com",
            name: "TestRespondent",
            password: "pass@12345",
            role: ROLE.USER,
          };

          testRespondent = await createTestUser(sampleUser);
          loggedIn = await loggedUserInForm({
            email: testRespondent.email,
            password: sampleUser?.password as string,
            formId: sampleFormData?.id as string,
          });
        });
        afterAll(async () => {
          await Formsession.deleteMany({});
          await FormResponse.deleteMany({});
        });

        test("status 200 isResponse shoud be true if user response exist in submitonce form", async () => {
          //create response
          await createResponse({
            formId: sampleFormData?.id as string,
            userId: testRespondent?._id.toString() as string,
          });

          const superTest = await Request(app)
            .get(localInitialURL)
            .query({ ty: GetPublicFormDataTyEnum.initial })
            .withCredentials()
            .set("Cookie", [
              `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
              `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
            ]);
          expect(superTest.status).toBe(200);
          expect(superTest.body.code).toBe(200);
          expect(superTest.body.message).toBe("Success");
          expect(superTest.body.data._id).toBe(sampleFormData?.id);
          expect(superTest.body.data.title).toBe(sampleFormData?.title);
          expect(superTest.body.data.type).toBe(sampleFormData?.type);
          expect(superTest.body.data.totalpage).toBe(sampleFormData?.totalpage);
          expect(superTest.body.data.isAuthenticated).toBe(true);
          expect(superTest.body.data.isResponsed).toMatchObject({
            message: "You already submitted response",
          });
        });
        test("status 400 If form contents have some invalid", async () => {
          //Prerequisite
          await createQuestionsWithFormId({
            formId: new Types.ObjectId(sampleFormData?.id),
            replaceQuestion: [
              MockContentFactory.createCheckboxContent({ checkbox: [] }),
              MockContentFactory.createRangeDateContent({
                rangedate: {
                  start: new Date("2026-08-01"),
                  end: new Date("2026-07-01"),
                },
              }),
            ],
          });

          //Invalid form contents matcher
          const superTest = await Request(app)
            .get(localInitialURL)
            .query({ ty: GetPublicFormDataTyEnum.initial })
            .withCredentials()
            .set("Cookie", [
              `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
              `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
            ]);

          expect(superTest.status).toBe(400);
          expect(superTest.body.code).toBe(400);
          expect(superTest.body.data.data.contentValidation).toBeDefined();
          expect(
            superTest.body.data.data.contentValidation.some(
              (item: any) => !item.isValid,
            ),
          ).toBe(true);
          expect(
            superTest.body.data.data.contentValidation[0].errors.length,
          ).toBeGreaterThan(0);
        });
        test("status 200 return formdata with isAuthenticate to true", async () => {
          const superTest = await Request(app)
            .get(localInitialURL)
            .query({ ty: GetPublicFormDataTyEnum.initial })
            .withCredentials()
            .set("Cookie", [
              `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
              `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
            ]);

          expect(superTest.status).toBe(200);
          expect(superTest.body?.data).toBeDefined();
          expect(superTest.body.data.isAuthenticated).toBe(true);
        });
      });
    });

    describe(`ty = ${GetPublicFormDataTyEnum.data}`, () => {
      let FormOwner: UserType;
      beforeAll(async () => {
        FormOwner = await createTestUser();
      });

      afterEach(async () => {
        await Formsession.deleteMany({});
      });

      test("status 401 if missing session cookies", async () => {
        const form = await createTestForm(FormOwner._id);
        const superTest = await Request(app)
          .get(`${baseURL}/form/${form.id}`)
          .query({ ty: GetPublicFormDataTyEnum.data });

        expect(superTest.status).toBe(401);
        expect(superTest.body).toStrictEqual(RESPONSES.missingSessionToken());
      });

      test("status 200 returns form data with questions when respondent session is valid", async () => {
        const form = await createTestForm(FormOwner._id);
        await createQuestionsWithFormId({
          formId: new Types.ObjectId(form.id),
        });
        const respondent = await createTestUser({
          email: "DataRespondent@gmail.com",
          name: "DataRespondent",
          password: "pass@12345",
          role: ROLE.USER,
        });
        const loggedIn = await loggedUserInForm({
          email: respondent.email,
          password: "pass@12345",
          formId: form.id as string,
        });

        const superTest = await Request(app)
          .get(`${baseURL}/form/${form.id}`)
          .query({ ty: GetPublicFormDataTyEnum.data, p: 1 })
          .withCredentials()
          .set("Cookie", [
            `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
            `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
          ]);

        expect(superTest.status).toBe(200);
        expect(superTest.body.code).toBe(200);
        expect(superTest.body.data.contents).toBeDefined();
        expect(Array.isArray(superTest.body.data.contents)).toBe(true);
        expect(superTest.body.data.contents.length).toBeGreaterThan(0);
        expect(superTest.body.data.isAuthenticated).toBe(true);
        expect(superTest.body.data.isLoggedIn).toBe(true);
      });
    });

    describe(`ty = ${GetPublicFormDataTyEnum.preview}`, () => {
      let FormOwner: UserType;
      beforeAll(async () => {
        FormOwner = await createTestUser();
      });

      afterEach(async () => {
        await Usersession.deleteMany({});
      });

      test("status 200 returns form preview with questions when accessed by form owner", async () => {
        const form = await createTestForm(FormOwner._id);
        await createQuestionsWithFormId({
          formId: new Types.ObjectId(form.id),
        });

        const accessToken = JWT.sign(
          { sub: FormOwner._id.toString(), role: FormOwner.role },
          process.env.JWT_SECRET as string,
          { expiresIn: "1h" },
        );

        const superTest = await Request(app)
          .get(`${baseURL}/form/${form.id}`)
          .query({ ty: GetPublicFormDataTyEnum.preview, p: 1 })
          .withCredentials()
          .set("Cookie", [
            `${process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT"}=${accessToken}`,
          ]);

        expect(superTest.status).toBe(200);
        expect(superTest.body.code).toBe(200);
        expect(superTest.body.data._id).toBe(form.id);
        expect(superTest.body.data.contents).toBeDefined();
        expect(Array.isArray(superTest.body.data.contents)).toBe(true);
        expect(superTest.body.data.contents.length).toBeGreaterThan(0);
        expect(superTest.body.data.isAuthenticated).toBe(true);
      });
    });
  });
});
