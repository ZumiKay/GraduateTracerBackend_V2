"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseAnalyticsService = exports.GraphType = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const respondentUtils_1 = require("../utilities/respondentUtils");
// Graph types for analytics visualization
var GraphType;
(function (GraphType) {
    GraphType["BAR"] = "bar";
    GraphType["PIE"] = "pie";
    GraphType["LINE"] = "line";
    GraphType["DOUGHNUT"] = "doughnut";
    GraphType["HORIZONTAL_BAR"] = "horizontalBar";
})(GraphType || (exports.GraphType = GraphType = {}));
class ResponseAnalyticsService {
    /**
     * Get comprehensive analytics for choice questions with multiple graph types
     * Supports: Multiple Choice, Checkbox, Selection questions
     */
    static getChoiceQuestionAnalytics(formId, questionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = yield Form_model_1.default.findById(formId).populate("contentIds");
            if (!form) {
                throw new Error("Form not found");
            }
            // Get all responses for the form
            const responses = yield Response_model_1.default.find({
                formId: new mongoose_1.Types.ObjectId(formId),
            }).lean();
            const questions = questionId
                ? yield Content_model_1.default.find({
                    _id: new mongoose_1.Types.ObjectId(questionId),
                    formId: new mongoose_1.Types.ObjectId(formId),
                })
                : yield Content_model_1.default.find({
                    formId: new mongoose_1.Types.ObjectId(formId),
                    type: {
                        $in: [
                            Content_model_1.QuestionType.MultipleChoice,
                            Content_model_1.QuestionType.CheckBox,
                            Content_model_1.QuestionType.Selection,
                        ],
                    },
                });
            const analytics = [];
            for (const question of questions) {
                if (![
                    Content_model_1.QuestionType.MultipleChoice,
                    Content_model_1.QuestionType.CheckBox,
                    Content_model_1.QuestionType.Selection,
                ].includes(question.type)) {
                    continue;
                }
                const questionAnalytics = yield this.generateMultiGraphAnalytics(question, responses);
                analytics.push(questionAnalytics);
            }
            return analytics;
        });
    }
    /**
     * Generate analytics data for multiple graph types for a single choice question
     */
    static generateMultiGraphAnalytics(question, responses) {
        return __awaiter(this, void 0, void 0, function* () {
            const questionId = question._id.toString();
            // Get the choice options based on question type
            const choices = question.multiple || question.checkbox || question.selection || [];
            // Extract responses for this question
            const questionResponses = responses
                .map((response) => {
                const responseSet = response.responseset.find((rs) => rs.question.toString() === questionId);
                return responseSet;
            })
                .filter(Boolean);
            // Count responses for each choice
            const choiceDistribution = this.calculateChoiceDistribution(choices, questionResponses);
            // Generate different graph formats
            const barChart = this.generateBarChartData(choiceDistribution, question);
            const pieChart = this.generatePieChartData(choiceDistribution, question);
            const horizontalBarChart = this.generateHorizontalBarChartData(choiceDistribution, question);
            const doughnutChart = this.generateDoughnutChartData(choiceDistribution, question);
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
        });
    }
    /**
     * Calculate distribution of choices with counts and percentages
     */
    static calculateChoiceDistribution(choices, questionResponses) {
        const totalResponses = questionResponses.length;
        const choiceCounts = new Map();
        // Initialize counts for all choices
        choices.forEach((choice) => {
            choiceCounts.set(choice.idx, 0);
        });
        // Count responses
        questionResponses.forEach((response) => {
            if (!(response === null || response === void 0 ? void 0 : response.response))
                return;
            const responseValue = response.response;
            // Handle both single and multiple selections
            if (Array.isArray(responseValue)) {
                responseValue.forEach((idx) => {
                    choiceCounts.set(idx, (choiceCounts.get(idx) || 0) + 1);
                });
            }
            else if (typeof responseValue === "number") {
                choiceCounts.set(responseValue, (choiceCounts.get(responseValue) || 0) + 1);
            }
            else if (typeof responseValue === "object" && "key" in responseValue) {
                // Handle ResponseAnswerReturnType format
                const key = responseValue.key;
                if (Array.isArray(key)) {
                    key.forEach((idx) => {
                        choiceCounts.set(idx, (choiceCounts.get(idx) || 0) + 1);
                    });
                }
                else {
                    choiceCounts.set(key, (choiceCounts.get(key) || 0) + 1);
                }
            }
        });
        // Generate distribution data
        return choices.map((choice, index) => {
            const count = choiceCounts.get(choice.idx) || 0;
            const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
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
    static generateBarChartData(distribution, question) {
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
    static generatePieChartData(distribution, question) {
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
    static generateHorizontalBarChartData(distribution, question) {
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
    static generateDoughnutChartData(distribution, question) {
        // Filter out zero counts
        const nonZeroData = distribution.filter((d) => d.count > 0);
        return {
            labels: nonZeroData.map((d) => `${d.choiceContent} (${d.percentage.toFixed(1)}%)`),
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
    static extractQuestionTitle(title) {
        if (typeof title === "string") {
            return title;
        }
        if (title && typeof title === "object") {
            // Handle TipTap/ProseMirror JSON structure
            if (title.content && Array.isArray(title.content)) {
                return title.content
                    .map((node) => {
                    if (node.text)
                        return node.text;
                    if (node.content) {
                        return node.content.map((n) => n.text || "").join("");
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
    static getFormAnalytics(formId_1) {
        return __awaiter(this, arguments, void 0, function* (formId, period = "7d") {
            const now = new Date();
            const startDate = this.calculateStartDate(period, now);
            const responses = yield Response_model_1.default.find({
                formId: new mongoose_1.Types.ObjectId(formId),
                createdAt: { $gte: startDate },
            }).sort({ createdAt: -1 });
            const questions = yield Content_model_1.default.find({
                formId: new mongoose_1.Types.ObjectId(formId),
            });
            const form = yield Form_model_1.default.findById(formId).lean();
            return Object.assign(Object.assign({}, this.calculateBasicMetrics(responses)), { questionAnalytics: yield this.generateQuestionAnalytics(responses, questions), scoreDistribution: this.generateScoreDistribution(responses, (form === null || form === void 0 ? void 0 : form.totalscore) || 100), timeSeriesData: this.generateTimeSeriesData(responses, startDate, now), performanceMetrics: this.generatePerformanceMetrics(responses, questions) });
        });
    }
    static getResponseAnalytics(formId, responses, form) {
        return __awaiter(this, void 0, void 0, function* () {
            const analytics = {};
            if (form.contentIds && Array.isArray(form.contentIds)) {
                for (const content of form.contentIds) {
                    const contentObj = content;
                    const questionId = contentObj._id.toString();
                    const questionResponses = responses
                        .map((response) => response.responseset.find((r) => r.questionId.toString() === questionId))
                        .filter(Boolean);
                    if (["multiple", "checkbox", "selection"].includes(contentObj.type)) {
                        analytics[questionId] = this.analyzeChoiceQuestion(contentObj, questionResponses);
                    }
                    else if (["rangedate", "rangenumber"].includes(contentObj.type)) {
                        analytics[questionId] = this.analyzeRangeQuestion(contentObj, questionResponses);
                    }
                }
            }
            return analytics;
        });
    }
    static calculateStartDate(period, now) {
        const periodMap = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
        };
        const days = periodMap[period] || 0;
        return days > 0
            ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
            : new Date(0);
    }
    static calculateBasicMetrics(responses) {
        const totalResponses = responses.length;
        const completedResponses = responses.filter((r) => r.completionStatus === "completed").length;
        const averageScore = responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
            totalResponses || 0;
        const responseRate = totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;
        return {
            totalResponses,
            completedResponses,
            averageScore,
            responseRate,
            averageCompletionTime: 8, // Mock data
        };
    }
    static generateQuestionAnalytics(responses, questions) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.all(questions.map((question) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const questionResponses = responses.filter((r) => r.responseset.some((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }));
                const questionResponsesData = questionResponses
                    .map((r) => r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()); }))
                    .filter(Boolean);
                const correctResponses = questionResponsesData.filter((r) => (r === null || r === void 0 ? void 0 : r.score) && r.score > 0).length;
                const accuracy = questionResponsesData.length > 0
                    ? (correctResponses / questionResponsesData.length) * 100
                    : 0;
                const avgScore = questionResponsesData.reduce((sum, r) => sum + ((r === null || r === void 0 ? void 0 : r.score) || 0), 0) /
                    questionResponsesData.length || 0;
                const responseDistribution = this.generateResponseDistribution(questionResponsesData, question);
                return {
                    questionId: ((_a = question._id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
                    questionTitle: typeof question.title === "string" ? question.title : "Question",
                    questionType: question.type,
                    totalResponses: questionResponsesData.length,
                    correctResponses,
                    accuracy,
                    averageScore: avgScore,
                    responseDistribution,
                    commonAnswers: responseDistribution
                        .map((r) => r.option)
                        .slice(0, 5),
                };
            })));
        });
    }
    static analyzeChoiceQuestion(contentObj, questionResponses) {
        const choices = contentObj.multiple || contentObj.checkbox || contentObj.selection || [];
        const answerCounts = {};
        questionResponses.forEach((response) => {
            if (response) {
                if (Array.isArray(response.response)) {
                    response.response.forEach((answer) => {
                        const key = answer.toString();
                        answerCounts[key] = (answerCounts[key] || 0) + 1;
                    });
                }
                else if (typeof response.response === "object" &&
                    "key" in response.response) {
                    // Handle ResponseAnswerReturnType
                    const key = response.response.key;
                    if (Array.isArray(key)) {
                        key.forEach((idx) => {
                            answerCounts[idx.toString()] =
                                (answerCounts[idx.toString()] || 0) + 1;
                        });
                    }
                    else {
                        answerCounts[key.toString()] =
                            (answerCounts[key.toString()] || 0) + 1;
                    }
                }
                else {
                    const key = response.response.toString();
                    answerCounts[key] = (answerCounts[key] || 0) + 1;
                }
            }
        });
        // Generate chart data with choice labels
        const chartData = Object.entries(answerCounts).map(([answer, count]) => {
            const choiceIdx = parseInt(answer);
            const choice = choices.find((c) => c.idx === choiceIdx);
            const percentage = (count / questionResponses.length) * 100;
            return {
                answer: (choice === null || choice === void 0 ? void 0 : choice.content) || answer,
                answerIdx: choiceIdx,
                count,
                percentage: percentage.toFixed(1),
            };
        });
        // Generate multi-graph format
        const labels = chartData.map((d) => d.answer);
        const data = chartData.map((d) => d.count);
        const colors = chartData.map((_, idx) => this.CHART_COLORS[idx % this.CHART_COLORS.length]);
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
                    labels: labels.map((label, idx) => `${label} (${chartData[idx].percentage}%)`),
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
    static analyzeRangeQuestion(contentObj, questionResponses) {
        const ranges = questionResponses
            .map((response) => response === null || response === void 0 ? void 0 : response.response)
            .filter(Boolean);
        return {
            type: contentObj.type,
            title: contentObj.title,
            totalResponses: questionResponses.length,
            ranges,
        };
    }
    static generateResponseDistribution(responses, question) {
        const distribution = {};
        responses.forEach((response) => {
            if (response === null || response === void 0 ? void 0 : response.response) {
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
    static generateScoreDistribution(responses, maxScore) {
        const ranges = [
            { min: 0, max: 0.2 * maxScore, label: "0-20%" },
            { min: 0.2 * maxScore, max: 0.4 * maxScore, label: "21-40%" },
            { min: 0.4 * maxScore, max: 0.6 * maxScore, label: "41-60%" },
            { min: 0.6 * maxScore, max: 0.8 * maxScore, label: "61-80%" },
            { min: 0.8 * maxScore, max: maxScore, label: "81-100%" },
        ];
        return ranges.map((range) => {
            const count = responses.filter((r) => (r.totalScore || 0) >= range.min && (r.totalScore || 0) <= range.max).length;
            return {
                scoreRange: range.label,
                count,
                percentage: responses.length > 0 ? (count / responses.length) * 100 : 0,
            };
        });
    }
    static generateTimeSeriesData(responses, startDate, endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const data = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
            const dayResponses = responses.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd);
            const avgScore = dayResponses.length > 0
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
    static generatePerformanceMetrics(responses, questions) {
        const topPerformers = responses
            .filter((r) => {
            var _a, _b, _c;
            return (r.respondentName ||
                ((_a = r.guest) === null || _a === void 0 ? void 0 : _a.name) ||
                r.respondentEmail ||
                ((_b = r.guest) === null || _b === void 0 ? void 0 : _b.email)) &&
                (r.respondentEmail || ((_c = r.guest) === null || _c === void 0 ? void 0 : _c.email));
        })
            .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
            .slice(0, 5)
            .map((r) => {
            var _a;
            return ({
                name: (0, respondentUtils_1.getResponseDisplayName)(r),
                email: r.respondentEmail || ((_a = r.guest) === null || _a === void 0 ? void 0 : _a.email),
                score: r.totalScore || 0,
                completionTime: 8, // Mock completion time
            });
        });
        const difficultQuestions = questions
            .map((q) => {
            var _a;
            const questionResponses = responses.filter((r) => r.responseset.some((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); }));
            const correctCount = questionResponses.filter((r) => {
                const questionResponse = r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); });
                return (questionResponse &&
                    questionResponse.score &&
                    questionResponse.score > 0);
            }).length;
            const accuracy = questionResponses.length > 0
                ? (correctCount / questionResponses.length) * 100
                : 0;
            const avgScore = questionResponses.reduce((sum, r) => {
                const questionResponse = r.responseset.find((rs) => { var _a; return rs.questionId.toString() === ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()); });
                return sum + ((questionResponse === null || questionResponse === void 0 ? void 0 : questionResponse.score) || 0);
            }, 0) / questionResponses.length || 0;
            return {
                questionId: ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
                title: typeof q.title === "string" ? q.title : "Question",
                accuracy,
                averageScore: avgScore,
            };
        })
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 5);
        return { topPerformers, difficultQuestions };
    }
    static generateCSVData(analyticsData, responses) {
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
            var _a;
            const row = [
                response._id,
                (0, respondentUtils_1.getResponseDisplayName)(response),
                response.respondentEmail || ((_a = response.guest) === null || _a === void 0 ? void 0 : _a.email) || "N/A",
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
exports.ResponseAnalyticsService = ResponseAnalyticsService;
// Color palette for charts
ResponseAnalyticsService.CHART_COLORS = [
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
