import { Types } from "mongoose";
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import FormResponseController from "../../controller/form_response.controller";
import { ResponseSetType } from "../../model/Response.model";
import { ContentType, QuestionType } from "../../model/Content.model";
import Content from "../../model/Content.model";
import SolutionValidationService from "../../services/SolutionValidationService";
import { MockContentFactory } from "../mockdata";

// Mock dependencies
jest.mock("../../model/Content.model");
jest.mock("../../services/SolutionValidationService");

const mockContent = Content as jest.Mocked<typeof Content>;
const mockSolutionValidationService = SolutionValidationService as jest.Mocked<
  typeof SolutionValidationService
>;

describe("Test Scoring System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //Test MultpleChoice
  const [formId, parenId] = [
    MockContentFactory.createFormId(),
    new Types.ObjectId().toString(),
  ];
  const mockChoices = MockContentFactory.createChoiceOptions(2);
  const mockChildQuestion = [
    MockContentFactory.createParagraphContent({
      score: 10,
      parentcontent: {
        qId: parenId,
        qIdx: 1,
        optIdx: 0,
      },
    }),
    MockContentFactory.createShortAnswerContent({
      score: 10,
      parentcontent: {
        qId: parenId,
        qIdx: 1,
        optIdx: 1,
      },
    }),
  ];

  const mockMultpleQuestionWithCondition =
    MockContentFactory.createMultipleChoiceContent({
      multiple: mockChoices,
      conditional: mockChildQuestion.map(
        (i, idx) =>
          ({
            key: idx,
            contentId: i._id,
          } as never)
      ),
    });

  describe("AddScore Function Tests", () => {
    describe("Basic Scoring Tests", () => {
      it("should return score 0 when content has no answer", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createTextContent(),
          response: "Some answer",
        };

        const mockContentData = {
          _id: questionId,
          score: 10,
          type: QuestionType.Text,
          answer: null, // No answer
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(0);
        expect(result.questionId).toBe(questionId);
      });

      it("should return score 0 when content has no score", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createTextContent(),
          response: "Some answer",
        };

        const mockContentData = {
          _id: questionId,
          score: null, // No score
          type: QuestionType.Text,
          answer: { answer: "correct answer" },
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(0);
      });

      it("should calculate score for simple question without conditionals", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [0, 1],
        };

        const mockContentData = {
          _id: questionId,
          score: 10,
          type: QuestionType.MultipleChoice,
          answer: { answer: [0, 1] },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(
          10
        );

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith([0, 1], [0, 1], QuestionType.MultipleChoice, 10);
        expect(result.score).toBe(10);
      });
    });

    describe("Conditional Scoring Tests", () => {
      it("should calculate score for conditional question with child questions", async () => {
        const questionId = new Types.ObjectId();
        const childId1 = new Types.ObjectId();
        const childId2 = new Types.ObjectId();

        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [0],
        };

        const mockContentData = {
          _id: questionId,
          score: 25,
          type: QuestionType.MultipleChoice,
          answer: { answer: [0] },
          conditional: [
            { contentId: childId1, key: 0 },
            { contentId: childId2, key: 1 },
          ],
        };

        const mockChildQuestions = [
          { _id: childId1, score: 10 },
          { _id: childId2, score: 5 },
        ];

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockContent.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockChildQuestions as never),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(
          10
        );

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        // Child scores: 10 + 5 = 15
        // Question score calculation: Math.max(0, 15 - 25) = 0
        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith([0], [0], QuestionType.MultipleChoice, 0);
        expect(result.score).toBe(10);
      });

      it("should handle conditional question with higher child scores", async () => {
        const questionId = new Types.ObjectId();
        const childId1 = new Types.ObjectId();
        const childId2 = new Types.ObjectId();

        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [1],
        };

        const mockContentData = {
          _id: questionId,
          score: 10,
          type: QuestionType.MultipleChoice,
          answer: { answer: [1] },
          conditional: [
            { contentId: childId1, key: 0 },
            { contentId: childId2, key: 1 },
          ],
        };

        const mockChildQuestions = [
          { _id: childId1, score: 15 },
          { _id: childId2, score: 20 },
        ];

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockContent.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockChildQuestions as never),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(8);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        // Child scores: 15 + 20 = 35
        // Question score calculation: Math.max(0, 35 - 10) = 25
        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith([1], [1], QuestionType.MultipleChoice, 25);
        expect(result.score).toBe(8);
      });

      it("should handle conditional question with some child scores being null", async () => {
        const questionId = new Types.ObjectId();
        const childId1 = new Types.ObjectId();
        const childId2 = new Types.ObjectId();

        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [0],
        };

        const mockContentData = {
          _id: questionId,
          score: 20,
          type: QuestionType.MultipleChoice,
          answer: { answer: [0] },
          conditional: [
            { contentId: childId1, key: 0 },
            { contentId: childId2, key: 1 },
          ],
        };

        const mockChildQuestions = [
          { _id: childId1, score: 10 },
          { _id: childId2, score: null }, // Null score should be filtered out
        ];

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockContent.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockChildQuestions as never),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        // Only child score 10 should be counted (null filtered out)
        // Question score calculation: Math.max(0, 10 - 20) = 0
        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith([0], [0], QuestionType.MultipleChoice, 0);
        expect(result.score).toBe(5);
      });
    });

    describe("Different Question Types Tests", () => {
      it("should handle checkbox question scoring", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createCheckboxContent(),
          response: [0, 2, 3],
        };

        const mockContentData = {
          _id: questionId,
          score: 15,
          type: QuestionType.CheckBox,
          answer: { answer: [0, 2, 3] },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(
          15
        );

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith([0, 2, 3], [0, 2, 3], QuestionType.CheckBox, 15);
        expect(result.score).toBe(15);
      });

      it("should handle number question scoring", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createNumberContent(),
          response: 42,
        };

        const mockContentData = {
          _id: questionId,
          score: 5,
          type: QuestionType.Number,
          answer: { answer: 42 },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(5);
      });

      it("should handle short answer question scoring", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createShortAnswerContent(),
          response: "polymorphism is object oriented programming concept",
        };

        const mockContentData = {
          _id: questionId,
          score: 20,
          type: QuestionType.ShortAnswer,
          answer: {
            answer:
              "polymorphism is the ability of objects to take multiple forms",
          },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(
          18
        );

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(18);
      });
    });

    describe("Error Handling Tests", () => {
      it("should return score 0 when database query fails", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createTextContent(),
          response: "Some answer",
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockRejectedValue(new Error("Database error") as never),
            }),
          }),
        } as any);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(0);
        expect(result.questionId).toBe(questionId);
      });

      it("should return score 0 when SolutionValidationService throws error", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [0],
        };

        const mockContentData = {
          _id: questionId,
          score: 10,
          type: QuestionType.MultipleChoice,
          answer: { answer: [0] },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockImplementation(
          () => {
            throw new Error("Validation service error");
          }
        );

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.score).toBe(0);
      });

      it("should handle missing conditional children gracefully", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createMultipleChoiceContent(),
          response: [0],
        };

        const mockContentData = {
          _id: questionId,
          score: 10,
          type: QuestionType.MultipleChoice,
          answer: { answer: [0] },
          conditional: [{ contentId: new Types.ObjectId(), key: 0 }],
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        // Return empty array for child questions
        mockContent.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([] as never),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(8);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        // Should use original question score when no child scores found
        expect(
          mockSolutionValidationService.calculateResponseScore
        ).toHaveBeenCalledWith(
          [0],
          [0],
          QuestionType.MultipleChoice,
          0 // Math.max(0, 0 - 10) = 0
        );
        expect(result.score).toBe(8);
      });
    });

    describe("Edge Cases", () => {
      it("should preserve original response properties", async () => {
        const questionId = new Types.ObjectId();
        const mockResponse: ResponseSetType = {
          questionId,
          question: MockContentFactory.createTextContent(),
          response: "answer",
          isManuallyScored: false,
        };

        const mockContentData = {
          _id: questionId,
          score: 5,
          type: QuestionType.Text,
          answer: { answer: "answer" },
          conditional: null,
        };

        mockContent.findById.mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockContentData as never),
            }),
          }),
        } as any);

        mockSolutionValidationService.calculateResponseScore.mockReturnValue(5);

        const result = await FormResponseController.AddScore(
          questionId,
          mockResponse
        );

        expect(result.questionId).toBe(questionId);
        expect(result.question).toBe(mockResponse.question);
        expect(result.response).toBe("answer");
        expect(result.isManuallyScored).toBe(false);
        expect(result.score).toBe(5);
      });
    });
  });
});
