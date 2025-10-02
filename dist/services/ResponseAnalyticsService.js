"use strict";
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
exports.ResponseAnalyticsService = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Content_model_1 = __importDefault(require("../model/Content.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const respondentUtils_1 = require("../utilities/respondentUtils");
class ResponseAnalyticsService {
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
        const answerCounts = {};
        questionResponses.forEach((response) => {
            if (response) {
                if (Array.isArray(response.response)) {
                    response.response.forEach((answer) => {
                        const key = answer.toString();
                        answerCounts[key] = (answerCounts[key] || 0) + 1;
                    });
                }
                else {
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
                percentage: ((count / questionResponses.length) *
                    100).toFixed(1),
            })),
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
