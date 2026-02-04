import { Types } from "mongoose";
import { ContentType, QuestionType } from "../../model/Content.model";
import { ResponseSetType, ScoringMethod } from "../../model/Response.model";
import { MockContentFactory } from "../../utilities/mockdata";
import { ResponseProcessingService } from "../ResponseProcessingService";
import Content from "../../model/Content.model";

//Mock models
jest.mock("../../model/Content.model");
jest.mock("../../model/Response.model");

const questionIds = {
  q1: new Types.ObjectId(),
  q2: new Types.ObjectId(),
  q3: new Types.ObjectId(),
  q4: new Types.ObjectId(),
  q5: new Types.ObjectId(),
  q6: new Types.ObjectId(),
  q7: new Types.ObjectId(),
  q8: new Types.ObjectId(),
  q999: new Types.ObjectId(),
};
//Mock Data Generators

describe("ResponseProcessingService - Adding Score Tests", () => {
  const formId = new Types.ObjectId();

  // Generate valid ObjectIds for questions

  const mockContentData: Array<ContentType> = [
    MockContentFactory.createMultipleChoiceContent({
      _id: questionIds.q1,
      formId,
      qIdx: 1,
      answer: {
        _id: new Types.ObjectId(),
        answer: [1],
      },
      score: 5,
    }),
    MockContentFactory.createCheckboxContent({
      _id: questionIds.q2,
      formId,
      checkbox: MockContentFactory.createChoiceOptions(10),
      qIdx: 2,
      answer: {
        _id: new Types.ObjectId(),
        answer: [1, 2, 3],
      },
      score: 10,
    }),
    MockContentFactory.createNumberContent({
      _id: questionIds.q3,
      formId,
      qIdx: 3,
      answer: {
        _id: new Types.ObjectId(),
        answer: 10,
      },
      score: 10,
    }),
  ];

  describe("addScore method", () => {
    test("should return empty response array when input is empty", async () => {
      const mockReturn: Array<ResponseSetType> = [];

      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.response).toEqual([]);
      expect(result.response.length).toBe(0);
    });

    test("should calculate scores for correct answers", async () => {
      const mockReturn: Array<ResponseSetType> = [
        { question: questionIds.q1, response: [1] },
        { question: questionIds.q2, response: [1, 2, 3] },
        { question: questionIds.q3, response: 10 },
      ];

      // Mock Content.find to return our mock data
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockContentData),
      });

      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.response).toHaveLength(3);
      expect(result.response[0].score).toBe(5);
      expect(result.response[0].scoringMethod).toBe(ScoringMethod.AUTO);
      expect(result.response[1].score).toBe(10);
      expect(result.response[2].score).toBe(10);
      expect(result.isNonScore).toBe(false);
    });

    test("should return 0 score for incorrect answers", async () => {
      const mockReturn: Array<ResponseSetType> = [
        { question: questionIds.q1, response: [2] }, // Wrong answer
        { question: questionIds.q2, response: [1, 2, 3, 4, 5, 6] }, // Partially wrong
        { question: questionIds.q3, response: 5 }, // Wrong number
      ];

      // Mock Content.find to return our mock data
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockContentData),
      });
      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.response).toHaveLength(3);
      expect(result.response[0].score).toBe(0);
      expect(result.response[1].score).toBe(5);
      expect(result.response[2].score).toBe(0);
    });

    test("should return isNonScore=true when all questions have no score", async () => {
      const noScoreContent: Array<ContentType> = [
        MockContentFactory.createShortAnswerContent({
          _id: questionIds.q4,
          formId,
          qIdx: 4,
          score: 0,
        }),
        MockContentFactory.createParagraphContent({
          _id: questionIds.q5,
          formId,
          qIdx: 5,
          score: 0,
        }),
      ];

      const mockReturn: Array<ResponseSetType> = [
        { question: questionIds.q4, response: "Some answer" },
        { question: questionIds.q5, response: "Long answer text" },
      ];

      // Mock Content.find to return our mock data
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(noScoreContent),
      });

      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.isNonScore).toBe(true);
      expect(result.response).toHaveLength(2);
    });

    test("should set scoringMethod to MANUAL for questions without answers", async () => {
      const manualScoreContent: Array<ContentType> = [
        MockContentFactory.createShortAnswerContent({
          _id: questionIds.q6,
          formId,
          qIdx: 6,
          score: 15,
          answer: undefined, // No answer key
        }),
      ];

      const mockReturn: Array<ResponseSetType> = [
        { question: questionIds.q6, response: "Student answer" },
      ];

      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(manualScoreContent),
      });

      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.response).toHaveLength(1);
      expect(result.response[0].score).toBe(undefined);
      expect(result.response[0].scoringMethod).toBe(ScoringMethod.MANUAL);
    });

    test("should handle mixed scoring methods", async () => {
      const mixedContent: Array<ContentType> = [
        MockContentFactory.createMultipleChoiceContent({
          _id: questionIds.q7,
          formId,
          qIdx: 7,
          answer: { _id: new Types.ObjectId(), answer: [1] },
          score: 10,
        }),
        MockContentFactory.createShortAnswerContent({
          _id: questionIds.q8,
          formId,
          qIdx: 8,
          score: 5,
          answer: undefined,
        }),
      ];

      const mockReturn: Array<ResponseSetType> = [
        { question: questionIds.q7, response: [1] },
        { question: questionIds.q8, response: "Answer" },
      ];

      // Mock Content.find to return our mock data
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mixedContent),
      });

      const result = await ResponseProcessingService.addScore(mockReturn);

      expect(result.response).toHaveLength(2);
      expect(result.response[0].scoringMethod).toBe(ScoringMethod.AUTO);
      expect(result.response[0].score).toBe(10);
      expect(result.response[1].scoringMethod).toBe(ScoringMethod.MANUAL);
      expect(result.response[1].score).toBe(undefined);
      expect(result.isNonScore).toBe(false);
    });
  });
});
