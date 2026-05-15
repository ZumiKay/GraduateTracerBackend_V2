import { Types } from "mongoose";
import FormResponse, { FormResponseType } from "../model/Response.model";
import Content, { ContentTitle, ContentType } from "../model/Content.model";
import { getResponseDisplayName } from "../utilities/respondentUtils";
import { CustomRequest } from "../types/customType";

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

  /* ------------------------ Analytics Metries Methods ----------------------- */

  /**Get analytics data for filtering the data base on the period with included all the data for graphs and metries*/
  static async getFormAnalytics(formId: string, period: string = "7d") {
    const now = new Date();
    const startDate = this.calculateStartDate(period, now);

    const responses = await FormResponse.find({
      formId: new Types.ObjectId(formId),
      createdAt: { $gte: startDate },
    }).sort({ createdAt: -1 });

    const questions = await Content.find({
      formId: new Types.ObjectId(formId),
    });

    return {
      ...this.calculateBasicMetrics(responses),
      timeSeriesData: this.generateTimeSeriesData(responses, startDate, now),
      performanceMetrics: this.generatePerformanceMetrics(responses, questions),
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

    return {
      totalResponses,
      completedResponses,
      averageScore,
      responseRate,
      averageCompletionTime: 8, // Mock data
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
        (r) => r.createdAt && r.createdAt >= dayStart && r.createdAt < dayEnd,
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
    //Filter for highscore of each response for registered user only
    const topPerformers = responses
      .filter(
        (r) => (r.respondentName || r.respondentEmail) && r.respondentEmail,
      )
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 5) // Take Top 5
      .map((r) => ({
        name: getResponseDisplayName(r),
        email: r.respondentEmail,
        score: r.totalScore || 0,
      }));

    //Estimate the difficultQuestion
    const difficultQuestions = questions
      .map((q) => {
        const questionResponses = responses.filter((r) =>
          r.responseset.some(
            (rs) => rs.question.toString() === q._id?.toString(),
          ),
        );

        const correctCount = questionResponses.filter((r) => {
          const questionResponse = r.responseset.find(
            (rs) => rs.question.toString() === q._id?.toString(),
          );
          return (
            questionResponse &&
            questionResponse.score &&
            questionResponse.score > 0
          );
        }).length;

        //Correction rate
        const accuracy =
          questionResponses.length > 0
            ? (correctCount / questionResponses.length) * 100
            : 0;

        const avgScore =
          questionResponses.reduce((sum, r) => {
            const questionResponse = r.responseset.find(
              (rs) => rs.question.toString() === q._id?.toString(),
            );
            return sum + (questionResponse?.score || 0);
          }, 0) / questionResponses.length || 0;

        return {
          questionId: q._id?.toString() || "",
          title: typeof q.title === "string" ? q.title : "Question",
          accuracy,
          averageScore: avgScore,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy) //Descending
      .slice(0, 5); // Take top 5

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
