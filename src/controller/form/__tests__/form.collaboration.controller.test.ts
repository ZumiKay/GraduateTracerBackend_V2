import request from "supertest";
import { Types } from "mongoose";
import app from "../../../app";
import Form from "../../../model/Form.model";
import { formCollaboration } from "../../../services/FormCollaborationService";

const mockUserId = new Types.ObjectId().toString();

jest.mock("../../../database", () => jest.fn());

jest.mock("../../../middleware/User.middleware", () => ({
  __esModule: true,
  default: {
    VerifyToken: jest.fn((req: any, res: any, next: any) => {
      req.user = { sub: req.headers["x-test-user"] ?? mockUserId };
      next();
    }),
    VerifyRefreshToken: jest.fn((req: any, res: any, next: any) => next()),
    RequireAdmin: jest.fn((req: any, res: any, next: any) => next()),
  },
}));

describe("Form collaboration lock endpoints", () => {
  const formId = new Types.ObjectId().toString();
  const otherUserId = new Types.ObjectId().toString();
  const base = `/v0/api/form/${formId}/collab`;
  const stream = () => ({ write: jest.fn() });
  let connections: string[] = [];

  const mockFormLookup = (form: unknown) => {
    jest.spyOn(Form, "findById").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(form),
      }),
    } as never);
  };

  const connect = (userId: string, name: string) => {
    const id = formCollaboration.addClient(formId, { userId, name }, stream());
    connections.push(id);
    return id;
  };

  beforeEach(() => {
    // Both test users may edit the form
    mockFormLookup({
      _id: new Types.ObjectId(formId),
      user: new Types.ObjectId(mockUserId),
      owners: [],
      editors: [new Types.ObjectId(otherUserId)],
    });
  });

  afterEach(() => {
    connections.forEach((id) => formCollaboration.removeClient(formId, id));
    connections = [];
    jest.restoreAllMocks();
  });

  test("locks a question, blocks a second editor with 409, and frees it on unlock", async () => {
    const mine = connect(mockUserId, "Me");
    const theirs = connect(otherUserId, "Alex");

    const first = await request(app)
      .post(`${base}/lock`)
      .send({ connectionId: mine, questionId: "q1" });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ questionId: "q1", name: "Me" });

    const blocked = await request(app)
      .post(`${base}/lock`)
      .set("x-test-user", otherUserId)
      .send({ connectionId: theirs, questionId: "q1" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.data.name).toBe("Me");

    const unlock = await request(app)
      .post(`${base}/unlock`)
      .send({ connectionId: mine, questionId: "q1" });
    expect(unlock.status).toBe(200);

    const retry = await request(app)
      .post(`${base}/lock`)
      .set("x-test-user", otherUserId)
      .send({ connectionId: theirs, questionId: "q1" });
    expect(retry.status).toBe(200);
  });

  test("403 when using a connection that belongs to someone else", async () => {
    const theirs = connect(otherUserId, "Alex");

    const lock = await request(app)
      .post(`${base}/lock`)
      .send({ connectionId: theirs, questionId: "q1" });
    const unlock = await request(app)
      .post(`${base}/unlock`)
      .send({ connectionId: theirs, questionId: "q1" });

    expect(lock.status).toBe(403);
    expect(unlock.status).toBe(403);
    expect(formCollaboration.getState(formId).locks).toHaveLength(0);
  });

  test("403 for a user without access to the form", async () => {
    const outsider = new Types.ObjectId().toString();
    const conn = connect(outsider, "Mallory");

    const res = await request(app)
      .post(`${base}/lock`)
      .set("x-test-user", outsider)
      .send({ connectionId: conn, questionId: "q1" });

    expect(res.status).toBe(403);
    expect(formCollaboration.getState(formId).locks).toHaveLength(0);
  });

  test("400 for a malformed body", async () => {
    const res = await request(app).post(`${base}/lock`).send({ questionId: 5 });

    expect(res.status).toBe(400);
  });

  test("stream endpoint refuses users without access before opening a stream", async () => {
    mockFormLookup({
      _id: new Types.ObjectId(formId),
      user: new Types.ObjectId(),
      owners: [],
      editors: [],
    });

    const res = await request(app).get(`${base}/stream`);

    expect(res.status).toBe(403);
    expect(formCollaboration.getState(formId).users).toHaveLength(0);
  });
});
