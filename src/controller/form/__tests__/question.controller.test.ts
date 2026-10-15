import request from "supertest";
import app from "../../../app";
import QuestionService from "../../../services/Question.Service";
import Form from "../../../model/Form.model";
import { formCollaboration } from "../../../services/FormCollaborationService";
import { Types } from "mongoose";

const mockUserId = new Types.ObjectId().toString();

// Mock DB connection
jest.mock("../../../database", () => jest.fn());

// Mock authentication middleware
jest.mock("../../../middleware/User.middleware", () => ({
  __esModule: true,
  default: {
    VerifyToken: jest.fn((req: any, res: any, next: any) => {
      // "anonymous" header simulates a request that reached the handler without a user
      if (!req.headers["x-test-anonymous"]) {
        req.user = { sub: req.headers["x-test-user"] ?? mockUserId };
      }
      next();
    }),
    VerifyRefreshToken: jest.fn((req: any, res: any, next: any) => next()),
    RequireAdmin: jest.fn((req: any, res: any, next: any) => next()),
  },
}));

// Mock QuestionService methods
jest.mock("../../../services/Question.Service");

describe("QuestionController (Supertest Integration)", () => {
  const formId = new Types.ObjectId().toString();
  const qId = new Types.ObjectId().toString();

  // The form lookup used by the access check; by default the caller owns the form
  const mockFormLookup = (form: unknown) => {
    jest.spyOn(Form, "findById").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(form),
      }),
    } as never);
  };
  const ownedForm = () => ({
    _id: new Types.ObjectId(formId),
    user: new Types.ObjectId(mockUserId),
    owners: [],
    editors: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFormLookup(ownedForm());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Form access", () => {
    const savePayload = { formId, page: 1, data: [] };

    test("403 when the user is not an owner or editor of the form", async () => {
      mockFormLookup({ ...ownedForm(), user: new Types.ObjectId() });

      const save = await request(app).put("/v0/api/savecontent").send(savePayload);
      const del = await request(app)
        .delete("/v0/api/deletecontent")
        .send({ id: qId, formId });

      expect(save.status).toBe(403);
      expect(del.status).toBe(403);
      expect(QuestionService.saveQuestion).not.toHaveBeenCalled();
      expect(QuestionService.deleteQuestion).not.toHaveBeenCalled();
    });

    test("allows an editor of the form", async () => {
      mockFormLookup({
        ...ownedForm(),
        user: new Types.ObjectId(),
        editors: [new Types.ObjectId(mockUserId)],
      });
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
        version: 2,
      });

      const res = await request(app).put("/v0/api/savecontent").send(savePayload);

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(2);
    });

    test("a successful save is pushed to the other open editors, a no-change save is not", async () => {
      const broadcast = jest
        .spyOn(formCollaboration, "broadcastContent")
        .mockImplementation(() => {});
      const saved = [{ _id: qId, formId }];
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: true,
        data: saved,
        version: 3,
      });

      await request(app)
        .put("/v0/api/savecontent")
        .send({ ...savePayload, connectionId: "conn-1" });

      expect(broadcast).toHaveBeenCalledWith(
        formId,
        { page: 1, version: 3, data: saved },
        { userId: mockUserId, connectionId: "conn-1" },
      );

      broadcast.mockClear();
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: true,
        noChanges: true,
        version: 3,
      });
      await request(app).put("/v0/api/savecontent").send(savePayload);

      expect(broadcast).not.toHaveBeenCalled();
    });

    test("404 when the form does not exist", async () => {
      mockFormLookup(null);

      const res = await request(app).put("/v0/api/savecontent").send(savePayload);

      expect(res.status).toBe(404);
      expect(QuestionService.saveQuestion).not.toHaveBeenCalled();
    });

    test("400 when formId is missing or malformed", async () => {
      const res = await request(app)
        .put("/v0/api/savecontent")
        .send({ ...savePayload, formId: "not-an-id" });

      expect(res.status).toBe(400);
      expect(QuestionService.saveQuestion).not.toHaveBeenCalled();
    });

    test("401 when no user is attached to the request", async () => {
      const res = await request(app)
        .put("/v0/api/savecontent")
        .set("x-test-anonymous", "1")
        .send(savePayload);

      expect(res.status).toBe(401);
      expect(QuestionService.saveQuestion).not.toHaveBeenCalled();
    });

    test("409 returns the latest page and version when the client's copy is stale", async () => {
      const latest = [{ _id: qId, formId }];
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: false,
        statusCode: 409,
        message: "This page was changed by someone else",
        conflict: { version: 5, data: latest },
      });

      const res = await request(app)
        .put("/v0/api/savecontent")
        .send({ ...savePayload, version: 4 });

      expect(res.status).toBe(409);
      expect(res.body.data).toEqual({ version: 5, data: latest });
    });
  });

  describe("POST /v0/api/savequestion", () => {
    test("returns 200 with saved content when payload is valid", async () => {
      const mockSavedData = [
        {
          _id: qId,
          formId,
          text: "Sample Question",
          score: 10,
        },
      ];

      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: true,
        statusCode: 200,
        message: "Saved Completed",
        data: mockSavedData,
      });

      const response = await request(app)
        .post("/v0/api/savequestion")
        .send({
          formId,
          page: 1,
          data: mockSavedData,
        })
        .set("Accept", "application/json");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Saved Completed");
      expect(response.body.data).toEqual(mockSavedData);
      expect(QuestionService.saveQuestion).toHaveBeenCalledTimes(1);
    });

    test("returns 200 with 'No changes detected' when no modifications exist", async () => {
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: true,
        noChanges: true,
        statusCode: 200,
        message: "No changes detected",
      });

      const response = await request(app).post("/v0/api/savequestion").send({
        formId,
        page: 1,
        data: [],
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("No changes detected");
    });

    test("returns 400 when service validation fails", async () => {
      (QuestionService.saveQuestion as jest.Mock).mockResolvedValue({
        success: false,
        statusCode: 400,
        message: "Score Validation Error",
      });

      const response = await request(app).post("/v0/api/savequestion").send({
        formId,
        page: 1,
        data: [],
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Score Validation Error");
    });
  });

  describe("DELETE /v0/api/deletecontent", () => {
    test("returns 200 when question is deleted successfully", async () => {
      (QuestionService.deleteQuestion as jest.Mock).mockResolvedValue({
        success: true,
        statusCode: 200,
        message: "Question Deleted",
      });

      const response = await request(app)
        .delete("/v0/api/deletecontent")
        .send({ id: qId, formId });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Question Deleted");
      expect(QuestionService.deleteQuestion).toHaveBeenCalledWith(qId, formId);
    });

    test("returns 400 when content is not found", async () => {
      (QuestionService.deleteQuestion as jest.Mock).mockResolvedValue({
        success: false,
        statusCode: 400,
        message: "Content not found",
      });

      const response = await request(app)
        .delete("/v0/api/deletecontent")
        .send({ id: "invalid-id", formId });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Content not found");
    });
  });
});
