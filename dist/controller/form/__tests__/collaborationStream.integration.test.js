"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = __importDefault(require("../../../app"));
const helper_integration_1 = require("./helper.integration");
const User_model_1 = __importDefault(require("../../../model/User.model"));
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const supertest_1 = __importDefault(require("supertest"));
const mockdata_1 = require("../../../utilities/mockdata");
/**
 * Opens the real SSE stream over HTTP and checks what a browser would receive.
 */
describe("Form collaboration stream (integration)", () => {
    let server;
    let port;
    let owner;
    let form;
    const openRequests = [];
    const tokenFor = (user) => jsonwebtoken_1.default.sign({ sub: user._id.toString(), role: user.role }, helper_integration_1.testEnv.JWT_SECRET, {
        expiresIn: "1h",
    });
    // Connects to the stream and resolves once `count` data messages arrived
    const openStream = (token, count) => new Promise((resolve, reject) => {
        const req = http_1.default.get({
            host: "127.0.0.1",
            port,
            path: `/v0/api/form/${form.id}/collab/stream`,
            headers: { Cookie: `${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${token}` },
        }, (res) => {
            const messages = [];
            let buffer = "";
            const done = () => resolve({ status: res.statusCode ?? 0, headers: res.headers, messages });
            if (res.statusCode !== 200)
                return done();
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                buffer += chunk;
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";
                for (const part of parts) {
                    if (part.startsWith("data: "))
                        messages.push(JSON.parse(part.slice(6)));
                }
                if (messages.length >= count)
                    done();
            });
        });
        req.on("error", reject);
        openRequests.push(req);
    });
    // Connects and keeps collecting messages; `waitFor` resolves when one matches
    const openLiveStream = (token) => new Promise((resolve, reject) => {
        const req = http_1.default.get({
            host: "127.0.0.1",
            port,
            path: `/v0/api/form/${form.id}/collab/stream`,
            headers: { Cookie: `${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${token}` },
        }, (res) => {
            const messages = [];
            let buffer = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                buffer += chunk;
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";
                for (const part of parts) {
                    if (part.startsWith("data: "))
                        messages.push(JSON.parse(part.slice(6)));
                }
            });
            const waitFor = async (match, ms = 3000) => {
                const deadline = Date.now() + ms;
                while (Date.now() < deadline) {
                    const found = messages.find(match);
                    if (found)
                        return found;
                    await new Promise((r) => setTimeout(r, 20));
                }
                return undefined;
            };
            resolve({ messages, waitFor });
        });
        req.on("error", reject);
        openRequests.push(req);
    });
    beforeAll(async () => {
        process.env = helper_integration_1.testEnv;
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
        server = app_1.default.listen(0);
        port = server.address().port;
    });
    beforeEach(async () => {
        process.env = helper_integration_1.testEnv;
        owner = await (0, helper_integration_1.createTestUser)({
            name: "Stream Owner",
            email: `stream_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        form = await (0, helper_integration_1.createTestForm)(owner._id, {});
    });
    afterEach(() => {
        openRequests.splice(0).forEach((req) => req.destroy());
    });
    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
        await User_model_1.default.deleteMany({});
        await Form_model_1.default.deleteMany({});
        await Content_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    test("streams the connection id and then who is present", async () => {
        const { status, headers, messages } = await openStream(tokenFor(owner), 2);
        expect(status).toBe(200);
        expect(headers["content-type"]).toContain("text/event-stream");
        expect(messages[0].type).toBe("connected");
        expect(typeof messages[0].connectionId).toBe("string");
        expect(messages[1]).toMatchObject({
            type: "state",
            users: [{ name: "Stream Owner", connectionId: messages[0].connectionId }],
            locks: [],
        });
    });
    test("a save is pushed live to the other editor but not echoed to the tab that saved", async () => {
        const editor = await (0, helper_integration_1.createTestUser)({
            name: "Stream Editor",
            email: `stream_ed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        await Form_model_1.default.updateOne({ _id: form._id }, { $push: { editors: editor._id } });
        const ownerStream = await openLiveStream(tokenFor(owner));
        const editorStream = await openLiveStream(tokenFor(editor));
        const ownerConn = (await ownerStream.waitFor((m) => m.type === "connected"))
            .connectionId;
        await editorStream.waitFor((m) => m.type === "connected");
        const res = await (0, supertest_1.default)(app_1.default)
            .put("/v0/api/savecontent")
            .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${tokenFor(owner)}`])
            .send({
            formId: form.id,
            page: 1,
            version: 0,
            connectionId: ownerConn,
            data: [
                mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    formId: form._id,
                    qIdx: 0,
                    score: 10,
                    page: 1,
                }),
            ],
        });
        expect(res.status).toBe(200);
        const pushed = await editorStream.waitFor((m) => m.type === "content");
        expect(pushed).toMatchObject({
            type: "content",
            page: 1,
            version: 1,
            by: { name: "Stream Owner" },
        });
        expect(pushed.data).toHaveLength(1);
        expect(pushed.data[0]._id).toBe(res.body.data[0]._id);
        // The saving tab already has the result from its own request
        expect(await ownerStream.waitFor((m) => m.type === "content", 300)).toBeUndefined();
    });
    test("refuses a signed-in user who is not a collaborator", async () => {
        const outsider = await (0, helper_integration_1.createTestUser)({
            name: "Outsider",
            email: `stream_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
        });
        const { status } = await openStream(tokenFor(outsider), 1);
        expect(status).toBe(403);
    });
});
