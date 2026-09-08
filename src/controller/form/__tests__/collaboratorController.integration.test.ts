import Request from "supertest";
import mongoose from "mongoose";
import app from "../../../app";
import JWT from "jsonwebtoken";
import { testEnv, createTestUser, createTestForm } from "./helper.integration";
import User, { UserType } from "../../../model/User.model";
import Form, { CollaboratorType, FormType } from "../../../model/Form.model";
import EmailService from "../../../services/EmailService";
import FormLinkService from "../../../services/FormLinkService";
import { GenerateToken } from "../../../utilities/helper";

describe("Collaborator Controller Integration Tests", () => {
  const baseURL = "/v0/api";
  let formOwner: UserType;
  let collaboratorUser: UserType;
  let otherUser: UserType;
  let testForm: Partial<FormType>;
  let ownerToken: string;
  let collaboratorToken: string;
  let otherUserToken: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }

    //Mocked email sender
    jest.spyOn(EmailService.prototype, "sendEmail").mockResolvedValue(true);
  });

  //Prepare temp data for testing
  beforeEach(async () => {
    process.env = testEnv;
    formOwner = await createTestUser({
      name: "Primary Owner",
      email: `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });
    collaboratorUser = await createTestUser({
      name: "Target Collaborator",
      email: `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });
    otherUser = await createTestUser({
      name: "Unrelated User",
      email: `other_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });

    testForm = await createTestForm(formOwner._id, {
      title: "Collaborator Test Form",
    });

    ownerToken = JWT.sign(
      { sub: formOwner._id.toString(), role: formOwner.role },
      testEnv.JWT_SECRET,
      { expiresIn: "1h" },
    );
    collaboratorToken = GenerateToken(
      { sub: collaboratorUser._id.toString(), role: collaboratorUser.role },
      "1h",
    );
    otherUserToken = GenerateToken(
      { sub: otherUser._id.toString(), role: otherUser.role },
      "1h",
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Form.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe("POST /v0/api/addformowner", () => {
    test("status 401 if unauthenticated", async () => {
      const res = await Request(app).post(`${baseURL}/addformowner`).send({
        formId: testForm.id,
        email: collaboratorUser.email,
        role: CollaboratorType.editor,
        action: "add",
      });

      expect(res.status).toBe(401);
    });

    test("status 403 if requester is not form owner or creator", async () => {
      const res = await Request(app)
        .post(`${baseURL}/addformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
        .send({
          formId: testForm.id,
          email: collaboratorUser.email,
          role: CollaboratorType.editor,
          action: "add",
        });

      expect(res.status).toBe(403);
    });

    test("status 400 if owner tries to add themselves", async () => {
      const res = await Request(app)
        .post(`${baseURL}/addformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          email: formOwner.email,
          role: CollaboratorType.editor,
          action: "add",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot modify your own permissions");
    });

    test("status 404 if target user does not exist", async () => {
      const res = await Request(app)
        .post(`${baseURL}/addformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          email: "nonexistent_email_999@gmail.com",
          role: CollaboratorType.editor,
          action: "add",
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    test("status 200 adds user to pendingCollarborators and sends invitation email", async () => {
      const res = await Request(app)
        .post(`${baseURL}/addformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          email: collaboratorUser.email,
          role: CollaboratorType.editor,
          action: "add",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Invitation sent to");

      // Verify pending collaborator saved in DB
      const updatedForm = await Form.findById(testForm._id).lean();
      expect(updatedForm?.pendingCollarborators).toBeDefined();
      expect(updatedForm?.pendingCollarborators?.length).toBe(1);
      expect(updatedForm?.pendingCollarborators?.[0].user.toString()).toBe(
        collaboratorUser._id.toString(),
      );
    });

    test("status 400 if target user is already a collaborator with that role", async () => {
      // Add collaborator to editors in DB
      await Form.findByIdAndUpdate(testForm._id, {
        $addToSet: { editors: collaboratorUser._id },
      });

      const res = await Request(app)
        .post(`${baseURL}/addformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          email: collaboratorUser.email,
          role: CollaboratorType.editor,
          action: "add",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/User is already a (editor|EDITOR)/i);
    });
  });

  describe("POST /v0/api/collaborator/confirm", () => {
    test("status 400 if invite code is invalid", async () => {
      const res = await Request(app)
        .post(`${baseURL}/collaborator/confirm`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`])
        .send({ invite: "invalid_encrypted_code" });

      expect(res.status).toBe(400);
    });

    test("status 403 if recipient does not match authenticated user", async () => {
      const formLinkService = new FormLinkService();
      const inviteCode = "INVITE123";
      const expireIn = Date.now() + 24 * 60 * 60 * 1000;

      await Form.findByIdAndUpdate(testForm._id, {
        $push: {
          pendingCollarborators: {
            code: inviteCode,
            expireIn,
            user: collaboratorUser._id,
          },
        },
      });

      const generated = formLinkService.generateInviteLink(
        { inviteCode, formId: testForm.id, role: CollaboratorType.editor },
        "/collaborator/confirm",
        24,
      );

      // Attempting to confirm with otherUser token instead of collaboratorUser
      const res = await Request(app)
        .post(`${baseURL}/collaborator/confirm`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
        .send({ invite: generated.encryptedCode });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("This invitation is not for you");
    });

    test("status 200 confirms invite, adds user to editors, and removes from pending", async () => {
      const formLinkService = new FormLinkService();
      const inviteCode = "INVITE456";
      const expireIn = Date.now() + 24 * 60 * 60 * 1000;

      await Form.findByIdAndUpdate(testForm._id, {
        $push: {
          pendingCollarborators: {
            code: inviteCode,
            expireIn,
            user: collaboratorUser._id,
          },
        },
      });

      const generated = formLinkService.generateInviteLink(
        { inviteCode, formId: testForm.id, role: CollaboratorType.editor },
        "/collaborator/confirm",
        24,
      );

      const res = await Request(app)
        .post(`${baseURL}/collaborator/confirm`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`])
        .send({ invite: generated.encryptedCode });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(CollaboratorType.editor);

      // Check DB: user is in editors and removed from pending
      const updatedForm = await Form.findById(testForm._id).lean();
      expect(
        updatedForm?.editors?.some(
          (e) => e.toString() === collaboratorUser._id.toString(),
        ),
      ).toBe(true);
      expect(
        updatedForm?.pendingCollarborators?.some((p) => p.code === inviteCode),
      ).toBe(false);
    });
  });

  describe("GET /v0/api/getformowners/:formId", () => {
    test("status 401 if unauthenticated", async () => {
      const res = await Request(app).get(
        `${baseURL}/getformowners/${testForm.id}`,
      );
      expect(res.status).toBe(401);
    });

    test("status 403 if non-collaborator tries to view owners", async () => {
      const res = await Request(app)
        .get(`${baseURL}/getformowners/${testForm.id}`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`]);

      expect(res.status).toBe(403);
    });

    test("status 403 if editor tries to view owners", async () => {
      await Form.findByIdAndUpdate(testForm._id, {
        $addToSet: { editors: collaboratorUser._id },
      });

      const res = await Request(app)
        .get(`${baseURL}/getformowners/${testForm.id}`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`]);

      expect(res.status).toBe(403);
    });

    test("status 200 returns collaborators list for primary owner", async () => {
      // Add collaboratorUser as co-owner
      await Form.findByIdAndUpdate(testForm._id, {
        $addToSet: { owners: collaboratorUser._id },
      });

      const res = await Request(app)
        .get(`${baseURL}/getformowners/${testForm.id}`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.primaryOwner).toBeDefined();
      expect(res.body.data.primaryOwner.email).toBe(formOwner.email);
      expect(res.body.data.allOwners).toBeDefined();
      expect(res.body.data.allOwners.length).toBe(1);
    });
  });

  describe("DELETE /v0/api/removeformowner", () => {
    test("status 403 if non-creator tries to remove collaborator", async () => {
      const res = await Request(app)
        .delete(`${baseURL}/removeformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
        .send({
          formId: testForm.id,
          email: collaboratorUser.email,
          role: CollaboratorType.editor,
          action: "remove",
        });

      expect(res.status).toBe(403);
    });

    test("status 200 creator removes an editor from form", async () => {
      await Form.findByIdAndUpdate(testForm._id, {
        $addToSet: { editors: collaboratorUser._id },
      });

      const res = await Request(app)
        .delete(`${baseURL}/removeformowner`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
        .send({
          formId: testForm.id,
          email: collaboratorUser.email,
          role: CollaboratorType.editor,
          action: "remove",
        });

      expect(res.status).toBe(200);

      const updatedForm = await Form.findById(testForm._id).lean();
      expect(
        updatedForm?.editors?.some(
          (e) => e.toString() === collaboratorUser._id.toString(),
        ),
      ).toBe(false);
    });
  });

  describe("DELETE /v0/api/removeselfform/:formId", () => {
    test("status 400 if primary owner tries to remove themselves", async () => {
      const res = await Request(app)
        .delete(`${baseURL}/removeselfform/${testForm.id}`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Primary owner cannot remove themselves",
      );
    });

    test("status 200 collaborator removes self from form", async () => {
      await Form.findByIdAndUpdate(testForm._id, {
        $addToSet: { editors: collaboratorUser._id },
      });

      const res = await Request(app)
        .delete(`${baseURL}/removeselfform/${testForm.id}`)
        .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`]);

      expect(res.status).toBe(200);

      const updatedForm = await Form.findById(testForm._id).lean();
      expect(
        updatedForm?.editors?.some(
          (e) => e.toString() === collaboratorUser._id.toString(),
        ),
      ).toBe(false);
    });
  });
});
