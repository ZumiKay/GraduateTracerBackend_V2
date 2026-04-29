"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Response_model_1 = require("../../model/Response.model");
const mockdata_1 = require("../../utilities/mockdata");
const ResponseProcessingService_1 = require("../ResponseProcessingService");
const Content_model_1 = __importDefault(require("../../model/Content.model"));
//Mock models
jest.mock("../../model/Content.model");
jest.mock("../../model/Response.model");
const questionIds = {
    q1: new mongoose_1.Types.ObjectId(),
    q2: new mongoose_1.Types.ObjectId(),
    q3: new mongoose_1.Types.ObjectId(),
    q4: new mongoose_1.Types.ObjectId(),
    q5: new mongoose_1.Types.ObjectId(),
    q6: new mongoose_1.Types.ObjectId(),
    q7: new mongoose_1.Types.ObjectId(),
    q8: new mongoose_1.Types.ObjectId(),
    q999: new mongoose_1.Types.ObjectId(),
};
//Mock Data Generators
describe("ResponseProcessingService - Adding Score Tests", () => {
    const formId = new mongoose_1.Types.ObjectId();
    // Generate valid ObjectIds for questions
    const mockContentData = [
        mockdata_1.MockContentFactory.createMultipleChoiceContent({
            _id: questionIds.q1,
            formId,
            qIdx: 1,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [1],
            },
            score: 5,
        }),
        mockdata_1.MockContentFactory.createCheckboxContent({
            _id: questionIds.q2,
            formId,
            checkbox: mockdata_1.MockContentFactory.createChoiceOptions(10),
            qIdx: 2,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: [1, 2, 3],
            },
            score: 10,
        }),
        mockdata_1.MockContentFactory.createNumberContent({
            _id: questionIds.q3,
            formId,
            qIdx: 3,
            answer: {
                _id: new mongoose_1.Types.ObjectId(),
                answer: 10,
            },
            score: 10,
        }),
    ];
    describe("addScore method", () => {
        test("should return empty response array when input is empty", () => __awaiter(void 0, void 0, void 0, function* () {
            const mockReturn = [];
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.response).toEqual([]);
            expect(result.response.length).toBe(0);
        }));
        test("should calculate scores for correct answers", () => __awaiter(void 0, void 0, void 0, function* () {
            const mockReturn = [
                { question: questionIds.q1, response: [1] },
                { question: questionIds.q2, response: [1, 2, 3] },
                { question: questionIds.q3, response: 10 },
            ];
            // Mock Content.find to return our mock data
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockContentData),
            });
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.response).toHaveLength(3);
            expect(result.response[0].score).toBe(5);
            expect(result.response[0].scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            expect(result.response[1].score).toBe(10);
            expect(result.response[2].score).toBe(10);
            expect(result.isNonScore).toBe(false);
        }));
        test("should return 0 score for incorrect answers", () => __awaiter(void 0, void 0, void 0, function* () {
            const mockReturn = [
                { question: questionIds.q1, response: [2] }, // Wrong answer
                { question: questionIds.q2, response: [1, 2, 3, 4, 5, 6] }, // Partially wrong
                { question: questionIds.q3, response: 5 }, // Wrong number
            ];
            // Mock Content.find to return our mock data
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockContentData),
            });
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.response).toHaveLength(3);
            expect(result.response[0].score).toBe(0);
            expect(result.response[1].score).toBe(5);
            expect(result.response[2].score).toBe(0);
        }));
        test("should return isNonScore=true when all questions have no score", () => __awaiter(void 0, void 0, void 0, function* () {
            const noScoreContent = [
                mockdata_1.MockContentFactory.createShortAnswerContent({
                    _id: questionIds.q4,
                    formId,
                    qIdx: 4,
                    score: 0,
                }),
                mockdata_1.MockContentFactory.createParagraphContent({
                    _id: questionIds.q5,
                    formId,
                    qIdx: 5,
                    score: 0,
                }),
            ];
            const mockReturn = [
                { question: questionIds.q4, response: "Some answer" },
                { question: questionIds.q5, response: "Long answer text" },
            ];
            // Mock Content.find to return our mock data
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(noScoreContent),
            });
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.isNonScore).toBe(true);
            expect(result.response).toHaveLength(2);
        }));
        test("should set scoringMethod to MANUAL for questions without answers", () => __awaiter(void 0, void 0, void 0, function* () {
            const manualScoreContent = [
                mockdata_1.MockContentFactory.createShortAnswerContent({
                    _id: questionIds.q6,
                    formId,
                    qIdx: 6,
                    score: 15,
                    answer: undefined, // No answer key
                }),
            ];
            const mockReturn = [
                { question: questionIds.q6, response: "Student answer" },
            ];
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(manualScoreContent),
            });
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.response).toHaveLength(1);
            expect(result.response[0].score).toBe(undefined);
            expect(result.response[0].scoringMethod).toBe(Response_model_1.ScoringMethod.MANUAL);
        }));
        test("should handle mixed scoring methods", () => __awaiter(void 0, void 0, void 0, function* () {
            const mixedContent = [
                mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: questionIds.q7,
                    formId,
                    qIdx: 7,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: [1] },
                    score: 10,
                }),
                mockdata_1.MockContentFactory.createShortAnswerContent({
                    _id: questionIds.q8,
                    formId,
                    qIdx: 8,
                    score: 5,
                    answer: undefined,
                }),
            ];
            const mockReturn = [
                { question: questionIds.q7, response: [1] },
                { question: questionIds.q8, response: "Answer" },
            ];
            // Mock Content.find to return our mock data
            Content_model_1.default.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mixedContent),
            });
            const result = yield ResponseProcessingService_1.ResponseProcessingService.addScore(mockReturn);
            expect(result.response).toHaveLength(2);
            expect(result.response[0].scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            expect(result.response[0].score).toBe(10);
            expect(result.response[1].scoringMethod).toBe(Response_model_1.ScoringMethod.MANUAL);
            expect(result.response[1].score).toBe(undefined);
            expect(result.isNonScore).toBe(false);
        }));
    });
});
