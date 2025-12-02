import { Types } from "mongoose";
import FormResponse from "../model/Response.model";
import Content, { QuestionType } from "../model/Content.model";
import Form from "../model/Form.model";
import { getResponseDisplayName } from "../utilities/respondentUtils";

// Graph types for analytics visualization
export enum GraphType {
  BAR = "bar",
  PIE = "pie",
  LINE = "line",
  DOUGHNUT = "doughnut",
  HORIZONTAL_BAR = "horizontalBar",
}

// Interface for analytics data that supports multiple graph types
export interface MultiGraphAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  totalResponses: number;
  availableGraphTypes: GraphType[];
  barChart?: BarChartData;
  pieChart?: PieChartData;
  horizontalBarChart?: BarChartData;
  doughnutChart?: PieChartData;
  rawData: ChoiceDistribution[];
}

export interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

export interface PieChartData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

export interface ChoiceDistribution {
  choiceIdx: number;
  choiceContent: string;
  count: number;
  percentage: number;
  color: string;
}

export class ResponseAnalyticsService {
  // Color palette for charts
  private static readonly CHART_COLORS = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#FF6384",
    "#C9CBCF",
    "#4BC0C0",
    "#FF9F40",
    "#36A2EB",
    "#FFCE56",
    "#9966FF",
    "#FF6384",
    "#4BC0C0",
    "#FF9F40",
    "#36A2EB",
    "#FFCE56",
    "#9966FF",
    "#C9CBCF",
  ];

  /**
   * Get comprehensive analytics for choice questions with multiple graph types
   * Supports: Multiple Choice, Checkbox, Selection questions
   */
  static async getChoiceQuestionAnalytics(
    formId: string,
    questionId?: string
  ): Promise<MultiGraphAnalytics[]> {
    const form = await Form.findById(formId).populate("contentIds");
    if (!form) {
      throw new Error("Form not found");
    }

    // Get all responses for the form
    const responses = await FormResponse.find({
      formId: new Types.ObjectId(formId),
    }).lean();

    const questions = questionId
      ? await Content.find({
          _id: new Types.ObjectId(questionId),
          formId: new Types.ObjectId(formId),
        })
      : await Content.find({
          formId: new Types.ObjectId(formId),
          type: {
            $in: [
              QuestionType.MultipleChoice,
              QuestionType.CheckBox,
              QuestionType.Selection,
            ],
          },
        });

    const analytics: MultiGraphAnalytics[] = [];

    for (const question of questions) {
      if (
        ![
          QuestionType.MultipleChoice,
          QuestionType.CheckBox,
          QuestionType.Selection,
        ].includes(question.type as QuestionType)
      ) {
        continue;
      }

      const questionAnalytics = await this.generateMultiGraphAnalytics(
        question,
        responses
      );
      analytics.push(questionAnalytics);
    }

    return analytics;
  }

  /**
   * Generate analytics data for multiple graph types for a single choice question
   */
  private static async generateMultiGraphAnalytics(
    question: any,
    responses: any[]
  ): Promise<MultiGraphAnalytics> {
    const questionId = question._id.toString();

    // Get the choice options based on question type
    const choices =
      question.multiple || question.checkbox || question.selection || [];

    // Extract responses for this question
    const questionResponses = responses
      .map((response) => {
        const responseSet = response.responseset.find(
          (rs: any) => rs.question.toString() === questionId
        );
        return responseSet;
      })
      .filter(Boolean);

    // Count responses for each choice
    const choiceDistribution = this.calculateChoiceDistribution(
      choices,
      questionResponses
    );

    // Generate different graph formats
    const barChart = this.generateBarChartData(choiceDistribution, question);
    const pieChart = this.generatePieChartData(choiceDistribution, question);
    const horizontalBarChart = this.generateHorizontalBarChartData(
      choiceDistribution,
      question
    );
    const doughnutChart = this.generateDoughnutChartData(
      choiceDistribution,
      question
    );

    // Extract question title
    const questionTitle = this.extractQuestionTitle(question.title);

    return {
      questionId,
      questionTitle,
      questionType: question.type,
      totalResponses: questionResponses.length,
      availableGraphTypes: [
        GraphType.BAR,
        GraphType.PIE,
        GraphType.HORIZONTAL_BAR,
        GraphType.DOUGHNUT,
      ],
      barChart,
      pieChart,
      horizontalBarChart,
      doughnutChart,
      rawData: choiceDistribution,
    };
  }

  /**
   * Calculate distribution of choices with counts and percentages
   */
  private static calculateChoiceDistribution(
    choices: any[],
    questionResponses: any[]
  ): ChoiceDistribution[] {
    const totalResponses = questionResponses.length;
    const choiceCounts = new Map<number, number>();

    // Initialize counts for all choices
    choices.forEach((choice) => {
      choiceCounts.set(choice.idx, 0);
    });

    // Count responses
    questionResponses.forEach((response) => {
      if (!response?.response) return;

      const responseValue = response.response;

      // Handle both single and multiple selections
      if (Array.isArray(responseValue)) {
        responseValue.forEach((idx: number) => {
          choiceCounts.set(idx, (choiceCounts.get(idx) || 0) + 1);
        });
      } else if (typeof responseValue === "number") {
        choiceCounts.set(
          responseValue,
          (choiceCounts.get(responseValue) || 0) + 1
        );
      } else if (typeof responseValue === "object" && "key" in responseValue) {
        // Handle ResponseAnswerReturnType format
        const key = responseValue.key;
        if (Array.isArray(key)) {
          key.forEach((idx: number) => {
            choiceCounts.set(idx, (choiceCounts.get(idx) || 0) + 1);
          });
        } else {
          choiceCounts.set(key, (choiceCounts.get(key) || 0) + 1);
        }
      }
    });

    // Generate distribution data
    return choices.map((choice, index) => {
      const count = choiceCounts.get(choice.idx) || 0;
      const percentage =
        totalResponses > 0 ? (count / totalResponses) * 100 : 0;

      return {
        choiceIdx: choice.idx,
        choiceContent: choice.content,
        count,
        percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
        color: this.CHART_COLORS[index % this.CHART_COLORS.length],
      };
    });
  }

  /**
   * Generate Bar Chart data
   */
  private static generateBarChartData(
    distribution: ChoiceDistribution[],
    question: any
  ): BarChartData {
    return {
      labels: distribution.map((d) => d.choiceContent),
      datasets: [
        {
          label: "Response Count",
          data: distribution.map((d) => d.count),
          backgroundColor: distribution.map((d) => d.color + "CC"), // Add transparency
          borderColor: distribution.map((d) => d.color),
          borderWidth: 2,
        },
      ],
    };
  }

  /**
   * Generate Pie Chart data
   */
  private static generatePieChartData(
    distribution: ChoiceDistribution[],
    question: any
  ): PieChartData {
    // Filter out zero counts for cleaner pie chart
    const nonZeroData = distribution.filter((d) => d.count > 0);

    return {
      labels: nonZeroData.map((d) => d.choiceContent),
      datasets: [
        {
          data: nonZeroData.map((d) => d.count),
          backgroundColor: nonZeroData.map((d) => d.color + "CC"),
          borderColor: nonZeroData.map((d) => d.color),
          borderWidth: 2,
        },
      ],
    };
  }

  /**
   * Generate Horizontal Bar Chart data
   */
  private static generateHorizontalBarChartData(
    distribution: ChoiceDistribution[],
    question: any
  ): BarChartData {
    // Sort by count for better visualization
    const sorted = [...distribution].sort((a, b) => b.count - a.count);

    return {
      labels: sorted.map((d) => d.choiceContent),
      datasets: [
        {
          label: "Response Count",
          data: sorted.map((d) => d.count),
          backgroundColor: sorted.map((d) => d.color + "CC"),
          borderColor: sorted.map((d) => d.color),
          borderWidth: 2,
        },
      ],
    };
  }

  /**
   * Generate Doughnut Chart data (similar to pie but with hole in center)
   */
  private static generateDoughnutChartData(
    distribution: ChoiceDistribution[],
    question: any
  ): PieChartData {
    // Filter out zero counts
    const nonZeroData = distribution.filter((d) => d.count > 0);

    return {
      labels: nonZeroData.map(
        (d) => `${d.choiceContent} (${d.percentage.toFixed(1)}%)`
      ),
      datasets: [
        {
          data: nonZeroData.map((d) => d.count),
          backgroundColor: nonZeroData.map((d) => d.color + "DD"),
          borderColor: nonZeroData.map((d) => d.color),
          borderWidth: 2,
        },
      ],
    };
  }

  /**
   * Extract plain text from ContentTitle structure
   */
  private static extractQuestionTitle(title: any): string {
    if (typeof title === "string") {
      return title;
    }

    if (title && typeof title === "object") {
      // Handle TipTap/ProseMirror JSON structure
      if (title.content && Array.isArray(title.content)) {
        return title.content
          .map((node: any) => {
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
    const choices =
      contentObj.multiple || contentObj.checkbox || contentObj.selection || [];

    const answerCounts: { [key: string]: number } = {};

    questionResponses.forEach((response) => {
      if (response) {
        if (Array.isArray(response.response)) {
          response.response.forEach((answer: any) => {
            const key = answer.toString();
            answerCounts[key] = (answerCounts[key] || 0) + 1;
          });
        } else if (
          typeof response.response === "object" &&
          "key" in response.response
        ) {
          // Handle ResponseAnswerReturnType
          const key = response.response.key;
          if (Array.isArray(key)) {
            key.forEach((idx: number) => {
              answerCounts[idx.toString()] =
                (answerCounts[idx.toString()] || 0) + 1;
            });
          } else {
            answerCounts[key.toString()] =
              (answerCounts[key.toString()] || 0) + 1;
          }
        } else {
          const key = response.response.toString();
          answerCounts[key] = (answerCounts[key] || 0) + 1;
        }
      }
    });

    // Generate chart data with choice labels
    const chartData = Object.entries(answerCounts).map(([answer, count]) => {
      const choiceIdx = parseInt(answer);
      const choice = choices.find((c: any) => c.idx === choiceIdx);
      const percentage = ((count as number) / questionResponses.length) * 100;

      return {
        answer: choice?.content || answer,
        answerIdx: choiceIdx,
        count,
        percentage: percentage.toFixed(1),
      };
    });

    // Generate multi-graph format
    const labels = chartData.map((d) => d.answer);
    const data = chartData.map((d) => d.count);
    const colors = chartData.map(
      (_, idx) => this.CHART_COLORS[idx % this.CHART_COLORS.length]
    );

    return {
      type: contentObj.type,
      title: this.extractQuestionTitle(contentObj.title),
      totalResponses: questionResponses.length,
      answerCounts,
      chartData,
      // Multiple graph formats
      graphs: {
        barChart: {
          labels,
          datasets: [
            {
              label: "Response Count",
              data,
              backgroundColor: colors.map((c) => c + "CC"),
              borderColor: colors,
              borderWidth: 2,
            },
          ],
        },
        pieChart: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors.map((c) => c + "CC"),
              borderColor: colors,
              borderWidth: 2,
            },
          ],
        },
        horizontalBarChart: {
          labels,
          datasets: [
            {
              label: "Response Count",
              data,
              backgroundColor: colors.map((c) => c + "CC"),
              borderColor: colors,
              borderWidth: 2,
            },
          ],
        },
        doughnutChart: {
          labels: labels.map(
            (label, idx) => `${label} (${chartData[idx].percentage}%)`
          ),
          datasets: [
            {
              data,
              backgroundColor: colors.map((c) => c + "DD"),
              borderColor: colors,
              borderWidth: 2,
            },
          ],
        },
      },
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
