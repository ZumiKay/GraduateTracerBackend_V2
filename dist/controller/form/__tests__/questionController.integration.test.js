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
const mongoose_1 = __importStar(require("mongoose"));
const app_1 = __importDefault(require("../../../app"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helper_integration_1 = require("./helper.integration");
const User_model_1 = __importDefault(require("../../../model/User.model"));
const Form_model_1 = __importStar(require("../../../model/Form.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const mockdata_1 = require("../../../utilities/mockdata");
describe("Question Controller Integration Tests", () => {
    const baseURL = "/v0/api";
    let formOwner;
    let testForm;
    let ownerToken;
    beforeAll(async () => {
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
    });
    beforeEach(async () => {
        process.env = helper_integration_1.testEnv;
        formOwner = await (0, helper_integration_1.createTestUser)({
            name: "Form Author",
            email: `author_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        testForm = await (0, helper_integration_1.createTestForm)(formOwner._id, {
            type: Form_model_1.TypeForm.Quiz,
            totalscore: 0,
        });
        ownerToken = jsonwebtoken_1.default.sign({ sub: formOwner._id.toString(), role: formOwner.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
    });
    afterAll(async () => {
        await User_model_1.default.deleteMany({});
        await Form_model_1.default.deleteMany({});
        await Content_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    describe("POST /v0/api/savequestion", () => {
        test("status 401 if missing access token cookie", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/savequestion`)
                .send({
                formId: testForm.id,
                page: 1,
                data: [],
            });
            expect(res.status).toBe(401);
        });
        test("status 400 if ConditionQuestionValidator detects invalid condition question type", async () => {
            const invalidQuestion = mockdata_1.MockContentFactory.createTextContent({
                formId: testForm._id,
                conditional: [
                    {
                        _id: new mongoose_1.Types.ObjectId(),
                        key: 0,
                        contentId: new mongoose_1.Types.ObjectId(),
                    },
                ],
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/savequestion`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                page: 1,
                data: [invalidQuestion],
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toContain("Condition questions are only allowed for checkbox and multiple choice");
        });
        test("status 200 saves questions, persists in DB, and recalculates form totalscore", async () => {
            const q1 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId: testForm._id,
                qIdx: 0,
                score: 10,
                page: 1,
            });
            const q2 = mockdata_1.MockContentFactory.createCheckboxContent({
                formId: testForm._id,
                qIdx: 1,
                score: 15,
                page: 1,
            });
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/savequestion`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                formId: testForm.id,
                page: 1,
                data: [q1, q2],
            });
            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            // Check DB persistence
            const savedContents = await Content_model_1.default.find({ formId: testForm._id }).lean();
            expect(savedContents.length).toBe(2);
            // Check Form totalscore recalculation
            const updatedForm = await Form_model_1.default.findById(testForm._id).lean();
            expect(updatedForm?.totalscore).toBe(25);
        });
        test("status 200 with 'No changes detected' when no modifications are sent", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post(`${baseURL}/savequestion`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
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
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/deletecontent`)
                .send({ id: new mongoose_1.Types.ObjectId().toString(), formId: testForm.id });
            expect(res.status).toBe(401);
        });
        test("status 400 if missing id or formId", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/deletecontent`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({ formId: testForm.id });
            expect(res.status).toBe(400);
        });
        test("status 200 deletes question from DB and updates form score", async () => {
            const [savedQ] = await Content_model_1.default.create([
                mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    formId: testForm._id,
                    score: 15,
                }),
            ]);
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`${baseURL}/deletecontent`)
                .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                .send({
                id: savedQ._id.toString(),
                formId: testForm.id,
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Question Deleted");
            const inDb = await Content_model_1.default.findById(savedQ._id);
            expect(inDb).toBeNull();
        });
    });
});
