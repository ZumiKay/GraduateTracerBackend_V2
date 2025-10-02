import { Types } from "mongoose";
import FormResponse from "../model/Response.model";
import Content from "../model/Content.model";
import Form from "../model/Form.model";
import { getResponseDisplayName } from "../utilities/respondentUtils";

export class ResponseAnalyticsService {
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

    const form = await Form.findById(formId).lean();

    return {
      ...this.calculateBasicMetrics(responses),
      questionAnalytics: await this.generateQuestionAnalytics(
        responses,
        questions
      ),
      scoreDistribution: this.generateScoreDistribution(
        responses,
        form?.totalscore || 100
      ),
      timeSeriesData: this.generateTimeSeriesData(responses, startDate, now),
      performanceMetrics: this.generatePerformanceMetrics(responses, questions),
    };
  }

  static async getResponseAnalytics(
    formId: string,
    responses: any[],
    form: any
  ) {
    const analytics: any = {};

    if (form.contentIds && Array.isArray(form.contentIds)) {
      for (const content of form.contentIds) {
        const contentObj = content as any;
        const questionId = contentObj._id.toString();

        const questionResponses = responses
          .map((response) =>
            response.responseset.find(
              (r: any) => r.questionId.toString() === questionId
            )
          )
          .filter(Boolean);

        if (["multiple", "checkbox", "selection"].includes(contentObj.type)) {
          analytics[questionId] = this.analyzeChoiceQuestion(
            contentObj,
            questionResponses
          );
        } else if (["rangedate", "rangenumber"].includes(contentObj.type)) {
          analytics[questionId] = this.analyzeRangeQuestion(
            contentObj,
            questionResponses
          );
        }
      }
    }

    return analytics;
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

  private static calculateBasicMetrics(responses: any[]) {
    const totalResponses = responses.length;
    const completedResponses = responses.filter(
      (r) => r.completionStatus === "completed"
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

  private static async generateQuestionAnalytics(
    responses: any[],
    questions: any[]
  ) {
    return Promise.all(
      questions.map(async (question) => {
        const questionResponses = responses.filter((r) =>
          r.responseset.some(
            (rs: any) => rs.questionId.toString() === question._id?.toString()
          )
        );

        const questionResponsesData = questionResponses
          .map((r) =>
            r.responseset.find(
              (rs: any) => rs.questionId.toString() === question._id?.toString()
            )
          )
          .filter(Boolean);

        const correctResponses = questionResponsesData.filter(
          (r) => r?.score && r.score > 0
        ).length;

        const accuracy =
          questionResponsesData.length > 0
            ? (correctResponses / questionResponsesData.length) * 100
            : 0;

        const avgScore =
          questionResponsesData.reduce((sum, r) => sum + (r?.score || 0), 0) /
            questionResponsesData.length || 0;

        const responseDistribution = this.generateResponseDistribution(
          questionResponsesData,
          question
        );

        return {
          questionId: question._id?.toString() || "",
          questionTitle:
            typeof question.title === "string" ? question.title : "Question",
          questionType: question.type,
          totalResponses: questionResponsesData.length,
          correctResponses,
          accuracy,
          averageScore: avgScore,
          responseDistribution,
          commonAnswers: responseDistribution
            .map((r: any) => r.option)
            .slice(0, 5),
        };
      })
    );
  }

  private static analyzeChoiceQuestion(
    contentObj: any,
    questionResponses: any[]
  ) {
    const answerCounts: { [key: string]: number } = {};

    questionResponses.forEach((response) => {
      if (response) {
        if (Array.isArray(response.response)) {
          response.response.forEach((answer: any) => {
            const key = answer.toString();
            answerCounts[key] = (answerCounts[key] || 0) + 1;
          });
        } else {
          const key = response.response.toString();
          answerCounts[key] = (answerCounts[key] || 0) + 1;
        }
      }
    });

    return {
      type: contentObj.type,
      title: contentObj.title,
      totalResponses: questionResponses.length,
      answerCounts,
      chartData: Object.entries(answerCounts).map(([answer, count]) => ({
        answer,
        count,
        percentage: (
          ((count as number) / questionResponses.length) *
          100
        ).toFixed(1),
      })),
    };
  }

  private static analyzeRangeQuestion(
    contentObj: any,
    questionResponses: any[]
  ) {
    const ranges = questionResponses
      .map((response) => response?.response)
      .filter(Boolean);

    return {
      type: contentObj.type,
      title: contentObj.title,
      totalResponses: questionResponses.length,
      ranges,
    };
  }

  private static generateResponseDistribution(responses: any[], question: any) {
    const distribution: { [key: string]: number } = {};

    responses.forEach((response) => {
      if (response?.response) {
        const answer = Array.isArray(response.response)
          ? response.response.join(", ")
          : response.response.toString();
        distribution[answer] = (distribution[answer] || 0) + 1;
      }
    });

    return Object.entries(distribution)
      .map(([option, count]) => ({
        option,
        count,
        percentage: (count / responses.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private static generateScoreDistribution(responses: any[], maxScore: number) {
    const ranges = [
      { min: 0, max: 0.2 * maxScore, label: "0-20%" },
      { min: 0.2 * maxScore, max: 0.4 * maxScore, label: "21-40%" },
      { min: 0.4 * maxScore, max: 0.6 * maxScore, label: "41-60%" },
      { min: 0.6 * maxScore, max: 0.8 * maxScore, label: "61-80%" },
      { min: 0.8 * maxScore, max: maxScore, label: "81-100%" },
    ];

    return ranges.map((range) => {
      const count = responses.filter(
        (r) =>
          (r.totalScore || 0) >= range.min && (r.totalScore || 0) <= range.max
      ).length;

      return {
        scoreRange: range.label,
        count,
        percentage: responses.length > 0 ? (count / responses.length) * 100 : 0,
      };
    });
  }

  private static generateTimeSeriesData(
    responses: any[],
    startDate: Date,
    endDate: Date
  ) {
    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const data = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dayEnd = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1
      );

      const dayResponses = responses.filter(
        (r) => r.createdAt >= dayStart && r.createdAt < dayEnd
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
    responses: any[],
    questions: any[]
  ) {
    const topPerformers = responses
      .filter(
        (r) =>
          (r.respondentName ||
            r.guest?.name ||
            r.respondentEmail ||
            r.guest?.email) &&
          (r.respondentEmail || r.guest?.email)
      )
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 5)
      .map((r) => ({
        name: getResponseDisplayName(r),
        email: r.respondentEmail || r.guest?.email,
        score: r.totalScore || 0,
        completionTime: 8, // Mock completion time
      }));

    const difficultQuestions = questions
      .map((q) => {
        const questionResponses = responses.filter((r) =>
          r.responseset.some(
            (rs: any) => rs.questionId.toString() === q._id?.toString()
          )
        );

        const correctCount = questionResponses.filter((r) => {
          const questionResponse = r.responseset.find(
            (rs: any) => rs.questionId.toString() === q._id?.toString()
          );
          return (
            questionResponse &&
            questionResponse.score &&
            questionResponse.score > 0
          );
        }).length;

        const accuracy =
          questionResponses.length > 0
            ? (correctCount / questionResponses.length) * 100
            : 0;

        const avgScore =
          questionResponses.reduce((sum, r) => {
            const questionResponse = r.responseset.find(
              (rs: any) => rs.questionId.toString() === q._id?.toString()
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
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return { topPerformers, difficultQuestions };
  }

  static generateCSVData(analyticsData: any, responses: any[]): string {
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
        response.respondentEmail || response.guest?.email || "N/A",
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
}
