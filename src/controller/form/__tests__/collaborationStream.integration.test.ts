import http from "http";
import { AddressInfo } from "net";
import mongoose from "mongoose";
import JWT from "jsonwebtoken";
import app from "../../../app";
import { testEnv, createTestUser, createTestForm } from "./helper.integration";
import User, { UserType } from "../../../model/User.model";
import Form from "../../../model/Form.model";
import Content from "../../../model/Content.model";
import Request from "supertest";
import { MockContentFactory } from "../../../utilities/mockdata";

/**
 * Opens the real SSE stream over HTTP and checks what a browser would receive.
 */
describe("Form collaboration stream (integration)", () => {
  let server: http.Server;
  let port: number;
  let owner: UserType;
  let form: any;
  const openRequests: http.ClientRequest[] = [];

  const tokenFor = (user: UserType) =>
    JWT.sign({ sub: user._id.toString(), role: user.role }, testEnv.JWT_SECRET, {
      expiresIn: "1h",
    });

  // Connects to the stream and resolves once `count` data messages arrived
  const openStream = (token: string, count: number) =>
    new Promise<{ status: number; headers: http.IncomingHttpHeaders; messages: any[] }>(
      (resolve, reject) => {
        const req = http.get(
          {
            host: "127.0.0.1",
            port,
            path: `/v0/api/form/${form.id}/collab/stream`,
            headers: { Cookie: `${testEnv.ACCESS_TOKEN_COOKIE}=${token}` },
          },
          (res) => {
            const messages: any[] = [];
            let buffer = "";
            const done = () =>
              resolve({ status: res.statusCode ?? 0, headers: res.headers, messages });
            if (res.statusCode !== 200) return done();
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              buffer += chunk;
              const parts = buffer.split("\n\n");
              buffer = parts.pop() ?? "";
              for (const part of parts) {
                if (part.startsWith("data: ")) messages.push(JSON.parse(part.slice(6)));
              }
              if (messages.length >= count) done();
            });
          },
        );
        req.on("error", reject);
        openRequests.push(req);
      },
    );

  // Connects and keeps collecting messages; `waitFor` resolves when one matches
  const openLiveStream = (token: string) =>
    new Promise<{
      messages: any[];
      waitFor: (match: (m: any) => boolean, ms?: number) => Promise<any>;
    }>((resolve, reject) => {
      const req = http.get(
        {
          host: "127.0.0.1",
          port,
          path: `/v0/api/form/${form.id}/collab/stream`,
          headers: { Cookie: `${testEnv.ACCESS_TOKEN_COOKIE}=${token}` },
        },
        (res) => {
          const messages: any[] = [];
          let buffer = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            buffer += chunk;
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";
            for (const part of parts) {
              if (part.startsWith("data: ")) messages.push(JSON.parse(part.slice(6)));
            }
          });
          const waitFor = async (match: (m: any) => boolean, ms = 3000) => {
            const deadline = Date.now() + ms;
            while (Date.now() < deadline) {
              const found = messages.find(match);
              if (found) return found;
              await new Promise((r) => setTimeout(r, 20));
            }
            return undefined;
          };
          resolve({ messages, waitFor });
        },
      );
      req.on("error", reject);
      openRequests.push(req);
    });

  beforeAll(async () => {
    process.env = testEnv;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testEnv.DATABASE_URL);
    }
    server = app.listen(0);
    port = (server.address() as AddressInfo).port;
  });

  beforeEach(async () => {
    process.env = testEnv;
    owner = await createTestUser({
      name: "Stream Owner",
      email: `stream_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });
    form = await createTestForm(owner._id, {});
  });

  afterEach(() => {
    openRequests.splice(0).forEach((req) => req.destroy());
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await User.deleteMany({});
    await Form.deleteMany({});
    await Content.deleteMany({});
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
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
    const editor = await createTestUser({
      name: "Stream Editor",
      email: `stream_ed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });
    await Form.updateOne({ _id: form._id }, { $push: { editors: editor._id } });

    const ownerStream = await openLiveStream(tokenFor(owner));
    const editorStream = await openLiveStream(tokenFor(editor));
    const ownerConn = (await ownerStream.waitFor((m) => m.type === "connected"))
      .connectionId;
    await editorStream.waitFor((m) => m.type === "connected");

    const res = await Request(app)
      .put("/v0/api/savecontent")
      .set("Cookie", [`${testEnv.ACCESS_TOKEN_COOKIE}=${tokenFor(owner)}`])
      .send({
        formId: form.id,
        page: 1,
        version: 0,
        connectionId: ownerConn,
        data: [
          MockContentFactory.createMultipleChoiceContent({
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
    const outsider = await createTestUser({
      name: "Outsider",
      email: `stream_out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
    });

    const { status } = await openStream(tokenFor(outsider), 1);

    expect(status).toBe(403);
  });
});
