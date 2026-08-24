"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../app"));
const Question_Service_1 = __importDefault(require("../../../services/Question.Service"));
const mongoose_1 = require("mongoose");
// Mock DB connection
jest.mock("../../../database", () => jest.fn());
// Mock authentication middleware
jest.mock("../../../middleware/User.middleware", () => ({
    __esModule: true,
    default: {
        VerifyToken: jest.fn((req, res, next) => next()),
        VerifyRefreshToken: jest.fn((req, res, next) => next()),
        RequireAdmin: jest.fn((req, res, next) => next()),
    },
}));
// Mock QuestionService methods
jest.mock("../../../services/Question.Service");
describe("QuestionController (Supertest Integration)", () => {
    const formId = new mongoose_1.Types.ObjectId().toString();
    const qId = new mongoose_1.Types.ObjectId().toString();
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
            Question_Service_1.default.saveQuestion.mockResolvedValue({
                success: true,
                statusCode: 200,
                message: "Saved Completed",
                data: mockSavedData,
            });
            const response = await (0, supertest_1.default)(app_1.default)
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
            expect(Question_Service_1.default.saveQuestion).toHaveBeenCalledTimes(1);
        });
        test("returns 200 with 'No changes detected' when no modifications exist", async () => {
            Question_Service_1.default.saveQuestion.mockResolvedValue({
                success: true,
                noChanges: true,
                statusCode: 200,
                message: "No changes detected",
            });
            const response = await (0, supertest_1.default)(app_1.default).post("/v0/api/savequestion").send({
                formId,
                page: 1,
                data: [],
            });
            expect(response.status).toBe(200);
            expect(response.body.message).toBe("No changes detected");
        });
        test("returns 400 when service validation fails", async () => {
            Question_Service_1.default.saveQuestion.mockResolvedValue({
                success: false,
                statusCode: 400,
                message: "Score Validation Error",
            });
            const response = await (0, supertest_1.default)(app_1.default).post("/v0/api/savequestion").send({
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
            Question_Service_1.default.deleteQuestion.mockResolvedValue({
                success: true,
                statusCode: 200,
                message: "Question Deleted",
            });
            const response = await (0, supertest_1.default)(app_1.default)
                .delete("/v0/api/deletecontent")
                .send({ id: qId, formId });
            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Question Deleted");
            expect(Question_Service_1.default.deleteQuestion).toHaveBeenCalledWith(qId, formId);
        });
        test("returns 400 when content is not found", async () => {
            Question_Service_1.default.deleteQuestion.mockResolvedValue({
                success: false,
                statusCode: 400,
                message: "Content not found",
            });
            const response = await (0, supertest_1.default)(app_1.default)
                .delete("/v0/api/deletecontent")
                .send({ id: "invalid-id", formId });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Content not found");
        });
    });
});
