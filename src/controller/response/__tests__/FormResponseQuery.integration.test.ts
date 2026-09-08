import mongoose, { Types } from "mongoose";
import Request from "supertest";
import User, { UserType } from "../../../model/User.model";
import Form, { FormType } from "../../../model/Form.model";
import Content, { ContentType } from "../../../model/Content.model";
import FormResponse, {
  FormResponseType,
  RespondentType,
  ResponseCompletionStatus,
} from "../../../model/Response.model";
import Usersession from "../../../model/Usersession.model";
import {
  ResponseFilterType,
  ResponseQueryService,
} from "../../../services/ResponseQueryService";
import { MockContentFactory } from "../../../utilities/mockdata";
import {
  createQuestionsWithFormId,
  createResponse,
  createTestForm,
  createTestUser,
  loginNormalUser,
  NormalUserLoginResult,
  testEnv,
} from "../../form/__tests__/helper.integration";
import app from "../../../app";
import {
  AddQuestionNumbering,
  formatDateToDDMMYYYY,
} from "../../../utilities/helper";

describe("FormResponse Query controller integration test", () => {
  let baseURL = "/v0/api/response";
  let sampleFormOwner: Partial<UserType> = {
    name: "testFormOwner",
    email: "testFormOwner@test.com",
    password: "Owner@12345",
  };
  let testFormOwner: UserType;
  let testForm: FormType;
  let testQuestions: Array<ContentType>;
  let testResponses: Array<FormResponseType>;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }
    testFormOwner = await createTestUser(sampleFormOwner);
    testForm = await createTestForm(testFormOwner._id);
    const conditionQuestions =
      MockContentFactory.createConditionQuestionWithChilds({
        parent: MockContentFactory.createCheckboxContent({
          formId: testForm._id,
          qIdx: 5,
        }),
        childs: [
          MockContentFactory.createTextContent({
            formId: testForm._id,
            qIdx: 6,
          }),
          MockContentFactory.createDateContent({
            formId: testForm._id,
            qIdx: 7,
          }),
        ],
      }) as Array<ContentType>;

    const generateTestQuestion: Array<ContentType> = [
      MockContentFactory.createMultipleChoiceContent({
        formId: testForm._id,
        qIdx: 0,
      }),
      MockContentFactory.createCheckboxContent({
        formId: testForm._id,
        qIdx: 1,
      }),
      MockContentFactory.createDateContent({ formId: testForm._id, qIdx: 2 }),
      MockContentFactory.createRangeDateContent({
        qIdx: 3,
        formId: testForm._id,
      }),
      MockContentFactory.createDateContent({ qIdx: 4, formId: testForm._id }),
      ...conditionQuestions,
    ];
    testQuestions = (await createQuestionsWithFormId({
      formId: testForm._id,
      replaceQuestion: generateTestQuestion,
    })) as never;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await Content.deleteMany({});
    await FormResponse.deleteMany({});
    await Usersession.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  /**Test for getResponseList case analysis
   * [x] normal fetch with all require filter options
   * [x] Group response by email
   */

  describe("GetResponses with Filters method", () => {
    let filterOptions: ResponseFilterType;

    beforeEach(() => {
      process.env = testEnv;
      //Normal fetch option
      filterOptions = {
        formId: testForm._id.toString(),
        page: 1,
        limit: 10,
      };
    });

    test("200 status should return standard data", async () => {
      const respondent = await createTestUser({
        email: `respondent_${Date.now()}@test.com`,
        password: "pass@12345",
      });
      await createResponse({
        formId: testForm._id.toString(),
        userId: respondent.id,
        respondentEmail: respondent.email,
      });

      //logging in as FormOwner
      const isLoggedInFormOwner = await loginNormalUser(testFormOwner);

      const superTest = await Request(app)
        .get(`${baseURL}/getresponselist`)
        .query(filterOptions)
        .set("Cookie", isLoggedInFormOwner?.cookies as string[]);

      expect(superTest.status).toBe(200);
      const data = superTest.body.data || superTest.body;
      expect(data.responses).toBeDefined();
      expect(Array.isArray(data.responses)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    test("200 status with group=respondentEmail should return grouped responses", async () => {
      const respondent = await createTestUser({
        email: `grouped_${Date.now()}@test.com`,
        password: "pass@12345",
      });
      await createResponse({
        formId: testForm._id.toString(),
        userId: respondent.id,
        respondentEmail: respondent.email,
      });
      await createResponse({
        formId: testForm._id.toString(),
        userId: respondent.id,
        respondentEmail: respondent.email,
      });

      const isLoggedInFormOwner = await loginNormalUser(testFormOwner);

      const res = await Request(app)
        .get(`${baseURL}/getresponselist`)
        .query({
          ...filterOptions,
          group: "respondentEmail",
        })
        .set("Cookie", isLoggedInFormOwner?.cookies as string[]);

      expect(res.status).toBe(200);
      const resData = res.body.data || res.body;
      expect(resData.responses).toBeDefined();
      const grouped = resData.responses.find(
        (item: any) => item.respondentEmail === respondent.email,
      );
      expect(grouped).toBeDefined();
      expect(grouped.responseCount).toBe(2);
    });
  });
  describe("Get Responses By ID method", () => {
    let loggedIn: NormalUserLoginResult | undefined;
    beforeEach(async () => {
      loggedIn = await loginNormalUser({
        email: testFormOwner.email,
        password: testFormOwner.password,
      });
    });
    test("400 status if param is invalid", async () => {
      const superTest = await Request(app)
        .get(`${baseURL}/getresponseById/undefinedId/${testForm.id}`)
        .set("Cookie", loggedIn?.cookies as string[]);
      expect(superTest.status).toBe(400);
      expect(superTest.body.message).toBeDefined();
    });
    test("200 status should return correct response data", async () => {
      //prepare data
      const testRespondent: UserType = await createTestUser({
        email: `testRespondent_${Date.now()}@example.com`,
        name: "testRespondent",
        password: "pass@12345",
      });
      const testResponse = await createResponse({
        formId: testForm._id.toString(),
        userId: testRespondent._id.toString(),
        respondentEmail: testRespondent.email,
        questions: testQuestions,
      });

      const contents = (await Content.find({ formId: testForm._id })
        .select("-rangedate -date -rangenumber")
        .sort({ qIdx: 1 })
        .lean()) as Array<ContentType>;

      const expectResult: FormResponseType = {
        _id: testResponse?._id as Types.ObjectId,
        formId: testResponse?.formId as Types.ObjectId,
        respondentEmail: testResponse?.respondentEmail,
        respondentType: RespondentType.user,
        isCompleted: true,
        completionStatus: ResponseCompletionStatus.submitted,
        createdAt: testResponse?.createdAt,
        totalScore: testResponse?.totalScore,
        submittedAt: formatDateToDDMMYYYY(testResponse?.submittedAt as Date),
        responseCount: 1,
        isScoreable: true,
        responseset: ResponseQueryService.ResponsesetProcessQuestion(
          AddQuestionNumbering({
            questions: contents,
          }),
          testResponse?.responseset as never,
        ),
      };
      const superTest = await Request(app)
        .get(
          `${baseURL}/getresponseById/${expectResult._id.toString()}/${testForm._id.toString()}`,
        )
        .set("Cookie", loggedIn?.cookies as Array<string>);

      expect(superTest.status).toBe(200);
      const data = superTest.body.data || superTest.body;
      expect(data).toBeDefined();
      expect(data._id.toString()).toBe(expectResult._id.toString());
      expect(data.formId.toString()).toBe(testForm._id.toString());
      expect(data.respondentEmail).toBe(testRespondent.email);
      expect(data.responseCount).toBe(1);
      expect(data.isScoreable).toBe(true);
      expect(data.responseset).toBeDefined();
      expect(data.responseset.length).toBe(testQuestions.length);
    });
  });
});
