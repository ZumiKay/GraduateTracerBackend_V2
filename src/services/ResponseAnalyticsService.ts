import { Types } from "mongoose";
import FormResponse, { FormResponseType } from "../model/Response.model";
import Content, {
  ContentTitle,
  ContentType,
  QuestionType,
} from "../model/Content.model";
import { getResponseDisplayName } from "../utilities/respondentUtils";
import { RespondentTrackingService } from "./RespondentTrackingService";
import { AddQuestionNumbering } from "../utilities/helper";

export class FormOverViewAnalyticsService {
  static extractQuestionTitle(title: ContentTitle): string {
    if (typeof title === "string") {
      return title;
    }

    if (title && typeof title === "object") {
      // Handle TipTap JSON structure
      if (title.content && Array.isArray(title.content)) {
        return title.content
          .map((node) => {
            if (node.text) return node.text;
            if (node.content) {
              return node.content.map((n: any) => n.text || "").join("");
            }
            return "";
          })
          .join(" ")
          .trim();
      }
      if (title.text) {
        return title.text;
      }
    }

    return "Question";
  }

  /**
   * Calculate comprehensive completion time statistics
   * @param completionTimes Array of completion times in seconds
   * @returns Object with average, min, max times in seconds
   */
  static calculateAverageCompletionTime(completionTimes: number[] | undefined) {
    // Validate input
    if (!completionTimes || completionTimes.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const validTimes = completionTimes.filter((time) => time >= 0);

    if (validTimes.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    // Calculate average
    const sum = validTimes.reduce((acc, time) => acc + time, 0);
    const average = Math.round(sum / validTimes.length);

    // Get min and max
    const min = Math.min(...validTimes);
    const max = Math.max(...validTimes);

    return {
      average,
      min,
      max,
      count: validTimes.length,
    };
  }

  /* ------------------------ Analytics Metries Methods ----------------------- */

  /**Get analytics data for filtering the data base on the period with included all the data for graphs and metries*/
  static async getFormAnalytics(formId: string, period: string = "7d") {
    const now = new Date();
    const startDate = this.calculateStartDate(period, now);

    const responses = await FormResponse.find({
      formId: new Types.ObjectId(formId),
      createdAt: { $gte: startDate },
    })
      .sort({ createdAt: -1 })
      .lean();

    const questions = await Content.find({
      formId: new Types.ObjectId(formId),
    }).lean();

    return {
      ...this.calculateBasicMetrics(responses),
      timeSeriesData: this.generateTimeSeriesData(responses, startDate, now),
      performanceMetrics: this.generatePerformanceMetrics(
        responses,
        AddQuestionNumbering({ questions }),
      ),
    };
  }

  private static calculateStartDate(period: string, now: Date): Date {
    const periodMap: { [key: string]: number } = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };

    const days = periodMap[period] || 0;
    return days > 0
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : new Date(0);
  }

  private static calculateBasicMetrics(responses: Array<FormResponseType>) {
    const totalResponses = responses.length;
    //Filtered For Completed Form Responses only
    const completedResponses = responses.filter(
      (r) => r.completionStatus === "completed",
    ).length;
    const averageScore =
      responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
        totalResponses || 0;
    const responseRate =
      totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;

    // Extract completion times from responses (assuming completionTime is in seconds or parseable)
    const completionTimes = responses
      .map((r) => {
        if (typeof r.completionTime === "number") {
          return r.completionTime;
        }
        // If it's a string like "1d 2h 30mn", you can parse it or skip
        return null;
      })
      .filter((time): time is number => time !== null);

    const completionTimeStats =
      this.calculateAverageCompletionTime(completionTimes);

    return {
      totalResponses,
      completedResponses,
      averageScore,
      responseRate,
      averageCompletionTime: RespondentTrackingService.formatCompletionTime(
        completionTimeStats.average,
      ),
      completionTimeStats, // Return full stats for detailed analytics
    };
  }

  /**Analytics data for responses overview for sepcific times */
  private static generateTimeSeriesData(
    responses: Array<FormResponseType>,
    startDate: Date,
    endDate: Date,
  ) {
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    const data = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      );

      const dayResponses = responses.filter(
        (r) =>
          r.submittedAt && r.submittedAt >= dayStart && r.submittedAt < dayEnd,
      );

      const avgScore =
        dayResponses.length > 0
          ? dayResponses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
            dayResponses.length
          : 0;

      data.push({
        date: date.toISOString().split("T")[0],
        responses: dayResponses.length,
        averageScore: avgScore,
      });
    }

