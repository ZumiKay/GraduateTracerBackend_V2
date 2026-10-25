"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = require("mongoose");
const app_1 = __importDefault(require("../../../app"));
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const FormCollaborationService_1 = require("../../../services/FormCollaborationService");
const mockUserId = new mongoose_1.Types.ObjectId().toString();
jest.mock("../../../database", () => jest.fn());
jest.mock("../../../middleware/User.middleware", () => ({
    __esModule: true,
    default: {
        VerifyToken: jest.fn((req, res, next) => {
            req.user = { sub: req.headers["x-test-user"] ?? mockUserId };
            next();
        }),
        VerifyRefreshToken: jest.fn((req, res, next) => next()),
        RequireAdmin: jest.fn((req, res, next) => next()),
    },
}));
describe("Form collaboration lock endpoints", () => {
    const formId = new mongoose_1.Types.ObjectId().toString();
    const otherUserId = new mongoose_1.Types.ObjectId().toString();
    const base = `/v0/api/form/${formId}/collab`;
    const stream = () => ({ write: jest.fn() });
    let connections = [];
    const mockFormLookup = (form) => {
        jest.spyOn(Form_model_1.default, "findById").mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(form),
            }),
        });
    };
    const connect = (userId, name) => {
        const id = FormCollaborationService_1.formCollaboration.addClient(formId, { userId, name }, stream());
        connections.push(id);
        return id;
    };
    beforeEach(() => {
        // Both test users may edit the form
        mockFormLookup({
            _id: new mongoose_1.Types.ObjectId(formId),
            user: new mongoose_1.Types.ObjectId(mockUserId),
            owners: [],
            editors: [new mongoose_1.Types.ObjectId(otherUserId)],
        });
    });
    afterEach(() => {
        connections.forEach((id) => FormCollaborationService_1.formCollaboration.removeClient(formId, id));
        connections = [];
        jest.restoreAllMocks();
    });
    test("locks a question, blocks a second editor with 409, and frees it on unlock", async () => {
        const mine = connect(mockUserId, "Me");
        const theirs = connect(otherUserId, "Alex");
        const first = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/lock`)
            .send({ connectionId: mine, questionId: "q1" });
        expect(first.status).toBe(200);
        expect(first.body.data).toMatchObject({ questionId: "q1", name: "Me" });
        const blocked = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/lock`)
            .set("x-test-user", otherUserId)
            .send({ connectionId: theirs, questionId: "q1" });
        expect(blocked.status).toBe(409);
        expect(blocked.body.data.name).toBe("Me");
        const unlock = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/unlock`)
            .send({ connectionId: mine, questionId: "q1" });
        expect(unlock.status).toBe(200);
        const retry = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/lock`)
            .set("x-test-user", otherUserId)
            .send({ connectionId: theirs, questionId: "q1" });
        expect(retry.status).toBe(200);
    });
    test("403 when using a connection that belongs to someone else", async () => {
        const theirs = connect(otherUserId, "Alex");
        const lock = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/lock`)
            .send({ connectionId: theirs, questionId: "q1" });
        const unlock = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/unlock`)
            .send({ connectionId: theirs, questionId: "q1" });
        expect(lock.status).toBe(403);
        expect(unlock.status).toBe(403);
        expect(FormCollaborationService_1.formCollaboration.getState(formId).locks).toHaveLength(0);
    });
    test("403 for a user without access to the form", async () => {
        const outsider = new mongoose_1.Types.ObjectId().toString();
        const conn = connect(outsider, "Mallory");
        const res = await (0, supertest_1.default)(app_1.default)
            .post(`${base}/lock`)
            .set("x-test-user", outsider)
            .send({ connectionId: conn, questionId: "q1" });
        expect(res.status).toBe(403);
        expect(FormCollaborationService_1.formCollaboration.getState(formId).locks).toHaveLength(0);
    });
    test("400 for a malformed body", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post(`${base}/lock`).send({ questionId: 5 });
        expect(res.status).toBe(400);
    });
    test("stream endpoint refuses users without access before opening a stream", async () => {
        mockFormLookup({
            _id: new mongoose_1.Types.ObjectId(formId),
            user: new mongoose_1.Types.ObjectId(),
            owners: [],
            editors: [],
        });
        const res = await (0, supertest_1.default)(app_1.default).get(`${base}/stream`);
        expect(res.status).toBe(403);
        expect(FormCollaborationService_1.formCollaboration.getState(formId).users).toHaveLength(0);
    });
});
