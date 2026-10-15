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
      // Nothing was written, so the page version does not move
      expect(res.body.version).toBe(0);
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

  describe("Form access and page versioning", () => {
    const auth = (token: string) => [`${testEnv.ACCESS_TOKEN_COOKIE}=${token}`];
    const save = (token: string, body: Record<string, unknown>) =>
      Request(app)
        .put(`${baseURL}/savecontent`)
        .set("Cookie", auth(token))
        .send({ formId: testForm.id, page: 1, ...body });
    const question = (overrides: Record<string, unknown> = {}) =>
      MockContentFactory.createMultipleChoiceContent({
        formId: testForm._id,
        qIdx: 0,
        score: 10,
        page: 1,
        ...overrides,
      });

    test("a signed-in user who is not a collaborator cannot save or delete", async () => {
      const outsider = await createTestUser({
        name: "Outsider",
        email: `outsider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
      });
      const outsiderToken = JWT.sign(
        { sub: outsider._id.toString(), role: outsider.role },
        testEnv.JWT_SECRET,
        { expiresIn: "1h" },
      );
      const [existing] = await Content.create([question()]);

      const saveRes = await save(outsiderToken, { data: [] });
      const deleteRes = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .set("Cookie", auth(outsiderToken))
        .send({ id: existing._id.toString(), formId: testForm.id });

      expect(saveRes.status).toBe(403);
      expect(deleteRes.status).toBe(403);
      expect(await Content.findById(existing._id)).not.toBeNull();
    });

    test("an editor of the form can save", async () => {
      const editor = await createTestUser({
        name: "Editor",
        email: `editor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
      });
      await Form.updateOne({ _id: testForm._id }, { $push: { editors: editor._id } });
      const editorToken = JWT.sign(
        { sub: editor._id.toString(), role: editor.role },
        testEnv.JWT_SECRET,
        { expiresIn: "1h" },
      );

      const res = await save(editorToken, { data: [question()], version: 0 });

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(1);
    });

    test("content of another form cannot be deleted through a form you own", async () => {
      const otherOwner = await createTestUser({
        name: "Other Owner",
        email: `other_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
      });
      const otherForm = await createTestForm(otherOwner._id, { type: TypeForm.Quiz });
      const [foreign] = await Content.create([
        MockContentFactory.createMultipleChoiceContent({ formId: otherForm._id }),
      ]);

      const res = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .set("Cookie", auth(ownerToken))
        .send({ id: foreign._id.toString(), formId: testForm.id });

      expect(res.status).toBe(400);
      expect(await Content.findById(foreign._id)).not.toBeNull();
    });

    test("versions advance per page and the detail query reports them", async () => {
      const first = await save(ownerToken, { data: [question()], version: 0 });
      expect(first.status).toBe(200);
      expect(first.body.version).toBe(1);

      const saved = first.body.data[0];
      const second = await save(ownerToken, {
        data: [{ ...saved, score: 20 }],
        version: 1,
      });
      expect(second.status).toBe(200);
      expect(second.body.version).toBe(2);

      const detail = await Request(app)
        .get(`${baseURL}/filteredform?ty=detail&q=${testForm.id}&page=1`)
        .set("Cookie", auth(ownerToken));
      expect(detail.status).toBe(200);
      expect(detail.body.data.contentVersion).toBe(2);
      expect(detail.body.data.pageVersions).toBeUndefined();

      // Another page has its own version
      const page2 = await save(ownerToken, {
        page: 2,
        data: [question({ page: 2, qIdx: 1 })],
        version: 0,
      });
      expect(page2.status).toBe(200);
      expect(page2.body.version).toBe(1);
    });

    test("a stale copy gets 409 with the latest page and cannot delete a collaborator's question", async () => {
      // Both collaborators load the empty page at version 0
      const aliceSave = await save(ownerToken, {
        data: [question()],
        version: 0,
      });
      expect(aliceSave.status).toBe(200);
      const aliceQuestionId = aliceSave.body.data[0]._id;

      // Bob still has the empty page; before versioning this save would have
      // deleted Alice's question as "missing from the payload"
      const bobSave = await save(ownerToken, {
        data: [question({ qIdx: 0, score: 5 })],
        version: 0,
      });

      expect(bobSave.status).toBe(409);
      expect(bobSave.body.data.version).toBe(1);
      expect(bobSave.body.data.data.map((q: any) => q._id)).toEqual([aliceQuestionId]);

      const inDb = await Content.find({ formId: testForm._id }).lean();
      expect(inDb).toHaveLength(1);
      expect(inDb[0]._id.toString()).toBe(aliceQuestionId);
      expect((await Form.findById(testForm._id).lean())?.totalscore).toBe(10);

      // After reloading (version 1) Bob's save goes through
      const bobRetry = await save(ownerToken, {
        data: [...bobSave.body.data.data, question({ qIdx: 1, score: 5 })],
        version: 1,
      });
      expect(bobRetry.status).toBe(200);
      expect(bobRetry.body.version).toBe(2);
      expect(await Content.countDocuments({ formId: testForm._id })).toBe(2);
    });

    test("deleting a question invalidates stale copies of its page", async () => {
      const first = await save(ownerToken, { data: [question()], version: 0 });
      const id = first.body.data[0]._id;

      const del = await Request(app)
        .delete(`${baseURL}/deletecontent`)
        .set("Cookie", auth(ownerToken))
        .send({ id, formId: testForm.id });
      expect(del.status).toBe(200);

      // A copy from before the delete would re-create the deleted question
      const stale = await save(ownerToken, {
        data: [{ ...first.body.data[0], score: 99 }],
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect(await Content.countDocuments({ formId: testForm._id })).toBe(0);
    });

    test("deleting a page invalidates every page's version", async () => {
      await Form.updateOne({ _id: testForm._id }, { totalpage: 2 });
      const first = await save(ownerToken, { data: [question()], version: 0 });
      expect(first.body.version).toBe(1);

      const del = await Request(app)
        .put(`${baseURL}/modifypage`)
        .set("Cookie", auth(ownerToken))
        .send({ ty: "delete", formId: testForm.id, deletepage: 2 });
      expect(del.status).toBe(200);

      // Pages may have shifted, so a copy from before the delete is refused
      const stale = await save(ownerToken, {
        data: [{ ...first.body.data[0], score: 99 }],
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect(stale.body.data.version).toBe(2);
    });

    test("a client that sends no version is still accepted", async () => {
      const res = await save(ownerToken, { data: [question()] });

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(1);
    });
  });
});
