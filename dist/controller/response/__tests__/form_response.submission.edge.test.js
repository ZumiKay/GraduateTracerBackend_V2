"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const form_response_submission_controller_1 = __importDefault(require("../form_response.submission.controller"));
const form_response_scoring_controller_1 = __importDefault(require("../form_response.scoring.controller"));
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Formsession_model_1 = __importDefault(require("../../../model/Formsession.model"));
const RespondentTrackingService_1 = require("../../../services/RespondentTrackingService");
const ResponseProcessingService_1 = require("../../../services/ResponseProcessingService");
const ResponseValidationService_1 = require("../../../services/ResponseValidationService");
const notification_controller_1 = require("../../utils/notification.controller");
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../model/Form.model");
jest.mock("../../../model/Formsession.model");
jest.mock("../../../services/RespondentTrackingService");
jest.mock("../../../services/ResponseProcessingService");
jest.mock("../../../services/ResponseValidationService");
jest.mock("../../utils/notification.controller");
describe("Form Response Submission & Scoring Edge Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockClearCookie;
    const validFormId = new mongoose_1.Types.ObjectId().toString();
    const validQuestionId = new mongoose_1.Types.ObjectId().toString();
    const validResponseId = new mongoose_1.Types.ObjectId().toString();
    const validUserId = new mongoose_1.Types.ObjectId().toString();
    beforeEach(() => {
        jest.clearAllMocks();
        mockJson = jest.fn();
        mockClearCookie = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
            clearCookie: mockClearCookie,
        };
    });
    describe("SubmitFormResponse Validation Boundaries", () => {
        test("returns 400 when body is missing", async () => {
            mockReq = { params: { formId: validFormId }, body: undefined };
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Request body is required",
            }));
        });
        test("returns 400 when responseSet is empty or not an array", async () => {
            mockReq = {
                params: { formId: validFormId },
                body: { responseSet: [] },
            };
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                validationErrors: expect.arrayContaining([
                    "At least one response is required",
                ]),
            }));
        });
        test("returns 400 when response item is missing question ID or response answer", async () => {
            mockReq = {
                params: { formId: validFormId },
                body: {
                    responseSet: [
                        { question: "", response: "Some Answer" },
                        { question: validQuestionId, response: null },
                    ],
                },
            };
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                validationErrors: expect.arrayContaining([
                    "Response 1: Question ID is required",
                    "Response 2: Answer is required",
                ]),
            }));
        });
        test("returns 400 when respondentEmail format is invalid", async () => {
            mockReq = {
                params: { formId: validFormId },
                body: {
                    responseSet: [{ question: validQuestionId, response: "Answer A" }],
                    respondentEmail: "invalid-email-string",
                },
            };
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                validationErrors: expect.arrayContaining(["Invalid email format"]),
            }));
        });
        test("returns 404 if form does not exist", async () => {
            mockReq = {
                params: { formId: validFormId },
                body: {
                    responseSet: [{ question: validQuestionId, response: "Answer A" }],
                },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Form not found" }));
        });
    });
    describe("SubmitFormResponse Business Logic & Anti-Abuse", () => {
        test("rejects duplicate submission with 400 when respondent already responded", async () => {
            mockReq = {
                params: { formId: validFormId },
                body: {
                    responseSet: [{ question: validQuestionId, response: "Answer A" }],
                    respondentEmail: "student@example.com",
                },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: validFormId,
                        type: "normal",
                        title: "Tracer Survey",
                        setting: { acceptResponses: true },
                    }),
                }),
            });
            RespondentTrackingService_1.RespondentTrackingService.createSubmissionWithTracking.mockReturnValue({
                formId: new mongoose_1.Types.ObjectId(validFormId),
                responseset: [{ question: validQuestionId, response: "Answer A" }],
            });
            RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists.mockResolvedValue({
                hasResponded: true,
                responseId: "existing-resp-id",
            });
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Form already submitted" }));
        });
        test("successfully submits form, notifies owner, and cleans up session for submitonce forms", async () => {
            process.env.ACCESS_RESPONDENT_COOKIE = "access_resp_cookie";
            process.env.RESPONDENT_COOKIE = "refresh_resp_cookie";
            mockReq = {
                params: { formId: validFormId },
                body: {
                    responseSet: [{ question: validQuestionId, response: "Answer A" }],
                    respondentName: "Jane Doe",
                    respondentEmail: "jane@example.com",
                },
                formsession: { sub: "session-abc-123" },
            };
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        _id: validFormId,
                        type: "normal",
                        title: "Tracer Survey",
                        setting: { acceptResponses: true, submitonce: true },
                    }),
                }),
            });
            RespondentTrackingService_1.RespondentTrackingService.createSubmissionWithTracking.mockReturnValue({
                formId: new mongoose_1.Types.ObjectId(validFormId),
                responseset: [{ question: validQuestionId, response: "Answer A" }],
            });
            RespondentTrackingService_1.RespondentTrackingService.checkRespondentExists.mockResolvedValue({
                hasResponded: false,
            });
            ResponseProcessingService_1.ResponseProcessingService.processNormalFormSubmission.mockResolvedValue({
                responseId: validResponseId,
                completionStatus: "completed",
            });
            Formsession_model_1.default.deleteOne.mockResolvedValue({ acknowledged: true });
            notification_controller_1.NotificationController.NotifyNewResponse.mockResolvedValue([]);
            await form_response_submission_controller_1.default.SubmitFormResponse(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockClearCookie).toHaveBeenCalledWith("access_resp_cookie");
            expect(mockClearCookie).toHaveBeenCalledWith("refresh_resp_cookie");
            expect(Formsession_model_1.default.deleteOne).toHaveBeenCalledWith({ session_id: "session-abc-123" });
            expect(notification_controller_1.NotificationController.NotifyNewResponse).toHaveBeenCalledWith(validFormId, validResponseId, expect.objectContaining({ name: "Jane Doe", email: "jane@example.com" }));
        });
    });
    describe("UpdateResponseScore Edge Boundaries", () => {
        test("returns 400 if responseId is missing", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                body: { scores: [{ questionId: validQuestionId, score: 10 }] },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            await form_response_scoring_controller_1.default.UpdateResponseScore(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Response ID is required" }));
        });
        test("returns 400 if scores array is empty or missing", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                body: { responseId: validResponseId, scores: [] },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            await form_response_scoring_controller_1.default.UpdateResponseScore(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Scores array is required and must not be empty",
            }));
        });
        test("returns 400 if any score entry is missing questionId or score", async () => {
            mockReq = {
                user: { sub: validUserId, role: User_model_1.ROLE.USER },
                body: {
                    responseId: validResponseId,
                    scores: [{ questionId: "", score: 10 }],
                },
            };
            ResponseValidationService_1.ResponseValidationService.validateRequest.mockReturnValue({
                isValid: true,
                user: { sub: validUserId },
            });
            await form_response_scoring_controller_1.default.UpdateResponseScore(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Each score entry must have questionId and score",
            }));
        });
    });
});