    return data;
  }

  private static generatePerformanceMetrics(
    responses: Array<FormResponseType>,
    questions: Array<ContentType>,
  ) {
    const scoredStatuses = new Set([
      "completed",
      "autoscore",
      "noscore",
      "submitted",
    ]);

    const scoredResponses = responses.filter(
      (r) =>
        r.respondentEmail &&
        r.totalScore != null &&
        r.completionStatus &&
        scoredStatuses.has(r.completionStatus),
    );

    const topPerformers = scoredResponses
      .sort((a, b) => {
        const aPercent =
          a.maxScore && a.maxScore > 0
            ? (a.totalScore! / a.maxScore) * 100
            : a.totalScore!;
        const bPercent =
          b.maxScore && b.maxScore > 0
            ? (b.totalScore! / b.maxScore) * 100
            : b.totalScore!;
        return bPercent - aPercent;
      })
      .slice(0, 5)
      .map((r) => ({
        name: getResponseDisplayName(r),
        email: r.respondentEmail,
        score: r.totalScore ?? 0,
        maxScore: r.maxScore ?? null,
        percentScore:
          r.maxScore && r.maxScore > 0
            ? Math.round((r.totalScore! / r.maxScore) * 100 * 10) / 10
            : null,
      }));

    // Only score-bearing question types
    const scoredQuestions = questions.filter(
      (q) =>
        q.type !== QuestionType.Text &&
        !q.isBonusScore &&
        q.score != null &&
        q.score > 0,
    );

    const difficultQuestions = scoredQuestions
      .map((q) => {
        const qIdStr = q._id?.toString();

        const questionResponses = responses.filter((r) =>
          r.responseset.some((rs) => {
            const rsQId =
              rs.question instanceof Types.ObjectId ||
              typeof rs.question === "string"
                ? rs.question.toString()
                : (rs.question as ContentType)?._id?.toString();
            return rsQId === qIdStr;
          }),
        );

        const responseCount = questionResponses.length;

        if (responseCount === 0) {
          return {
            _id: q._id,
            questionId: q.questionId,
            title: this.extractQuestionTitle(q.title),
            accuracy: 0,
            partialAccuracy: 0,
            averageScore: 0,
            maxScore: q.score!,
            averagePercent: 0,
            responseCount: 0,
            isConditional: !!q.parentcontent,
          };
        }

        let fullMarkCount = 0;
        let anyMarkCount = 0;
        let totalEarned = 0;

        //Count score of the current question
        for (const res of questionResponses) {
          const rs = res.responseset.find((rs) => {
            const rsQId =
              rs.question instanceof Types.ObjectId ||
              typeof rs.question === "string"
                ? rs.question.toString()
                : (rs.question as ContentType)?._id?.toString();
            return rsQId === qIdStr;
          });

          const earned = rs?.score ?? 0;
          totalEarned += earned;

          if (earned >= q.score!) fullMarkCount++;
          if (earned > 0) anyMarkCount++;
        }

        const accuracy = fullMarkCount / responseCount;
        const partialAccuracy = anyMarkCount / responseCount;
        const averageScore = totalEarned / responseCount;
        const averagePercent =
          Math.round((averageScore / q.score!) * 100 * 10) / 10;

        return {
          _id: q._id,
          questionId: q.questionId,
          title: this.extractQuestionTitle(q.title),
          accuracy,
          partialAccuracy,
          averageScore: Math.round(averageScore * 100) / 100,
          maxScore: q.score!,
          averagePercent,
          responseCount,
          isConditional: !!q.parentcontent,
        };
      })
      .filter((q) => q.responseCount > 0)
      .sort((a, b) => a.accuracy - b.accuracy) // lowest accuracy = most difficult
      .slice(0, 5);

    return { topPerformers, difficultQuestions };
  }

  static generateCSVData(responses: FormResponseType[]): string {
    const headers = [
      "Response ID",
      "Respondent Name",
      "Respondent Email",
      "Total Score",
      "Completion Status",
      "Submitted At",
    ];
    const csvRows = [headers.join(",")];

    responses.forEach((response) => {
      const row = [
        response._id,
        getResponseDisplayName(response),
        response.respondentEmail || "N/A",
        response.totalScore || 0,
        response.completionStatus || "partial",
        response.submittedAt
          ? new Date(response.submittedAt).toISOString()
          : "N/A",
      ];
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }

  static async getResponseStatusSummary() {}
}

export { FormOverViewAnalyticsService as ResponseAnalyticsService };
