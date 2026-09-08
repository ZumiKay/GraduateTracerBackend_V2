//FormResponseController Integration Testing
import Request from "supertest";
import mongoose, { Mongoose, Types } from "mongoose";
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
import Form, {
  FormType,
  returnscore,
  TypeForm,
} from "../../../model/Form.model";
import User, { ROLE, UserType } from "../../../model/User.model";
import Formsession from "../../../model/Formsession.model";
import FormResponse, {
  ResponseCompletionStatus,
  ScoringMethod,
} from "../../../model/Response.model";
import Usersession from "../../../model/Usersession.model";
import Content from "../../../model/Content.model";
import Notification from "../../../model/Notification.model";
import EmailService from "../../../services/EmailService";
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
    jest.spyOn(EmailService.prototype, "sendEmail").mockResolvedValue(true);
    jest
      .spyOn(EmailService.prototype, "sendResponseResults")
      .mockResolvedValue(true);
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
    await FormResponse.deleteMany({});
    await Formsession.deleteMany({});
    await Notification.deleteMany({});
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

  /**
   * Test case analysis for SubmitFormResponseMethod
   * @private vlidateSubmissionInput
   *  [x] Response must be an array
   *  [x] all question must have _id
   *
   * @static createSubmissionWithTracking
   *  [x] gather all require tracking data
   *
   * Form type processing service
   *  [x] processFormSubmission (quiz form process)
   *    [x] addscore method
   *      [x] all normal question type score
   *      [x] normal condition question score
   *      [x] condition with useChildSum = true
   *      [x] condtion with isBonusScore = true
   *    [x] send notirfacation to notify new response
   *
   *
   */

  describe("Submit Form Response Method", () => {
    let formOwner: UserType;
    let respondentUser: UserType;
    let testQuizForm: any;

    beforeEach(async () => {
      formOwner = await createTestUser({
        name: "Quiz Owner",
        email: `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
      });
      respondentUser = await createTestUser({
        name: "Quiz Respondent",
        email: `respondent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        password: "pass@12345",
      });
      testQuizForm = await createTestForm(formOwner._id, {
        type: TypeForm.Quiz,
        totalscore: 50,
        setting: {
          acceptResponses: true,
          acceptGuest: true,
          email: true,
          submitonce: false,
          returnscore: returnscore.partial,
        },
      });
    });

    describe("validateSubmissionInput", () => {
      test("status 400 if responseSet is not an array", async () => {
        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const invalidResponseset = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: MockContentFactory.generateResponseSet(),
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(invalidResponseset);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(400);
        expect(res.body.validationErrors).toContain(
          "Response set must be an array",
        );
      });

      test("status 400 if response item is missing question ID or response", async () => {
        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const invalidResponseset = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: [
            { question: "", response: 0 },
            { question: new Types.ObjectId().toString(), response: null },
          ],
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(invalidResponseset);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(400);
        expect(res.body.validationErrors).toBeDefined();
        expect(res.body.validationErrors.length).toBeGreaterThan(0);
      });
    });

    describe("processFormSubmission - scoring condition questions", () => {
      test("normal condition question score: scores both parent and child when answered correctly", async () => {
        const parentId = new Types.ObjectId();
        const childId = new Types.ObjectId();

        const parentQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: parentId,
          formId: testQuizForm._id,
          qIdx: 0,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          conditional: [
            {
              _id: new Types.ObjectId(),
              key: 0,
              contentId: childId,
              contentIdx: 1,
            },
          ],
        });

        const childQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: childId,
          formId: testQuizForm._id,
          qIdx: 1,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 1, isCorrect: true },
          parentcontent: {
            qId: parentId.toString(),
            qIdx: 0,
            optIdx: 0,
          },
        });

        await createQuestionsWithFormId({
          formId: testQuizForm._id,
          replaceQuestion: [parentQuestion, childQuestion],
        });

        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const submissionData = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: [
            MockContentFactory.generateResponseSet({
              question: parentId.toString(),
              response: 0,
            }),
            MockContentFactory.generateResponseSet({
              question: childId.toString(),
              response: 1,
            }),
          ],
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(submissionData);

        expect(res.status).toBe(200);
        expect(res.body.code).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.totalScore).toBe(20);
        expect(res.body.data.isNonScore).toBe(false);

        // Verify database persistence in FormResponse
        const savedResponse = await FormResponse.findById(
          res.body.data.responseId,
        ).lean();
        expect(savedResponse).toBeDefined();
        expect(savedResponse?.totalScore).toBe(20);
        expect(savedResponse?.responseset).toHaveLength(2);

        const parentResp = savedResponse?.responseset.find(
          (r) => r.question.toString() === parentId.toString(),
        );
        const childResp = savedResponse?.responseset.find(
          (r) => r.question.toString() === childId.toString(),
        );

        expect(parentResp?.score).toBe(10);
        expect(parentResp?.scoringMethod).toBe(ScoringMethod.AUTO);
        expect(childResp?.score).toBe(10);
        expect(childResp?.scoringMethod).toBe(ScoringMethod.AUTO);
      });

      test("condition with useChildScoreSum = true: calculates individual child scores correctly", async () => {
        const parentId = new Types.ObjectId();
        const child1Id = new Types.ObjectId();
        const child2Id = new Types.ObjectId();

        const parentQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: parentId,
          formId: testQuizForm._id,
          qIdx: 0,
          score: 20,
          useChildScoreSum: true,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          conditional: [
            {
              _id: new Types.ObjectId(),
              key: 0,
              contentId: child1Id,
              contentIdx: 1,
            },
            {
              _id: new Types.ObjectId(),
              key: 0,
              contentId: child2Id,
              contentIdx: 2,
            },
          ],
        });

        const child1Question = MockContentFactory.createMultipleChoiceContent({
          _id: child1Id,
          formId: testQuizForm._id,
          qIdx: 1,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          parentcontent: {
            qId: parentId.toString(),
            qIdx: 0,
            optIdx: 0,
          },
        });

        const child2Question = MockContentFactory.createMultipleChoiceContent({
          _id: child2Id,
          formId: testQuizForm._id,
          qIdx: 2,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 1, isCorrect: true },
          parentcontent: {
            qId: parentId.toString(),
            qIdx: 0,
            optIdx: 0,
          },
        });

        await createQuestionsWithFormId({
          formId: testQuizForm._id,
          replaceQuestion: [parentQuestion, child1Question, child2Question],
        });

        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const submissionData = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: [
            MockContentFactory.generateResponseSet({
              question: parentId.toString(),
              response: 0,
            }),
            MockContentFactory.generateResponseSet({
              question: child1Id.toString(),
              response: 0,
            }),
            MockContentFactory.generateResponseSet({
              question: child2Id.toString(),
              response: 1,
            }),
          ],
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(submissionData);

        expect(res.status).toBe(200);
        expect(res.body.code).toBe(200);

        const savedResponse = await FormResponse.findById(
          res.body.data.responseId,
        ).lean();
        expect(savedResponse).toBeDefined();

        const child1Resp = savedResponse?.responseset.find(
          (r) => r.question.toString() === child1Id.toString(),
        );
        const child2Resp = savedResponse?.responseset.find(
          (r) => r.question.toString() === child2Id.toString(),
        );

        expect(child1Resp?.score).toBe(10);
        expect(child1Resp?.scoringMethod).toBe(ScoringMethod.AUTO);
        expect(child2Resp?.score).toBe(10);
        expect(child2Resp?.scoringMethod).toBe(ScoringMethod.AUTO);
      });

      test("condition with isBonusScore = true: separates bonus child score into extraScore", async () => {
        const bonusParentId = new Types.ObjectId();
        const bonusChildId = new Types.ObjectId();
        const normalQuestionId = new Types.ObjectId();

        const bonusParent = MockContentFactory.createMultipleChoiceContent({
          _id: bonusParentId,
          formId: testQuizForm._id,
          qIdx: 0,
          score: 0,
          isBonusScore: true,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          conditional: [
            {
              _id: new Types.ObjectId(),
              key: 0,
              contentId: bonusChildId,
              contentIdx: 1,
            },
          ],
        });

        const bonusChild = MockContentFactory.createMultipleChoiceContent({
          _id: bonusChildId,
          formId: testQuizForm._id,
          qIdx: 1,
          score: 5,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          parentcontent: {
            qId: bonusParentId.toString(),
            qIdx: 0,
            optIdx: 0,
          },
        });

        const normalQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: normalQuestionId,
          formId: testQuizForm._id,
          qIdx: 2,
          score: 20,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
        });

        await createQuestionsWithFormId({
          formId: testQuizForm._id,
          replaceQuestion: [bonusParent, bonusChild, normalQuestion],
        });

        await Form.findByIdAndUpdate(testQuizForm._id, { totalscore: 20 });

        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const submissionData = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: [
            MockContentFactory.generateResponseSet({
              question: bonusParentId.toString(),
              response: 0,
            }),
            MockContentFactory.generateResponseSet({
              question: bonusChildId.toString(),
              response: 0,
            }),
            MockContentFactory.generateResponseSet({
              question: normalQuestionId.toString(),
              response: 0,
            }),
          ],
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(submissionData);

        expect(res.status).toBe(200);
        expect(res.body.code).toBe(200);
        expect(res.body.data.totalScore).toBe(20);
        expect(res.body.data.extraScore).toBe(5);

        const savedResponse = await FormResponse.findById(
          res.body.data.responseId,
        ).lean();
        expect(savedResponse).toBeDefined();
        expect(savedResponse?.totalScore).toBe(20);
        expect(savedResponse?.extraScore).toBe(5);
        expect(savedResponse?.maxScore).toBe(20);
      });

      test("condition question with incorrect answer receives 0 score", async () => {
        const parentId = new Types.ObjectId();
        const childId = new Types.ObjectId();

        const parentQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: parentId,
          formId: testQuizForm._id,
          qIdx: 0,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 0, isCorrect: true },
          conditional: [
            {
              _id: new Types.ObjectId(),
              key: 0,
              contentId: childId,
              contentIdx: 1,
            },
          ],
        });

        const childQuestion = MockContentFactory.createMultipleChoiceContent({
          _id: childId,
          formId: testQuizForm._id,
          qIdx: 1,
          score: 10,
          answer: { _id: new Types.ObjectId(), answer: 1, isCorrect: true },
          parentcontent: {
            qId: parentId.toString(),
            qIdx: 0,
            optIdx: 0,
          },
        });

        await createQuestionsWithFormId({
          formId: testQuizForm._id,
          replaceQuestion: [parentQuestion, childQuestion],
        });

        const session = await loggedUserInForm({
          email: respondentUser.email,
          password: "pass@12345",
          formId: testQuizForm.id,
        });

        const submissionData = {
          respondentEmail: respondentUser.email,
          respondentName: respondentUser.name,
          responseSet: [
            MockContentFactory.generateResponseSet({
              question: parentId.toString(),
              response: 0, // correct (10 pts)
            }),
            MockContentFactory.generateResponseSet({
              question: childId.toString(),
              response: 0, // incorrect (correct is 1, so 0 pts)
            }),
          ],
        };

        const res = await Request(app)
          .post(`${baseURL}/submit-response/${testQuizForm.id}`)
          .set("Cookie", [
            `${testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
            `${testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
          ])
          .send(submissionData);

        expect(res.status).toBe(200);
        expect(res.body.code).toBe(200);
        expect(res.body.data.totalScore).toBe(10);

        const savedResponse = await FormResponse.findById(
          res.body.data.responseId,
        ).lean();
        expect(savedResponse?.totalScore).toBe(10);

        const childResp = savedResponse?.responseset.find(
          (r) => r.question.toString() === childId.toString(),
        );
        expect(childResp?.score).toBe(0);
        expect(childResp?.scoringMethod).toBe(ScoringMethod.AUTO);
      });
    });

    describe("Batch Update Scores (PUT /v0/api/response/batch-update-scores)", () => {
      let ownerUser: any;
      let nonOwnerUser: any;
      let ownerToken: string;
      let nonOwnerToken: string;
      let quizForm: any;
      let resp1: any;
      let resp2: any;
      let testQuestion: any;

      beforeEach(async () => {
        ownerUser = await createTestUser({
          email: `batch_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
        });
        nonOwnerUser = await createTestUser({
          email: `batch_nonowner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
        });

        ownerToken = JWT.sign(
          { sub: ownerUser._id.toString(), role: ownerUser.role },
          testEnv.JWT_SECRET,
          { expiresIn: "1h" },
        );
        nonOwnerToken = JWT.sign(
          { sub: nonOwnerUser._id.toString(), role: nonOwnerUser.role },
          testEnv.JWT_SECRET,
          { expiresIn: "1h" },
        );

        quizForm = await createTestForm(ownerUser._id, {
          title: "Batch Scoring Test Quiz",
          type: TypeForm.Quiz,
          totalscore: 50,
          setting: { returnscore: returnscore.manual },
        });

        testQuestion = await Content.create(
          MockContentFactory.createTextContent({
            formId: quizForm._id,
            score: 20,
            require: true,
          }),
        );

        resp1 = await FormResponse.create({
          formId: quizForm._id,
          userId: ownerUser._id,
          respondentEmail: "student1@test.com",
          responseset: [
            {
              question: testQuestion._id,
              response: "Answer 1",
              score: 0,
              scoringMethod: ScoringMethod.MANUAL,
            },
          ],
          totalScore: 0,
          completionStatus: ResponseCompletionStatus.submitted,
        });

        resp2 = await FormResponse.create({
          formId: quizForm._id,
          userId: ownerUser._id,
          respondentEmail: "student2@test.com",
          responseset: [
            {
              question: testQuestion._id,
              response: "Answer 2",
              score: 0,
              scoringMethod: ScoringMethod.MANUAL,
            },
          ],
          totalScore: 0,
          completionStatus: ResponseCompletionStatus.submitted,
        });
      });

      it("returns 401 when unauthenticated", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .send({ updates: [{ responseId: resp1._id.toString(), score: 25 }] });
        expect(res.status).toBe(401);
      });

      it("returns 400 when updates array is missing or empty", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
          .send({ updates: [] });
        expect(res.status).toBe(400);
      });

      it("returns 400 when an update item is missing responseId or score", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
          .send({ updates: [{ responseId: resp1._id.toString() }] });
        expect(res.status).toBe(400);
      });

      it("returns 403 when user is not an owner or editor of the form", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${nonOwnerToken}`])
          .send({
            updates: [{ responseId: resp1._id.toString(), score: 25 }],
          });
        expect(res.status).toBe(403);
      });

      it("successfully updates overall scores for multiple responses in batch", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
          .send({
            updates: [
              { responseId: resp1._id.toString(), score: 30 },
              { responseId: resp2._id.toString(), score: 45 },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.data.successful).toBe(2);

        const updated1 = await FormResponse.findById(resp1._id).lean();
        const updated2 = await FormResponse.findById(resp2._id).lean();

        expect(updated1?.totalScore).toBe(30);
        expect(updated2?.totalScore).toBe(45);
      });

      it("successfully updates question scores for multiple responses in batch", async () => {
        const res = await Request(app)
          .put(`${baseURL}/batch-update-scores`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
          .send({
            updates: [
              {
                responseId: resp1._id.toString(),
                scores: [
                  {
                    questionId: testQuestion._id.toString(),
                    score: 18,
                    comment: "Well done",
                  },
                ],
              },
              {
                responseId: resp2._id.toString(),
                scores: [
                  {
                    questionId: testQuestion._id.toString(),
                    score: 12,
                    comment: "Needs work",
                  },
                ],
              },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.data.successful).toBe(2);

        const updated1 = await FormResponse.findById(resp1._id).lean();
        expect(updated1?.totalScore).toBe(18);
        expect(updated1?.responseset[0].score).toBe(18);
        expect(updated1?.responseset[0].comment).toBe("Well done");
      });
    });

    describe("Batch Return Response & Score Visibility for Manual Forms", () => {
      let ownerUser: any;
      let respondentUser: any;
      let ownerToken: string;
      let respondentToken: string;
      let manualQuizForm: any;
      let formQuestion: any;
      let responseDoc: any;

      beforeEach(async () => {
        ownerUser = await createTestUser({
          email: `manual_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
        });
        respondentUser = await createTestUser({
          email: `manual_resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
        });

        ownerToken = JWT.sign(
          { sub: ownerUser._id.toString(), role: ownerUser.role },
          testEnv.JWT_SECRET,
          { expiresIn: "1h" },
        );
        respondentToken = JWT.sign(
          { sub: respondentUser._id.toString(), role: respondentUser.role },
          testEnv.JWT_SECRET,
          { expiresIn: "1h" },
        );

        manualQuizForm = await createTestForm(ownerUser._id, {
          title: "Manual Scoring Exam",
          type: TypeForm.Quiz,
          totalscore: 100,
          setting: { returnscore: returnscore.manual },
        });

        formQuestion = await Content.create(
          MockContentFactory.createTextContent({
            formId: manualQuizForm._id,
            score: 100,
            require: true,
          }),
        );

        responseDoc = await FormResponse.create({
          formId: manualQuizForm._id,
          userId: respondentUser._id,
          respondentEmail: respondentUser.email,
          responseset: [
            {
              question: formQuestion._id,
              response: "Detailed essay text",
              score: 85,
              scoringMethod: ScoringMethod.MANUAL,
            },
          ],
          totalScore: 85,
          completionStatus: ResponseCompletionStatus.submitted,
          isReturned: false,
        });
      });

      it("hides score on submission and GetFilledForm when score has not been returned yet", async () => {
        // 1. Respondent checks filled form via GET /v0/api/response/filled-form/:formId
        const res = await Request(app)
          .get(`${baseURL}/filled-form/${manualQuizForm._id}`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${respondentToken}`]);

        expect(res.status).toBe(200);
        // Respondent cannot see totalScore yet
        expect(res.body.data.response.totalScore).toBeUndefined();
        expect(res.body.data.response.isScoreReleased).toBe(false);
        // Question scores in responseset should also be masked
        expect(res.body.data.response.responseset[0].score).toBeUndefined();
      });

      it("allows form owner to batch return responses and reveals scores to respondents afterwards", async () => {
        // 1. Form owner returns response in batch via POST /v0/api/response/return
        const returnRes = await Request(app)
          .post(`${baseURL}/return`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
          .send({
            responseId: [responseDoc._id.toString()],
            html: "<p>Grades released</p>",
            feedback: "Great job on your essay!",
          });

        expect(returnRes.status).toBe(200);

        // Verify MongoDB was updated
        const updatedResponse = await FormResponse.findById(
          responseDoc._id,
        ).lean();
        expect(updatedResponse?.isReturned).toBe(true);
        expect(updatedResponse?.completionStatus).toBe("completed");

        // 2. Respondent checks filled form again
        const respondentCheck = await Request(app)
          .get(`${baseURL}/filled-form/${manualQuizForm._id}`)
          .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${respondentToken}`]);

        expect(respondentCheck.status).toBe(200);
        // Respondent can now see their score
        expect(respondentCheck.body.data.response.totalScore).toBe(85);
        expect(respondentCheck.body.data.response.isScoreReleased).toBe(true);
        expect(respondentCheck.body.data.response.responseset[0].score).toBe(
          85,
        );
      });
    });
  });
});
