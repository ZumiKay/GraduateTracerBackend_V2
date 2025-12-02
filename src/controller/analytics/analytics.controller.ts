import { Response } from "express";
import { CustomRequest } from "../../types/customType";
import {
  AddQuestionNumbering,
  groupContentByParent,
  ReturnCode,
} from "../../utilities/helper";
import { GetAnalyticsParamType } from "./analytics.type";
import { isValidObjectIdString } from "../../utilities/formHelpers";
import { ResponseAnalyticsService } from "../../services/ResponseAnalyticsService";
import { ResponseValidationService } from "../../services/ResponseValidationService";
import Content, {
  ChoiceQuestionType,
  ContentType,
  QuestionType,
} from "../../model/Content.model";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
} from "../../model/Response.model";
import Form, { FormType } from "../../model/Form.model";
import { RootFilterQuery, Types } from "mongoose";

// Extended response type for analytics
type ExtendedResponseSet = ResponseSetType & {
  respondentId: Types.ObjectId;
  respondentName: string;
  respondentEmail: string | null;
  submittedAt: Date | undefined;
};

// Base data type for question analytics
interface QuestionBaseData {
  id: string;
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  questionIndex: number | undefined;
  totalResponses: number;
  responseRate: number;
}

class AnalyticsController {
  public GetAnalyticsData = async (req: CustomRequest, res: Response) => {
    //Process Request Params
    const query = this.ValidateParamData(
      req.query as unknown as GetAnalyticsParamType
    );
    if (!query) return res.status(400).json(ReturnCode(400));

    //Verify user
    const user = req.user;
    if (!user) return res.status(403).json(ReturnCode(403));

    try {
      const { formId, page, questionId } = query;

      // Verify form exists and validate access (only creator and owners can access analytics)
      const form = await ResponseValidationService.validateFormAccess(
        formId,
        user.sub,
        res
      );
      if (!form) {
        return; // Response already sent by validateFormAccess
      }

      // Get all responses for the form
      const responses = await FormResponse.find({
        formId: new Types.ObjectId(formId),
      })
        .lean()
        .sort({ createdAt: -1 });

      if (!responses || responses.length === 0) {
        return res.status(204).json({
          data: {
            isResponse: false,
          },
        });
      }

      // Get questions for the specified page or all questions
      const questionFilter: RootFilterQuery<FormResponseType> = {
        formId: new Types.ObjectId(formId),
      };

      if (page && page > 0) {
        questionFilter.page = page;
      }

      if (questionId && isValidObjectIdString(questionId)) {
        questionFilter._id = new Types.ObjectId(questionId);
      }

      let questions = await Content.find(questionFilter)
        .sort({ qIdx: 1 })
        .lean();

      if (questions.length === 0) {
        return res.status(404).json(ReturnCode(404, "No questions found"));
      }

      //Add label numbering
      questions = AddQuestionNumbering({
        questions: questions as unknown as Array<ContentType>,
      }) as never;

      // Process analytics for each question based on type
      const analyticsData = await Promise.all(
        questions.map(async (question) => {
          return await this.ProcessQuestionAnalytics(question, responses);
        })
      );

      // Calculate overall form statistics
      const formStats = this.CalculateFormStats(responses, form);

      // Return structured analytics data
      return res.status(200).json({
        success: true,
        data: {
          formId,
          formTitle: form.title,
          page,
          totalResponses: responses.length,
          formStats,
          questions: analyticsData.filter(Boolean),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.log("Get Analytics Data", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  /**
   * Process analytics for a single question based on its type
   */
  private ProcessQuestionAnalytics = async (
    question: ContentType,
    responses: Array<FormResponseType>
  ) => {
    if (!question._id) return;

    const id = question._id.toString();
    const questionType = question.type as QuestionType;

    // Extract responses for this specific question
    const questionResponses: ExtendedResponseSet[] = responses
      .map((response) => {
        const responseSet = response.responseset.find((rs: ResponseSetType) => {
          const questionRef =
            typeof rs.question === "string"
              ? rs.question
              : rs.question.toString();
          return questionRef === id;
        });
        return responseSet
          ? {
              ...responseSet,
              respondentId: response._id,
              respondentName: response.respondentName || "Anonymous",
              respondentEmail: response.respondentEmail || null,
              submittedAt: response.submittedAt,
            }
          : null;
      })
      .filter((r): r is ExtendedResponseSet => r !== null);

    const baseData: QuestionBaseData = {
      id,
      questionId: question.questionId as string,
      questionTitle: ResponseAnalyticsService["extractQuestionTitle"](
        question.title
      ),
      questionType,
      questionIndex: question.qIdx,
      totalResponses: questionResponses.length,
      responseRate:
        responses.length > 0
          ? (questionResponses.length / responses.length) * 100
          : 0,
    };

    // Process based on question type
    switch (questionType) {
      case QuestionType.MultipleChoice:
      case QuestionType.CheckBox:
      case QuestionType.Selection:
        return this.ProcessChoiceQuestion(
          question,
          questionResponses,
          baseData
        );

      case QuestionType.RangeDate:
      case QuestionType.RangeNumber:
        return this.ProcessRangeQuestion(question, questionResponses, baseData);

      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
        return this.ProcessTextQuestion(questionResponses, baseData);

      case QuestionType.Number:
        return this.ProcessNumberQuestion(questionResponses, baseData);

      case QuestionType.Date:
        return this.ProcessDateQuestion(questionResponses, baseData);

      default:
        return {
          ...baseData,
          analytics: {
            message: "Analytics not available for this question type",
          },
        };
    }
  };

  /**
   * Process choice-based questions (Multiple Choice, Checkbox, Selection)
   */
  private ProcessChoiceQuestion = (
    question: ContentType,
    questionResponses: ExtendedResponseSet[],
    baseData: QuestionBaseData
  ) => {
    const choices = question?.[
      question.type as keyof ContentType
    ] as ChoiceQuestionType[];

    const choiceCounts = new Map<number, number>();
    const choiceCorrect = new Map<number, number>();

    // Initialize counts
    choices?.forEach((choice) => {
      if (choice) {
        choiceCounts.set(choice.idx, 0);
        choiceCorrect.set(choice.idx, 0);
      }
    });

    // Get correct answer(s) for validation
    const correctAnswers = new Set<number>();
    if (
      question.answer?.answer !== undefined &&
      question.answer?.answer !== null
    ) {
      const answerValue = question.answer.answer;
      if (Array.isArray(answerValue)) {
        answerValue.forEach((idx) => correctAnswers.add(idx));
      } else if (typeof answerValue === "number") {
        correctAnswers.add(answerValue);
      }
    }

    // Count responses and track correct answers
    questionResponses.forEach((response) => {
      if (!response?.response) return;

      const responseValue = response.response;
      const score = response.score || 0;
      const maxScore = question.score || 0;

      // For checkbox (multiple selections), user gets full score only when selecting ALL correct answers
      // For multiple choice/selection (single selection), score === maxScore means correct
      const isFullScore = score === maxScore;

      // Handle different response formats
      const selectedIndices: number[] = [];

      if (Array.isArray(responseValue)) {
        selectedIndices.push(...responseValue);
      } else if (typeof responseValue === "number") {
        selectedIndices.push(responseValue);
      } else if (typeof responseValue === "object" && "key" in responseValue) {
        const key = responseValue.key;
        if (Array.isArray(key)) {
          selectedIndices.push(...key);
        } else {
          selectedIndices.push(key);
        }
      }

      // Count selections
      selectedIndices.forEach((idx) => {
        choiceCounts.set(idx, (choiceCounts.get(idx) || 0) + 1);
        // Only count as "correct" if the user achieved full score
        if (isFullScore) {
          choiceCorrect.set(idx, (choiceCorrect.get(idx) || 0) + 1);
        }
      });
    });

    // Generate distribution data
    const distribution = choices.map((choice) => {
      const count = choiceCounts.get(choice.idx) || 0;
      const correctCount = choiceCorrect.get(choice.idx) || 0;
      const percentage =
        questionResponses.length > 0
          ? (count / questionResponses.length) * 100
          : 0;

      return {
        choiceIdx: choice.idx,
        choiceContent: choice.content,
        count,
        percentage: Math.round(percentage * 100) / 100,
        correctCount, // How many times this choice was selected in a fully correct answer
        isCorrectAnswer: correctAnswers.has(choice.idx), // Whether this choice is part of the correct answer(s)
      };
    });

    // Calculate how many responses got full marks
    const fullScoreCount = questionResponses.filter(
      (r) => (r.score || 0) === (question.score || 0)
    ).length;

    // Calculate average score
    const avgScore =
      questionResponses.length > 0
        ? questionResponses.reduce((sum, r) => sum + (r.score || 0), 0) /
          questionResponses.length
        : 0;

    // Generate graph data
    const colors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
    ];
    const labels = distribution.map((d) => d.choiceContent);
    const data = distribution.map((d) => d.count);
    const chartColors = distribution.map(
      (_, idx: number) => colors[idx % colors.length]
    );

    return {
      ...baseData,
      analytics: {
        distribution,
        correctAnswerRate:
          questionResponses.length > 0
            ? (fullScoreCount / questionResponses.length) * 100
            : 0,
        averageScore: Math.round(avgScore * 100) / 100,
        maxScore: question.score || 0,
        totalCorrectAnswers: fullScoreCount, // How many respondents got full marks
        hasCorrectAnswer: correctAnswers.size > 0, // Whether this question has defined correct answer(s)
        graphs: {
          bar: {
            labels,
            datasets: [
              {
                label: "Response Count",
                data,
                backgroundColor: chartColors.map((c: string) => c + "CC"),
                borderColor: chartColors,
                borderWidth: 2,
              },
            ],
          },
          doughnut: {
            labels: labels.map(
              (label: string, idx: number) =>
                `${label} (${distribution[idx].percentage.toFixed(1)}%)`
            ),
            datasets: [
              {
                data,
                backgroundColor: chartColors.map((c: string) => c + "DD"),
                borderColor: chartColors,
                borderWidth: 2,
              },
            ],
          },
        },
        recommendedGraphs: ["bar", "doughnut"],
      },
    };
  };

  /**
   * Process range questions (RangeDate, RangeNumber)
   */
  private ProcessRangeQuestion = (
    question: ContentType,
    questionResponses: ExtendedResponseSet[],
    baseData: QuestionBaseData
  ) => {
    const values: number[] = [];
    const scatterData: {
      x: number;
      y: number;
      startValue: string | number;
      endValue: string | number;
    }[] = [];

    questionResponses.forEach((response) => {
      if (!response?.response) return;

      const value = response.response as {
        start: string | number;
        end: string | number;
      };

      if (question.type === QuestionType.RangeDate) {
        if (
          value &&
          typeof value === "object" &&
          "start" in value &&
          "end" in value
        ) {
          const startDate = new Date(value.start);
          const endDate = new Date(value.end);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            scatterData.push({
              x: startDate.getTime(),
              y: endDate.getTime(),
              startValue: value.start,
              endValue: value.end,
            });
            values.push(startDate.getTime());
            values.push(endDate.getTime());
          }
        }
      } else if (question.type === QuestionType.RangeNumber) {
        //Process number data
        if (
          value &&
          typeof value === "object" &&
          "start" in value &&
          "end" in value
        ) {
          const startNum =
            typeof value.start === "number"
              ? value.start
              : typeof value.start === "string"
              ? parseFloat(value.start)
              : NaN;
          const endNum =
            typeof value.end === "number"
              ? value.end
              : typeof value.end === "string"
              ? parseFloat(value.end)
              : NaN;
          if (!isNaN(startNum) && !isNaN(endNum)) {
            scatterData.push({
              x: startNum,
              y: endNum,
              startValue: value.start,
              endValue: value.end,
            });
            values.push(startNum);
            values.push(endNum);
          }
        }
      }
    });

    //If no response
    if (values.length === 0) {
      return {
        ...baseData,
        analytics: {
          statistics: null,
          message: "No valid responses",
        },
      };
    }

    values.sort((a, b) => a - b);

    // Calculate statistics and process for graph
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];

    // Generate histogram
    const numBins = Math.min(10, Math.ceil(Math.log2(values.length) + 1));
    const binWidth = max === min ? 1 : (max - min) / numBins;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      min: min + i * binWidth,
      max: min + (i + 1) * binWidth,
      count: 0,
      label: "",
    }));

    values.forEach((value) => {
      if (max === min) {
        // All values are the same, put them all in the first bin
        bins[0].count++;
      } else {
        const binIndex = Math.min(
          Math.floor((value - min) / binWidth),
          numBins - 1
        );
        bins[binIndex].count++;
      }
    });

    // Format labels
    bins.forEach((bin) => {
      if (question.type === QuestionType.RangeDate) {
        bin.label = `${new Date(bin.min).toLocaleDateString()} - ${new Date(
          bin.max
        ).toLocaleDateString()}`;
      } else {
        bin.label = `${Math.round(bin.min)}-${Math.round(bin.max)}`;
      }
    });

    return {
      ...baseData,
      analytics: {
        statistics: {
          min:
            question.type === QuestionType.RangeDate
              ? new Date(min).toISOString()
              : min,
          max:
            question.type === QuestionType.RangeDate
              ? new Date(max).toISOString()
              : max,
          mean:
            question.type === QuestionType.RangeDate
              ? new Date(mean).toISOString()
              : Math.round(mean * 100) / 100,
          median:
            question.type === QuestionType.RangeDate
              ? new Date(median).toISOString()
              : Math.round(median * 100) / 100,
          range: max - min,
        },
        histogram: {
          bins,
          labels: bins.map((b) => b.label),
          datasets: [
            {
              label: "Frequency",
              data: bins.map((b) => b.count),
              backgroundColor: "#36A2EB" + "CC",
              borderColor: "#36A2EB",
              borderWidth: 2,
            },
          ],
        },
        scatter: {
          data: scatterData,
          datasets: [
            {
              label: "Start vs End Values",
              data: scatterData,
              backgroundColor: "#FF6384CC",
              borderColor: "#FF6384",
              borderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
            },
          ],
          xAxisLabel:
            question.type === QuestionType.RangeDate
              ? "Start Date"
              : "Start Value",
          yAxisLabel:
            question.type === QuestionType.RangeDate ? "End Date" : "End Value",
        },
        recommendedGraphs: ["bar", "line", "scatter"],
      },
    };
  };

