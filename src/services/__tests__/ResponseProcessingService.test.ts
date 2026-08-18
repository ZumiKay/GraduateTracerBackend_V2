import { Types } from "mongoose";
import FormResponse, {
  RespondentType,
  ResponseCompletionStatus,
  ResponseSetType,
  ScoringMethod,
} from "../../model/Response.model";
import Content, { ContentType, QuestionType } from "../../model/Content.model";
import Form, { FormType, returnscore } from "../../model/Form.model";
import User from "../../model/User.model";
import EmailService from "../EmailService";
import { RespondentTrackingService } from "../RespondentTrackingService";
import { ResponseProcessingService } from "../ResponseProcessingService";

// Mock dependencies
jest.mock("../../model/Response.model");
jest.mock("../../model/Content.model");
jest.mock("../../model/Form.model");
jest.mock("../../model/User.model");
jest.mock("../EmailService");
jest.mock("../RespondentTrackingService");

describe("ResponseProcessingService", () => {
  const formId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const q1Id = new Types.ObjectId();
  const q2Id = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /*                      processNormalFormSubmission Tests                     */
  /* -------------------------------------------------------------------------- */
  describe("processNormalFormSubmission", () => {
    const mockQuestions: Partial<ContentType>[] = [
      {
        _id: q1Id,
        formId,
        type: QuestionType.Text,
        require: true,
        questionId: "1",
      },
      {
        _id: q2Id,
        formId,
        type: QuestionType.Number,
        require: false,
        questionId: "2",
      },
    ];

    test("should throw error if form is not found", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        ResponseProcessingService.processNormalFormSubmission({
          formId: formId.toString(),
          responseset: [],
          req: {} as never,
        } as never),
      ).rejects.toThrow("Form not found");
    });

    test("should throw error if form requires email but no respondentEmail is provided", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: formId,
            setting: { email: true },
          }),
        }),
      });

      await expect(
        ResponseProcessingService.processNormalFormSubmission({
          formId: formId.toString(),
          responseset: [],
          req: {} as never,
        } as never),
      ).rejects.toThrow("Email is required for this form");
    });

    test("should throw error if form is submitonce and respondent has already submitted", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: formId,
            setting: { submitonce: true },
          }),
        }),
      });
      (RespondentTrackingService.checkRespondentExists as jest.Mock).mockResolvedValue({
        hasResponded: true,
      });

      await expect(
        ResponseProcessingService.processNormalFormSubmission({
          formId: formId.toString(),
          responseset: [],
          req: {} as never,
        } as never),
      ).rejects.toThrow("Form already submitted");
    });

    test("should throw error if a required question is missing or empty", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: formId,
            setting: {},
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuestions),
      });

      const submissionData = {
        formId: formId.toString(),
        responseset: [
          { question: q1Id.toString(), response: "" }, // required but empty
          { question: q2Id.toString(), response: 25 },
        ],
        req: {} as never,
      };

      await expect(
        ResponseProcessingService.processNormalFormSubmission(submissionData as never),
      ).rejects.toThrow("Require");
    });

    test("should throw error if answer format is invalid", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: formId,
            setting: {},
          }),
        }),
      });
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuestions),
      });

      const submissionData = {
        formId: formId.toString(),
        responseset: [
          { question: q1Id.toString(), response: "Valid text" },
          { question: q2Id.toString(), response: "Not a number" }, // Invalid for Number type
        ],
        req: {} as never,
      };

      await expect(
        ResponseProcessingService.processNormalFormSubmission(submissionData as never),
      ).rejects.toThrow();
    });

    test("should successfully save response and return confirmation", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: formId,
            setting: { email: true },
          }),
        }),
      });
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: userId,
        email: "user@example.com",
      });
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuestions),
      });
      (FormResponse.create as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId() });

      const submissionData = {
        formId: formId.toString(),
        respondentEmail: "user@example.com",
        respondentName: "John Doe",
        responseset: [
          { question: q1Id.toString(), response: "Valid text" },
          { question: q2Id.toString(), response: 42 },
        ],
        req: {} as never,
      };

      const result = await ResponseProcessingService.processNormalFormSubmission(
        submissionData as never,
      );

      expect(result).toEqual({ message: "Form Submitted" });
      expect(FormResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: ResponseCompletionStatus.completed,
          respondentType: RespondentType.user,
          respondentEmail: "user@example.com",
        }),
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         processFormSubmission Tests                        */
  /* -------------------------------------------------------------------------- */
  describe("processFormSubmission", () => {
    const mockForm: FormType = {
      _id: formId,
      title: "Quiz Form",
      totalscore: 20,
      setting: {
        email: true,
        returnscore: returnscore.partial,
      },
    } as never;

    test("should throw error if responseset is empty", async () => {
      await expect(
        ResponseProcessingService.processFormSubmission(
          { formId, responseset: [] },
          mockForm,
        ),
      ).rejects.toThrow("Invalid Response Data");
    });

    test("should throw error if form requires email but none is provided", async () => {
      await expect(
        ResponseProcessingService.processFormSubmission(
          {
            formId,
            responseset: [{ question: q1Id.toString(), response: "Ans" }],
          },
          mockForm,
        ),
      ).rejects.toThrow("Email is required for this form");
    });

    test("should process auto-scored submission, save response, and send email", async () => {
      const responseId = new Types.ObjectId();
      const sendResponseResultsMock = jest.fn().mockResolvedValue(true);
      (EmailService as jest.Mock).mockImplementation(() => ({
        sendResponseResults: sendResponseResultsMock,
      }));

      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ _id: userId, email: "user@example.com" }),
        }),
      });

      // Mock addScore
      jest.spyOn(ResponseProcessingService, "addScore").mockResolvedValue({
        response: [
          {
            question: q1Id,
            response: "Answer",
            score: 10,
            scoringMethod: ScoringMethod.AUTO,
          },
        ],
        isNonScore: false,
        hasUnansweredScoredQuestion: false,
      });

      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      (FormResponse.create as jest.Mock).mockResolvedValue({
        _id: responseId,
      });

      const result = await ResponseProcessingService.processFormSubmission(
        {
          formId,
          respondentEmail: "user@example.com",
          responseset: [{ question: q1Id.toString(), response: "Answer" }],
        },
        mockForm,
      );

      expect(result.responseId).toBe(responseId.toString());
      expect(result.totalScore).toBe(10);
      expect(result.message).toBe("This your final score");
      expect(sendResponseResultsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          formTitle: "Quiz Form",
          totalScore: 10,
          maxScore: 20,
        }),
      );
    });

    test("should handle partial score return with manual grading notice", async () => {
      const responseId = new Types.ObjectId();
      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        }),
      });

      jest.spyOn(ResponseProcessingService, "addScore").mockResolvedValue({
        response: [
          {
            question: q1Id,
            response: "Auto Answer",
            score: 5,
            scoringMethod: ScoringMethod.AUTO,
          },
          {
            question: q2Id,
            response: "Manual Answer",
            scoringMethod: ScoringMethod.MANUAL,
          },
        ],
        isNonScore: false,
        hasUnansweredScoredQuestion: false,
      });

      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      (FormResponse.create as jest.Mock).mockResolvedValue({
        _id: responseId,
      });

      const result = await ResponseProcessingService.processFormSubmission(
        {
          formId,
          respondentEmail: "guest@example.com",
          responseset: [
            { question: q1Id.toString(), response: "Auto Answer" },
            { question: q2Id.toString(), response: "Manual Answer" },
          ],
        },
        mockForm,
      );

      expect(result.message).toBe(
        "Totalscore is partial only might change when form owner return your score.",
      );
      expect(FormResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          completionStatus: ResponseCompletionStatus.submitted,
        }),
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         updateResponseScores Tests                         */
  /* -------------------------------------------------------------------------- */
  describe("updateResponseScores", () => {
    const responseId = new Types.ObjectId().toString();

    test("should throw error for empty or invalid scores array", async () => {
      await expect(
        ResponseProcessingService.updateResponseScores({
          responseId,
          scores: [] as never,
        }),
      ).rejects.toThrow("Invalid scores data");
    });

    test("should throw error if response is not found", async () => {
      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ResponseProcessingService.updateResponseScores({
          responseId,
          scores: [{ questionId: q1Id.toString(), score: 10 }],
        }),
      ).rejects.toThrow("Response not found");
    });

    test("should update score and comment and save response", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockResponse = {
        _id: responseId,
        responseset: [
          {
            question: q1Id.toString(),
            score: 0,
            scoringMethod: ScoringMethod.MANUAL,
            comment: undefined as string | undefined,
          } as ResponseSetType,
          {
            question: q2Id.toString(),
            score: 5,
            scoringMethod: ScoringMethod.AUTO,
          } as ResponseSetType,
        ],
        totalScore: 5,
        completionStatus: ResponseCompletionStatus.submitted,
        save: mockSave,
      };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await ResponseProcessingService.updateResponseScores({
        responseId,
        scores: [
          {
            questionId: q1Id.toString(),
            score: 8,
            comment: "Great improvement",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.updatedScores).toBe(1);
      expect(result.totalScore).toBe(13);
      expect(mockResponse.responseset[0].score).toBe(8);
      expect(mockResponse.responseset[0].comment).toBe("Great improvement");
      expect(mockResponse.completionStatus).toBe(ResponseCompletionStatus.completed);
      expect(mockSave).toHaveBeenCalled();
    });

    test("should return message when no matching questions found", async () => {
      const mockResponse = {
        _id: responseId,
        responseset: [{ question: q1Id.toString(), score: 5 }],
        save: jest.fn(),
      };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await ResponseProcessingService.updateResponseScores({
        responseId,
        scores: [{ questionId: new Types.ObjectId().toString(), score: 10 }],
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("No matching questions found to update");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                      batchUpdateResponseScores Tests                       */
  /* -------------------------------------------------------------------------- */
  describe("batchUpdateResponseScores", () => {
    test("should batch update multiple response scores", async () => {
      const update1 = {
        responseId: new Types.ObjectId().toString(),
        scores: [{ questionId: q1Id.toString(), score: 10 }],
      };
      const update2 = {
        responseId: new Types.ObjectId().toString(),
        scores: [{ questionId: q2Id.toString(), score: 5 }],
      };

      jest
        .spyOn(ResponseProcessingService, "updateResponseScores")
        .mockResolvedValueOnce({ success: true, updatedScores: 1, totalScore: 10 })
        .mockResolvedValueOnce({ success: true, updatedScores: 1, totalScore: 5 });

      const result = await ResponseProcessingService.batchUpdateResponseScores([
        update1,
        update2,
      ]);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                     recalculateResponseTotalScore Tests                    */
  /* -------------------------------------------------------------------------- */
  describe("recalculateResponseTotalScore", () => {
    const responseId = new Types.ObjectId().toString();

    test("should throw error if response is not found", async () => {
      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        ResponseProcessingService.recalculateResponseTotalScore(responseId),
      ).rejects.toThrow("Response not found");
    });

    test("should correct totalScore if mismatch is found", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockResponse = {
        responseset: [{ score: 5 }, { score: 10 }],
        totalScore: 0, // Out of sync
        save: mockSave,
      };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockResponse),
      });

      const result =
        await ResponseProcessingService.recalculateResponseTotalScore(responseId);

      expect(result.corrected).toBe(true);
      expect(result.newTotal).toBe(15);
      expect(mockResponse.totalScore).toBe(15);
      expect(mockSave).toHaveBeenCalled();
    });

    test("should not update if totalScore is already correct", async () => {
      const mockSave = jest.fn();
      const mockResponse = {
        responseset: [{ score: 5 }, { score: 5 }],
        totalScore: 10,
        save: mockSave,
      };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockResponse),
      });

      const result =
        await ResponseProcessingService.recalculateResponseTotalScore(responseId);

      expect(result.corrected).toBe(false);
      expect(result.totalScore).toBe(10);
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        validateFormSubmission Tests                        */
  /* -------------------------------------------------------------------------- */
  describe("validateFormSubmission", () => {
    test("should return error if form is not found", async () => {
      (Form.findById as jest.Mock).mockResolvedValue(null);

      const result = await ResponseProcessingService.validateFormSubmission({
        formId: formId.toString(),
        responseset: [],
      });

      expect(result).toEqual({ errormess: "Form not found" });
    });

    test("should return error if form is not accepting responses", async () => {
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: formId,
        setting: { acceptResponses: false },
      });

      const result = await ResponseProcessingService.validateFormSubmission({
        formId: formId.toString(),
        responseset: [],
      });

      expect(result).toEqual({
        errormess: "Form is no longer accepting responses",
      });
    });

    test("should return error if no questions are found", async () => {
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: formId,
        setting: { acceptResponses: true },
      });
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await ResponseProcessingService.validateFormSubmission({
        formId: formId.toString(),
        responseset: [],
      });

      expect(result).toEqual({
        errormess: "No questions found for this form",
      });
    });

    test("should return true when validation passes", async () => {
      (Form.findById as jest.Mock).mockResolvedValue({
        _id: formId,
        setting: { acceptResponses: true },
      });
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: q1Id,
            type: QuestionType.Text,
            require: true,
          },
        ]),
      });

      const result = await ResponseProcessingService.validateFormSubmission({
        formId: formId.toString(),
        responseset: [{ question: q1Id.toString(), response: "Hello" }],
      });

      expect(result).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        checkExistingResponse Tests                         */
  /* -------------------------------------------------------------------------- */
  describe("checkExistingResponse", () => {
    test("should return null if neither userId nor guestEmail is provided", async () => {
      const result = await ResponseProcessingService.checkExistingResponse(
        formId.toString(),
      );
      expect(result).toBeNull();
    });

    test("should query by userId when provided", async () => {
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), userId }),
      });

      const result = await ResponseProcessingService.checkExistingResponse(
        formId.toString(),
        userId.toString(),
      );

      expect(FormResponse.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ formId: formId.toString() }),
      );
      expect(result).not.toBeNull();
    });

    test("should query by guest.email when guestEmail is provided", async () => {
      (FormResponse.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      });

      const result = await ResponseProcessingService.checkExistingResponse(
        formId.toString(),
        undefined,
        "guest@example.com",
      );

      expect(FormResponse.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ "guest.email": "guest@example.com" }),
      );
      expect(result).not.toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           getFormMaxScore Tests                            */
  /* -------------------------------------------------------------------------- */
  describe("getFormMaxScore", () => {
    test("should calculate total max score of all questions in a form", async () => {
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { score: 10 },
            { score: 15 },
            { score: undefined },
          ]),
        }),
      });

      const maxScore = await ResponseProcessingService.getFormMaxScore(
        formId.toString(),
      );

      expect(maxScore).toBe(25);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        getResponseStatistics Tests                         */
  /* -------------------------------------------------------------------------- */
  describe("getResponseStatistics", () => {
    test("should return calculated statistics for a form", async () => {
      (FormResponse.countDocuments as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // completed

      (FormResponse.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { totalScore: 80 },
            { totalScore: 90 },
            { totalScore: 70 },
          ]),
        }),
      });

      const stats = await ResponseProcessingService.getResponseStatistics(
        formId.toString(),
      );

      expect(stats.totalResponses).toBe(10);
      expect(stats.completedResponses).toBe(8);
      expect(stats.completionRate).toBe(80);
      expect(stats.averageScore).toBe(80);
      expect(stats.maxScore).toBe(90);
      expect(stats.minScore).toBe(70);
    });

    test("should handle empty response stats gracefully", async () => {
      (FormResponse.countDocuments as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (FormResponse.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const stats = await ResponseProcessingService.getResponseStatistics(
        formId.toString(),
      );

      expect(stats.totalResponses).toBe(0);
      expect(stats.completedResponses).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.maxScore).toBe(0);
      expect(stats.minScore).toBe(0);
    });
  });
});
