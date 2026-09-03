import Request from "supertest";
import mongoose, { Types } from "mongoose";
import app from "../../../app";
import JWT from "jsonwebtoken";
import { testEnv, createTestUser, createTestForm } from "./helper.integration";
import User, { UserType } from "../../../model/User.model";
import Form, { TypeForm } from "../../../model/Form.model";
import Content from "../../../model/Content.model";
import { MockContentFactory } from "../../../utilities/mockdata";

describe("Question Controller Integration Tests", () => {
  const baseURL = "/v0/api";
  let formOwner: UserType;
  let testForm: any;
  let ownerToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }
  });

  beforeEach(async () => {
    process.env = testEnv;
    formOwner = await createTestUser({
      name: "Form Author",
      email: `author_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });
    testForm = await createTestForm(formOwner._id, {
      type: TypeForm.Quiz,
      totalscore: 0,
    });
    ownerToken = JWT.sign(
      { sub: formOwner._id.toString(), role: formOwner.role },
      testEnv.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    await Content.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("POST /v0/api/savequestion", () => {
    test("status 401 if missing access token cookie", async () => {
      const res = await Request(app)
        .post(`${baseURL}/savequestion`)
        .send({
          formId: testForm.id,
          page: 1,
          data: [],
        });

      expect(res.status).toBe(401);
    });

    test("status 400 if ConditionQuestionValidator detects invalid condition question type", async () => {
      const invalidQuestion = MockContentFactory.createTextContent({
        formId: testForm._id,
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId(),
          },
        ],
      });

      const res = await Request(app)
        .post(`${baseURL}/savequestion`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          page: 1,
          data: [invalidQuestion],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Condition questions are only allowed for checkbox and multiple choice",
      );
    });

    test("status 200 saves questions, persists in DB, and recalculates form totalscore", async () => {
      const q1 = MockContentFactory.createMultipleChoiceContent({
        formId: testForm._id,
        qIdx: 0,
        score: 10,
        page: 1,
      });
      const q2 = MockContentFactory.createCheckboxContent({
        formId: testForm._id,
        qIdx: 1,
        score: 15,
        page: 1,
      });

      const res = await Request(app)
        .post(`${baseURL}/savequestion`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          page: 1,
          data: [q1, q2],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      // Check DB persistence
      const savedContents = await Content.find({ formId: testForm._id }).lean();
      expect(savedContents.length).toBe(2);

      // Check Form totalscore recalculation
      const updatedForm = await Form.findById(testForm._id).lean();
      expect(updatedForm?.totalscore).toBe(25);
    });

    test("status 200 with 'No changes detected' when no modifications are sent", async () => {
      const res = await Request(app)
        .post(`${baseURL}/savequestion`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          page: 2,
          data: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("No changes detected");
    });
  });

  describe("DELETE /v0/api/deletecontent", () => {
    test("status 401 if unauthenticated", async () => {
      const res = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .send({ id: new Types.ObjectId().toString(), formId: testForm.id });

      expect(res.status).toBe(401);
    });

    test("status 400 if missing id or formId", async () => {
      const res = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({ formId: testForm.id });

      expect(res.status).toBe(400);
    });

    test("status 200 deletes question from DB and updates form score", async () => {
      const [savedQ] = await Content.create([
        MockContentFactory.createMultipleChoiceContent({
          formId: testForm._id,
          score: 15,
        }),
      ]);

      const res = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          id: savedQ._id.toString(),
          formId: testForm.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Question Deleted");

      const inDb = await Content.findById(savedQ._id);
      expect(inDb).toBeNull();
    });
  });
});
