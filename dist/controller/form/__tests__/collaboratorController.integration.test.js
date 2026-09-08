"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("../../../app"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helper_integration_1 = require("./helper.integration");
const User_model_1 = __importDefault(require("../../../model/User.model"));
const Form_model_1 = __importStar(require("../../../model/Form.model"));
const EmailService_1 = __importDefault(require("../../../services/EmailService"));
const FormLinkService_1 = __importDefault(require("../../../services/FormLinkService"));
const helper_1 = require("../../../utilities/helper");
describe("Collaborator Controller Integration Tests", () => {
    const baseURL = "/v0/api";
    let formOwner;
    let collaboratorUser;
    let otherUser;
    let testForm;
    let ownerToken;
    let collaboratorToken;
    let otherUserToken;
    beforeAll(async () => {
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
        //Mocked email sender
        jest.spyOn(EmailService_1.default.prototype, "sendEmail").mockResolvedValue(true);
    });
    //Prepare temp data for testing
    beforeEach(async () => {
        process.env = helper_integration_1.testEnv;
        formOwner = await (0, helper_integration_1.createTestUser)({
            name: "Primary Owner",
            email: `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        collaboratorUser = await (0, helper_integration_1.createTestUser)({
            name: "Target Collaborator",
            email: `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        otherUser = await (0, helper_integration_1.createTestUser)({
            name: "Unrelated User",
            email: `other_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        testForm = await (0, helper_integration_1.createTestForm)(formOwner._id, {
            title: "Collaborator Test Form",
        });
        ownerToken = jsonwebtoken_1.default.sign({ sub: formOwner._id.toString(), role: formOwner.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
        collaboratorToken = (0, helper_1.GenerateToken)({ sub: collaboratorUser._id.toString(), role: collaboratorUser.role }, "1h");
        otherUserToken = (0, helper_1.GenerateToken)({ sub: otherUser._id.toString(), role: otherUser.role }, "1h");
    });
    afterAll(async () => {
        await User_model_1.default.deleteMany({});
        await Form_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    describe("POST /v0/api/addformowner", () => {
        test("status 401 if unauthenticated", async () => {
            const res = await (0, supertest_1.default)(app_1.default).post(`${baseURL}/addformowner`).send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(401);
        });
        test("status 403 if requester is not form owner or creator", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/addformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
                .send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(403);
        });
        test("status 400 if owner tries to add themselves", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/addformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                email: formOwner.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Cannot modify your own permissions");
        });
        test("status 404 if target user does not exist", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/addformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                email: "nonexistent_email_999@gmail.com",
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(404);
            expect(res.body.message).toBe("User not found");
        });
        test("status 200 adds user to pendingCollarborators and sends invitation email", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/addformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toContain("Invitation sent to");
            // Verify pending collaborator saved in DB
            const updatedForm = await Form_model_1.default.findById(testForm._id).lean();
            expect(updatedForm?.pendingCollarborators).toBeDefined();
            expect(updatedForm?.pendingCollarborators?.length).toBe(1);
            expect(updatedForm?.pendingCollarborators?.[0].user.toString()).toBe(collaboratorUser._id.toString());
        });
        test("status 400 if target user is already a collaborator with that role", async () => {
            // Add collaborator to editors in DB
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $addToSet: { editors: collaboratorUser._id },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/addformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "add",
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/User is already a (editor|EDITOR)/i);
        });
    });
    describe("POST /v0/api/collaborator/confirm", () => {
        test("status 400 if invite code is invalid", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/collaborator/confirm`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`])
                .send({ invite: "invalid_encrypted_code" });
            expect(res.status).toBe(400);
        });
        test("status 403 if recipient does not match authenticated user", async () => {
            const formLinkService = new FormLinkService_1.default();
            const inviteCode = "INVITE123";
            const expireIn = Date.now() + 24 * 60 * 60 * 1000;
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $push: {
                    pendingCollarborators: {
                        code: inviteCode,
                        expireIn,
                        user: collaboratorUser._id,
                    },
                },
            });
            const generated = formLinkService.generateInviteLink({ inviteCode, formId: testForm.id, role: Form_model_1.CollaboratorType.editor }, "/collaborator/confirm", 24);
            // Attempting to confirm with otherUser token instead of collaboratorUser
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/collaborator/confirm`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
                .send({ invite: generated.encryptedCode });
            expect(res.status).toBe(403);
            expect(res.body.message).toBe("This invitation is not for you");
        });
        test("status 200 confirms invite, adds user to editors, and removes from pending", async () => {
            const formLinkService = new FormLinkService_1.default();
            const inviteCode = "INVITE456";
            const expireIn = Date.now() + 24 * 60 * 60 * 1000;
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $push: {
                    pendingCollarborators: {
                        code: inviteCode,
                        expireIn,
                        user: collaboratorUser._id,
                    },
                },
            });
            const generated = formLinkService.generateInviteLink({ inviteCode, formId: testForm.id, role: Form_model_1.CollaboratorType.editor }, "/collaborator/confirm", 24);
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/collaborator/confirm`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`])
                .send({ invite: generated.encryptedCode });
            expect(res.status).toBe(200);
            expect(res.body.data.role).toBe(Form_model_1.CollaboratorType.editor);
            // Check DB: user is in editors and removed from pending
            const updatedForm = await Form_model_1.default.findById(testForm._id).lean();
            expect(updatedForm?.editors?.some((e) => e.toString() === collaboratorUser._id.toString())).toBe(true);
            expect(updatedForm?.pendingCollarborators?.some((p) => p.code === inviteCode)).toBe(false);
        });
    });
    describe("GET /v0/api/getformowners/:formId", () => {
        test("status 401 if unauthenticated", async () => {
            const res = await (0, supertest_1.default)(app_1.default).get(`${baseURL}/getformowners/${testForm.id}`);
            expect(res.status).toBe(401);
        });
        test("status 403 if non-collaborator tries to view owners", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getformowners/${testForm.id}`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`]);
            expect(res.status).toBe(403);
        });
        test("status 403 if editor tries to view owners", async () => {
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $addToSet: { editors: collaboratorUser._id },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getformowners/${testForm.id}`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`]);
            expect(res.status).toBe(403);
        });
        test("status 200 returns collaborators list for primary owner", async () => {
            // Add collaboratorUser as co-owner
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $addToSet: { owners: collaboratorUser._id },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getformowners/${testForm.id}`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`]);
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
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/removeformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${otherUserToken}`])
                .send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "remove",
            });
            expect(res.status).toBe(403);
        });
        test("status 200 creator removes an editor from form", async () => {
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $addToSet: { editors: collaboratorUser._id },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/removeformowner`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                email: collaboratorUser.email,
                role: Form_model_1.CollaboratorType.editor,
                action: "remove",
            });
            expect(res.status).toBe(200);
            const updatedForm = await Form_model_1.default.findById(testForm._id).lean();
            expect(updatedForm?.editors?.some((e) => e.toString() === collaboratorUser._id.toString())).toBe(false);
        });
    });
    describe("DELETE /v0/api/removeselfform/:formId", () => {
        test("status 400 if primary owner tries to remove themselves", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/removeselfform/${testForm.id}`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`]);
            expect(res.status).toBe(400);
            expect(res.body.message).toContain("Primary owner cannot remove themselves");
        });
        test("status 200 collaborator removes self from form", async () => {
            await Form_model_1.default.findByIdAndUpdate(testForm._id, {
                $addToSet: { editors: collaboratorUser._id },
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/removeselfform/${testForm.id}`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${collaboratorToken}`]);
            expect(res.status).toBe(200);
            const updatedForm = await Form_model_1.default.findById(testForm._id).lean();
            expect(updatedForm?.editors?.some((e) => e.toString() === collaboratorUser._id.toString())).toBe(false);
        });
    });
});