  /**
   * Process text questions (ShortAnswer, Paragraph)
   */
  private ProcessTextQuestion = (
    questionResponses: ExtendedResponseSet[],
    baseData: QuestionBaseData
  ) => {
    const textResponses: string[] = questionResponses
      .map((r) => (typeof r?.response === "string" ? r.response.trim() : ""))
      .filter((text) => text.length > 0);

    if (textResponses.length === 0) {
      return {
        ...baseData,
        analytics: {
          textMetrics: null,
          message: "No text responses",
        },
      };
    }

    // Calculate text metrics
    const lengths = textResponses.map((r) => r.length);
    const wordCounts = textResponses.map(
      (r) => r.split(/\s+/).filter(Boolean).length
    );

    const textMetrics = {
      averageLength: Math.round(
        lengths.reduce((sum, len) => sum + len, 0) / lengths.length
      ),
      averageWordCount: Math.round(
        wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length
      ),
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
    };

    // Word frequency
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
    ]);
    const wordCount = new Map<string, number>();

    textResponses.forEach((response) => {
      const words = response
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

      words.forEach((word) => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      });
    });

    const topWords = Array.from(wordCount.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Sample responses
    const sampleResponses = textResponses.slice(0, 5).map((text, idx) => ({
      id: idx + 1,
      response: text.length > 200 ? text.substring(0, 200) + "..." : text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      characterCount: text.length,
    }));

    return {
      ...baseData,
      analytics: {
        textMetrics,
        topWords,
        sampleResponses,
        totalUniqueWords: wordCount.size,
      },
    };
  };

  /**
   * Process number questions
   */
  private ProcessNumberQuestion = (
    questionResponses: ExtendedResponseSet[],
    baseData: QuestionBaseData
  ) => {
    const numbers: number[] = questionResponses
      .map((r) => {
        const val = r?.response;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      })
      .filter((n): n is number => n !== null);

    if (numbers.length === 0) {
      return {
        ...baseData,
        analytics: { statistics: null, message: "No valid numbers" },
      };
    }

    numbers.sort((a, b) => a - b);
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const mid = Math.floor(numbers.length / 2);
    const median =
      numbers.length % 2 === 0
        ? (numbers[mid - 1] + numbers[mid]) / 2
        : numbers[mid];

    return {
      ...baseData,
      analytics: {
        statistics: {
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          mean: Math.round(mean * 100) / 100,
          median: Math.round(median * 100) / 100,
        },
      },
    };
  };

  /**
   * Process date questions
   */
  private ProcessDateQuestion = (
    questionResponses: ExtendedResponseSet[],
    baseData: QuestionBaseData
  ) => {
    const dates: Date[] = questionResponses
      .map((r) => {
        const response = r?.response;
        if (typeof response === "string" || typeof response === "number") {
          return new Date(response);
        }
        return null;
      })
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    if (dates.length === 0) {
      return {
        ...baseData,
        analytics: { statistics: null, message: "No valid dates" },
      };
    }

    dates.sort((a, b) => a.getTime() - b.getTime());

    return {
      ...baseData,
      analytics: {
        statistics: {
          earliest: dates[0].toISOString(),
          latest: dates[dates.length - 1].toISOString(),
          mostCommon: dates[Math.floor(dates.length / 2)].toISOString(),
        },
      },
    };
  };

  /**
   * Calculate overall form statistics
   */
  private CalculateFormStats = (
    responses: Array<FormResponseType>,
    form: FormType
  ) => {
    const completedResponses = responses.filter(
      (r) => r.completionStatus === "completed"
    ).length;

    const averageScore =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
          responses.length
        : 0;

    return {
      totalResponses: responses.length,
      completedResponses,
      partialResponses: responses.length - completedResponses,
      completionRate:
        responses.length > 0
          ? (completedResponses / responses.length) * 100
          : 0,
      averageScore: Math.round(averageScore * 100) / 100,
      maxPossibleScore: form.totalscore || 0,
    };
  };

  private ValidateParamData = (data: GetAnalyticsParamType) => {
    const isFormId = data.formId && isValidObjectIdString(data.formId);
    const isPageNumber = data.page ? !isNaN(Number(data.page)) : true;

    if (!isFormId || !isPageNumber) return;

    return {
      ...data,
      page: data.page ? Number(data.page) : undefined,
      period: data.period || "7d",
    };
  };
}

export default new AnalyticsController();
