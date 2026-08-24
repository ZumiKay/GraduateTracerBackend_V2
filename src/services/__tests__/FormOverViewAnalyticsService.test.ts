import { Types } from "mongoose";
import { ContentType, QuestionType } from "../../model/Content.model";
import FormResponse, {
  FormResponseType,
  ResponseCompletionStatus,
} from "../../model/Response.model";
import Content from "../../model/Content.model";
import { FormOverViewAnalyticsService } from "../ResponseAnalyticsService";
// Mock Mongoose models
jest.mock("../../model/Response.model");
jest.mock("../../model/Content.model");

describe("FormOverViewAnalyticsService", () => {
  const formId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateAverageCompletionTime", () => {
    test("returns zeroes for undefined, null, or empty array", () => {
      const expectedResult = {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
      };
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime(undefined),
      ).toEqual(expectedResult);

      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime(
          null as never,
        ),
      ).toEqual(expectedResult);

      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime([]),
      ).toEqual(expectedResult);
    });

    test("returns zeroes when array contains only negative numbers", () => {
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime([
          -10, -50, -1,
        ]),
      ).toEqual({
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
      });
    });

    test("calculates statistics correctly for positive numbers", () => {
      const times = [60, 120, 180]; // sum = 360, avg = 120, min = 60, max = 180, count = 3
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime(times),
      ).toEqual({
        average: 120,
        min: 60,
        max: 180,
        count: 3,
      });
    });

    test("filters out negative values from mixed input", () => {
      const times = [100, -25, 200, -5]; // valid: [100, 200], sum = 300, avg = 150, min = 100, max = 200
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime(times),
      ).toEqual({
        average: 150,
        min: 100,
        max: 200,
        count: 2,
      });
    });

    test("handles a single positive value", () => {
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime([45]),
      ).toEqual({
        average: 45,
        min: 45,
        max: 45,
        count: 1,
      });
    });

    test("rounds the average properly", () => {
      const times = [10, 15]; // sum = 25, avg = 12.5 -> Math.round(12.5) = 13
      expect(
        FormOverViewAnalyticsService.calculateAverageCompletionTime(times),
      ).toEqual({
        average: 13,
        min: 10,
        max: 15,
        count: 2,
      });
    });
  });

  describe("calculateStartDate", () => {
    const fixedNow = new Date("2026-08-21T12:00:00Z");

    test("calculates 7 days ago for '7d'", () => {
      const startDate = (
        FormOverViewAnalyticsService as any
      ).calculateStartDate("7d", fixedNow);
      const expectedDate = new Date(
        fixedNow.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      expect(startDate.getTime()).toBe(expectedDate.getTime());
    });

    test("calculates 30 days ago for '30d'", () => {
      const startDate = (
        FormOverViewAnalyticsService as any
      ).calculateStartDate("30d", fixedNow);
      const expectedDate = new Date(
        fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      expect(startDate.getTime()).toBe(expectedDate.getTime());
    });

    test("calculates 90 days ago for '90d'", () => {
      const startDate = (
        FormOverViewAnalyticsService as any
      ).calculateStartDate("90d", fixedNow);
      const expectedDate = new Date(
        fixedNow.getTime() - 90 * 24 * 60 * 60 * 1000,
      );
      expect(startDate.getTime()).toBe(expectedDate.getTime());
    });

    test("returns Epoch Date(0) for 'all' or unknown period", () => {
      const allDate = (FormOverViewAnalyticsService as any).calculateStartDate(
        "all",
        fixedNow,
      );
      expect(allDate.getTime()).toBe(0);

      const unknownDate = (
        FormOverViewAnalyticsService as any
      ).calculateStartDate("invalid_period", fixedNow);
      expect(unknownDate.getTime()).toBe(0);
    });
  });

  describe("calculateBasicMetrics ", () => {
    test("returns zeroed metrics for empty response list", () => {
      const metrics = (
        FormOverViewAnalyticsService as any
      ).calculateBasicMetrics([]);
      expect(metrics).toEqual({
        totalResponses: 0,
        completedResponses: 0,
        averageScore: 0,
        responseRate: 0,
        averageCompletionTime: "0mn",
        completionTimeStats: {
          average: 0,
          median: 0,
          min: 0,
          max: 0,
          count: 0,
        },
      });
    });

    test("computes basic metrics correctly from responses", () => {
      const responses: Partial<FormResponseType>[] = [
        {
          completionStatus: ResponseCompletionStatus.completed,
          totalScore: 80,
          completionTime: 120,
        },
        {
          completionStatus: ResponseCompletionStatus.completed,
          totalScore: 60,
          completionTime: 240,
        },
        {
          completionStatus: ResponseCompletionStatus.partial,
          totalScore: 10,
          completionTime: 60,
        },
        {
          completionStatus: ResponseCompletionStatus.abandoned,
          totalScore: 0,
          completionTime: "invalid" as never, // Non-number completion time ignored
        },
      ];

      const metrics = (
        FormOverViewAnalyticsService as any
      ).calculateBasicMetrics(responses as FormResponseType[]);

      expect(metrics.totalResponses).toBe(4);
      expect(metrics.completedResponses).toBe(2);
      expect(metrics.averageScore).toBe(37.5); // (80 + 60 + 10 + 0) / 4 = 37.5
      expect(metrics.responseRate).toBe(50); // (2 / 4) * 100 = 50%
      expect(metrics.completionTimeStats.average).toBe(140); // (120 + 240 + 60) / 3 = 140
      expect(metrics.averageCompletionTime).toBe("2mn"); // 140 seconds = 2mn
    });
  });

  describe("generateTimeSeriesData (private method)", () => {
    test("generates daily time series with correct response counts and average scores", () => {
      const startDate = new Date("2026-07-01T00:00:00Z");
      const endDate = new Date("2026-08-01T00:00:00Z"); //start to end with 1 month period.

      const responses: Partial<FormResponseType>[] = [
        {
          submittedAt: new Date("2026-07-07T14:00:00Z"),
          totalScore: 20,
        },
        {
          submittedAt: new Date("2026-07-07T14:00:00Z"),
          totalScore: 40,
        },
        {
          submittedAt: new Date("2026-07-10T10:00:00Z"),
          totalScore: 90,
        },
        {
          submittedAt: new Date("2026-07-25T09:00:00Z"),
          totalScore: 30,
        },
        { submittedAt: new Date("2026-07-25T09:00:00Z"), totalScore: 80 },
      ];

      //Cast as any cause it is a private method
      const series = (
        FormOverViewAnalyticsService as any
      ).generateTimeSeriesData(
        responses as FormResponseType[],
        startDate,
        endDate,
      );

      expect(series).toHaveLength(31);

      expect(series[6].responses).toBe(2);
      expect(series[6].averageScore).toBe(30); // (20 + 40) / 2

      expect(series[9].responses).toBe(1);
      expect(series[9].averageScore).toBe(90);

      expect(series[24].responses).toBe(2);
      expect(series[24].averageScore).toBe(55);
    });
  });

  describe("generatePerformanceMetrics (private method)", () => {
    const q1Id = new Types.ObjectId();
    const q2Id = new Types.ObjectId();
    const textQId = new Types.ObjectId();
    const bonusQId = new Types.ObjectId();

    const questions: Partial<ContentType>[] = [
      {
        _id: q1Id,
        questionId: "1",
        title: { type: "text", text: "Math Question" },
        type: QuestionType.MultipleChoice,
        score: 10,
        isBonusScore: false,
      },
      {
        _id: q2Id,
        questionId: "2",
        title: { type: "text", text: "Science Question" },
        type: QuestionType.MultipleChoice,
        score: 20,
        parentcontent: {
          qId: q1Id.toString(),
          qIdx: 0,
          optIdx: 0,
        } as never,
        isBonusScore: false,
      },
      {
        _id: textQId,
        questionId: "3",
        title: { type: "text", text: "Open feedback" },
        type: QuestionType.Text,
        score: 0,
      },
      {
        _id: bonusQId,
        questionId: "4",
        title: { type: "text", text: "Bonus Challenge" },
        type: QuestionType.MultipleChoice,
        score: 5,
        isBonusScore: true,
      },
    ];

    test("generates top performers sorted by score percentage (up to 5)", () => {
      const responses: Partial<FormResponseType>[] = [
        {
          respondentEmail: "alice@example.com",
          respondentName: "Alice Walker",
          totalScore: 90,
          maxScore: 100,
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [],
        },
        {
          respondentEmail: "bob@example.com",
          respondentName: "Bob Smith",
          totalScore: 40,
          maxScore: 50, // 80%
          completionStatus: ResponseCompletionStatus.submitted,
          responseset: [],
        },
        {
          respondentEmail: "charlie@example.com",
          respondentName: "Charlie Brown",
          totalScore: 95,
          maxScore: 100, // 95%
          completionStatus: ResponseCompletionStatus.autoscore,
          responseset: [],
        },
        {
          respondentEmail: "david@example.com",
          respondentName: "David Lee",
          totalScore: 20,
          maxScore: 100, // 20%
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [],
        },
        {
          respondentEmail: "frank@example.com",
          respondentName: "Frank Miller",
          totalScore: 50,
          maxScore: 100, // 50% - should be 6th and excluded from top 5
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [],
        },
        {
          // Ineligible due to missing email
          respondentName: "No Email User",
          totalScore: 100,
          maxScore: 100,
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [],
        },
      ];

      const metrics = (
        FormOverViewAnalyticsService as any
      ).generatePerformanceMetrics(
        responses as FormResponseType[],
        questions as ContentType[],
      );

      expect(metrics.topPerformers).toHaveLength(5);
      expect(metrics.topPerformers[0].name).toBe("Charlie Brown");
      expect(metrics.topPerformers[0].percentScore).toBe(95);
      expect(metrics.topPerformers[1].name).toBe("Alice Walker");
      expect(metrics.topPerformers[1].percentScore).toBe(90);
      expect(metrics.topPerformers[2].name).toBe("Bob Smith");
      expect(metrics.topPerformers[2].percentScore).toBe(80);
      expect(metrics.topPerformers[3].name).toBe("Frank Miller");
      expect(metrics.topPerformers[3].percentScore).toBe(50);
    });

    test("computes question difficulty metrics and sorts by lowest accuracy", () => {
      const responses: Partial<FormResponseType>[] = [
        {
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [
            { question: q1Id, response: "A", score: 10 }, // full mark on Q1
            { question: q2Id.toString(), response: "B", score: 0 }, // 0 on Q2
          ],
        },
        {
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [
            { question: q1Id, response: "A", score: 5 }, // partial mark on Q1
            { question: q2Id.toString(), response: "B", score: 20 }, // full mark on Q2
          ],
        },
        {
          completionStatus: ResponseCompletionStatus.completed,
          responseset: [
            { question: q1Id, response: "A", score: 10 }, // full mark on Q1
            { question: q2Id.toString(), response: "B", score: 0 }, // 0 on Q2
          ],
        },
      ];

      const metrics = (
        FormOverViewAnalyticsService as any
      ).generatePerformanceMetrics(
        responses as FormResponseType[],
        questions as ContentType[],
      );

      // Difficult questions should only include q1 and q2 (ignoring Text and Bonus)
      expect(metrics.difficultQuestions).toHaveLength(2);

      const [hardest, secondHardest] = metrics.difficultQuestions;

      expect(hardest.questionId).toBe("2");
      expect(hardest.isConditional).toBe(true);
      expect(hardest.maxScore).toBe(20);
      expect(hardest.accuracy).toBeCloseTo(0.33, 2);
      expect(hardest.partialAccuracy).toBeCloseTo(0.33, 2);
      expect(hardest.averageScore).toBeCloseTo(6.67, 2); // (0 + 20 + 0) / 3

      expect(secondHardest.questionId).toBe("1");
      expect(secondHardest.isConditional).toBe(false);
      expect(secondHardest.maxScore).toBe(10);
      expect(secondHardest.accuracy).toBeCloseTo(0.67, 2);
      expect(secondHardest.partialAccuracy).toBeCloseTo(1.0, 2); // all 3 earned > 0
      expect(secondHardest.averageScore).toBeCloseTo(8.33, 2); // (10 + 5 + 10) / 3
    });
  });

  describe("getFormAnalytics", () => {
    test("fetches data and returns consolidated overview analytics", async () => {
      const qId = new Types.ObjectId();
      const mockQuestions = [
        {
          _id: qId,
          formId: new Types.ObjectId(formId),
          title: { type: "text", text: "General Knowledge" },
          type: QuestionType.MultipleChoice,
          score: 10,
          qIdx: 0,
        },
      ];

      const mockResponses = [
        {
          _id: new Types.ObjectId(),
          formId: new Types.ObjectId(formId),
          respondentName: "Test User",
          respondentEmail: "test@example.com",
          totalScore: 10,
          maxScore: 10,
          completionStatus: ResponseCompletionStatus.completed,
          completionTime: 120,
          submittedAt: new Date(),
          createdAt: new Date(),
          responseset: [{ question: qId, response: "A", score: 10 }],
        },
      ];

      // Mock FormResponse.find query chain
      (FormResponse.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockResponses),
        }),
      });

      // Mock Content.find query chain
      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockQuestions),
      });

      const analytics = await FormOverViewAnalyticsService.getFormAnalytics(
        formId,
        "7d",
      );

      expect(FormResponse.find).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: new Types.ObjectId(formId),
          createdAt: expect.objectContaining({ $gte: expect.any(Date) }),
        }),
      );

      expect(Content.find).toHaveBeenCalledWith({
        formId: new Types.ObjectId(formId),
      });

      expect(analytics.totalResponses).toBe(1);
      expect(analytics.completedResponses).toBe(1);
      expect(analytics.averageScore).toBe(10);
      expect(analytics.responseRate).toBe(100);
      expect(analytics.timeSeriesData).toBeDefined();
      expect(analytics.performanceMetrics.topPerformers).toHaveLength(1);
      expect(analytics.performanceMetrics.difficultQuestions).toHaveLength(1);
    });

    test("handles 'all' period option in getFormAnalytics", async () => {
      (FormResponse.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      (Content.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const analytics = await FormOverViewAnalyticsService.getFormAnalytics(
        formId,
        "all",
      );

      expect(FormResponse.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: { $gte: new Date(0) },
        }),
      );

      expect(analytics.totalResponses).toBe(0);
      expect(analytics.completedResponses).toBe(0);
    });
  });
});
