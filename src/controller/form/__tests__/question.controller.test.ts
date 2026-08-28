import request from "supertest";
import app from "../../../app";
import QuestionService from "../../../services/Question.Service";
import { Types } from "mongoose";

// Mock DB connection
jest.mock("../../../database", () => jest.fn());

// Mock authentication middleware
jest.mock("../../../middleware/User.middleware", () => ({
  __esModule: true,
  default: {
    VerifyToken: jest.fn((req: any, res: any, next: any) => next()),
    VerifyRefreshToken: jest.fn((req: any, res: any, next: any) => next()),
    RequireAdmin: jest.fn((req: any, res: any, next: any) => next()),
  },
}));

// Mock QuestionService methods
jest.mock("../../../services/Question.Service");

describe("QuestionController (Supertest Integration)", () => {
  const formId = new Types.ObjectId().toString();
  const qId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
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
