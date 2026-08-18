import { Types } from "mongoose";
import Content, { ContentType, QuestionType } from "../../model/Content.model";
import Form from "../../model/Form.model";
import { QuestionService } from "../Question.Service";
import { MockContentFactory } from "../../utilities/mockdata";

// Mock dependencies
jest.mock("../../model/Content.model");
jest.mock("../../model/Form.model");

describe("QuestionService", () => {
  const formId = new Types.ObjectId().toString();
  const q1Id = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("saveQuestion", () => {
    test("returns error for invalid payload", async () => {
      const result = await QuestionService.saveQuestion({
        data: null as never,
        formId: "",
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Invalid request payload");
    });

    test("returns error when validation issue is present in content", async () => {
      const result = await QuestionService.saveQuestion({
        formId,
        page: 1,
        data: [
          MockContentFactory.createTextContent({
            formId: new Types.ObjectId(formId),
            validationIssues: [{ type: "error" }] as never,
          }),
        ],
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Validation error");
    });

    test("returns noChanges: true when existing content matches new data", async () => {
      const mockQuestion = MockContentFactory.createTextContent({
        _id: q1Id,
        formId: new Types.ObjectId(formId),
        page: 1,
        qIdx: 0,
      });

      (Content.find as jest.Mock).mockResolvedValue([mockQuestion]);
      (Form.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      const result = await QuestionService.saveQuestion({
        formId,
        page: 1,
        title: "Updated Title",
        data: [mockQuestion],
      });

      expect(result.success).toBe(true);
      expect(result.noChanges).toBe(true);
      expect(result.message).toBe("No changes detected");
      expect(Form.updateOne).toHaveBeenCalledWith(
        { _id: formId },
        { title: "Updated Title" },
      );
    });

    test("returns score validation error if child scores exceed parent score", async () => {
      const parentQId = new Types.ObjectId();
      const childQId = new Types.ObjectId();

      const parentQuestion = MockContentFactory.createMultipleChoiceContent({
        _id: parentQId,
        formId: new Types.ObjectId(formId),
        score: 10,
        qIdx: 0,
        conditional: [
          { _id: new Types.ObjectId(), key: 0, contentId: childQId },
        ],
      });

      const childQuestion = MockContentFactory.createMultipleChoiceContent({
        _id: childQId,
        formId: new Types.ObjectId(formId),
        score: 15, // Exceeds parent's 10
        qIdx: 1,
        parentcontent: { qId: parentQId.toString(), optIdx: 0 },
      });

      (Content.find as jest.Mock).mockResolvedValue([]);

      const result = await QuestionService.saveQuestion({
        formId,
        page: 1,
        data: [parentQuestion, childQuestion],
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Score Validation Error");
    });

    test("successfully saves questions, runs bulk operations, and recalculates form score", async () => {
      const mockQuestion = MockContentFactory.createMultipleChoiceContent({
        _id: q1Id,
        formId: new Types.ObjectId(formId),
        page: 1,
        qIdx: 0,
        score: 10,
      });

      (Content.find as jest.Mock)
        .mockResolvedValueOnce([]) // existingContent (empty)
        .mockResolvedValueOnce([]) // toBeDeleted (empty)
        .mockResolvedValueOnce([{ score: 10, isBonusScore: false }]) // calculateFormTotalScore
        .mockResolvedValueOnce([mockQuestion]); // fetchUpdatedContent

      (Content.bulkWrite as jest.Mock).mockResolvedValue({ ok: 1 });
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ totalscore: 0 }),
      });
      (Form.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      const result = await QuestionService.saveQuestion({
        formId,
        page: 1,
        title: "My Form",
        data: [mockQuestion],
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Saved Completed");
      expect(Content.bulkWrite).toHaveBeenCalled();
      expect(Form.updateOne).toHaveBeenCalledWith(
        { _id: formId },
        expect.objectContaining({ totalscore: 10, title: "My Form" }),
      );
    });
  });

  describe("deleteQuestion", () => {
    test("returns error for missing id or formId", async () => {
      const result = await QuestionService.deleteQuestion("", formId);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Invalid request payload");
    });

    test("returns error if content not found", async () => {
      (Content.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await QuestionService.deleteQuestion(
        q1Id.toString(),
        formId,
      );
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Content not found");
    });

    test("successfully deletes question and linked conditional questions", async () => {
      const childId = new Types.ObjectId();
      (Content.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            score: 10,
            conditional: [{ contentId: childId }],
          }),
        }),
      });

      (Content.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      (Content.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      (Content.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      (Form.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      const result = await QuestionService.deleteQuestion(
        q1Id.toString(),
        formId,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Question Deleted");
      expect(Content.deleteOne).toHaveBeenCalledWith({ _id: q1Id.toString() });
      expect(Content.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [childId] },
      });
      expect(Form.updateOne).toHaveBeenCalledWith(
        { _id: formId },
        {
          $pull: { contentIds: q1Id.toString() },
          $inc: { totalscore: -10 },
        },
      );
    });
  });

  describe("saveSolution", () => {
    test("returns error if data is empty", async () => {
      const result = await QuestionService.saveSolution([]);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("No solution data provided");
    });

    test("successfully saves solutions using Form.bulkWrite", async () => {
      (Form.bulkWrite as jest.Mock).mockResolvedValue({ ok: 1 });

      const solutions = [
        {
          _id: new Types.ObjectId(),
          answer: 1,
        },
      ];

      const result = await QuestionService.saveSolution(solutions as never);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Solution Saved");
      expect(Form.bulkWrite).toHaveBeenCalled();
    });
  });

  describe("utility methods", () => {
    test("convertStringToDate parses valid dates and returns undefined for invalid", () => {
      expect(QuestionService.convertStringToDate("2026-08-18")).toBeInstanceOf(
        Date,
      );
      expect(
        QuestionService.convertStringToDate("invalid-date"),
      ).toBeUndefined();
    });

    test("generateNewQuestionIds assigns new ObjectIds only to questions without _id", () => {
      const existingId = new Types.ObjectId();
      const data = [
        { _id: existingId, text: "Existing" } as ContentType,
        { text: "New" } as ContentType,
      ];

      const { questionIdMap, newIds } =
        QuestionService.generateNewQuestionIds(data);

      expect(questionIdMap.size).toBe(1);
      expect(questionIdMap.has(1)).toBe(true);
      expect(newIds.length).toBe(1);
    });

    test("calculateFormTotalScore separates bonus scores from totalscore", async () => {
      (Content.find as jest.Mock).mockResolvedValue([
        { score: 10, isBonusScore: false },
        { score: 5, isBonusScore: true },
        { score: 20 },
      ]);

      const scores = await QuestionService.calculateFormTotalScore(formId);

      expect(scores.totalscore).toBe(30);
      expect(scores.extraScore).toBe(5);
    });
  });
});
