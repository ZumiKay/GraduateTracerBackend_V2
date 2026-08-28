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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseAnalyticsService = exports.FormOverViewAnalyticsService = void 0;
const mongoose_1 = require("mongoose");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const respondentUtils_1 = require("../utilities/respondentUtils");
const RespondentTrackingService_1 = require("./RespondentTrackingService");
const helper_1 = require("../utilities/helper");
class FormOverViewAnalyticsService {
    static extractQuestionTitle(title) {
        return (0, helper_1.contentTitleToString)(title) || "Question";
    }
    /**
     * Calculate comprehensive completion time statistics
     * @param completionTimes Array of completion times in seconds
     */
    static calculateAverageCompletionTime(completionTimes) {
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
    static async getFormAnalytics(formId, period = "7d") {
        const now = new Date();
        const startDate = this.calculateStartDate(period, now);
        const responses = await Response_model_1.default.find({
            formId: new mongoose_1.Types.ObjectId(formId),
            createdAt: { $gte: startDate },
        })
            .sort({ createdAt: -1 })
            .lean();
        const questions = await Content_model_1.default.find({
            formId: new mongoose_1.Types.ObjectId(formId),
        }).lean();
        return {
            ...this.calculateBasicMetrics(responses),
            timeSeriesData: this.generateTimeSeriesData(responses, startDate, now),
            performanceMetrics: this.generatePerformanceMetrics(responses, (0, helper_1.AddQuestionNumbering)({ questions })),
        };
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
        //Filtered For Completed Form Responses only
        const completedResponses = responses.filter((r) => r.completionStatus === "completed").length;
        const averageScore = responses.reduce((sum, r) => sum + (r.totalScore || 0), 0) /
            totalResponses || 0;
        const responseRate = totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;
        // Extract completion times from responses (assuming completionTime is in seconds or parseable)
        const completionTimes = responses
            .map((r) => {
            if (typeof r.completionTime === "number") {
                return r.completionTime;
            }
            // If it's a string like "1d 2h 30mn", you can parse it or skip
            return null;
        })
            .filter((time) => time !== null);
        const completionTimeStats = this.calculateAverageCompletionTime(completionTimes);
        return {
            totalResponses,
            completedResponses,
            averageScore,
            responseRate,
            averageCompletionTime: RespondentTrackingService_1.RespondentTrackingService.formatCompletionTime(completionTimeStats.average),
            completionTimeStats, // Return full stats for detailed analytics
        };
    }
    /**Analytics data for responses overview for sepcific times */
    static generateTimeSeriesData(responses, startDate, endDate) {
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const data = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
            const dayResponses = responses.filter((r) => r.submittedAt && r.submittedAt >= dayStart && r.submittedAt < dayEnd);
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
        const scoredStatuses = new Set([
            "completed",
            "autoscore",
            "noscore",
            "submitted",
        ]);
        const scoredResponses = responses.filter((r) => r.respondentEmail &&
            r.totalScore != null &&
            r.completionStatus &&
            scoredStatuses.has(r.completionStatus));
        const topPerformers = scoredResponses
            .sort((a, b) => {
            const aPercent = a.maxScore && a.maxScore > 0
                ? (a.totalScore / a.maxScore) * 100
                : a.totalScore;
            const bPercent = b.maxScore && b.maxScore > 0
                ? (b.totalScore / b.maxScore) * 100
                : b.totalScore;
            return bPercent - aPercent;
        })
            .slice(0, 5)
            .map((r) => ({
            name: (0, respondentUtils_1.getResponseDisplayName)(r),
            email: r.respondentEmail,
            score: r.totalScore ?? 0,
            maxScore: r.maxScore ?? null,
            percentScore: r.maxScore && r.maxScore > 0
                ? Math.round((r.totalScore / r.maxScore) * 100 * 10) / 10
                : null,
        }));
        // Only score-bearing question types
        const scoredQuestions = questions.filter((q) => q.type !== Content_model_1.QuestionType.Text &&
            !q.isBonusScore &&
            q.score != null &&
            q.score > 0);
        const difficultQuestions = scoredQuestions
            .map((q) => {
            const qIdStr = q._id?.toString();
            const questionResponses = responses.filter((r) => r.responseset.some((rs) => {
                const rsQId = rs.question instanceof mongoose_1.Types.ObjectId ||
                    typeof rs.question === "string"
                    ? rs.question.toString()
                    : rs.question?._id?.toString();
                return rsQId === qIdStr;
            }));
            const responseCount = questionResponses.length;
            if (responseCount === 0) {
                return {
                    _id: q._id,
                    questionId: q.questionId,
                    title: this.extractQuestionTitle(q.title),
                    accuracy: 0,
                    partialAccuracy: 0,
                    averageScore: 0,
                    maxScore: q.score,
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
                    const rsQId = rs.question instanceof mongoose_1.Types.ObjectId ||
                        typeof rs.question === "string"
                        ? rs.question.toString()
                        : rs.question?._id?.toString();
                    return rsQId === qIdStr;
                });
                const earned = rs?.score ?? 0;
                totalEarned += earned;
                if (earned >= q.score)
                    fullMarkCount++;
                if (earned > 0)
                    anyMarkCount++;
            }
            const accuracy = fullMarkCount / responseCount;
            const partialAccuracy = anyMarkCount / responseCount;
            const averageScore = totalEarned / responseCount;
            const averagePercent = Math.round((averageScore / q.score) * 100 * 10) / 10;
            return {
                _id: q._id,
                questionId: q.questionId,
                title: this.extractQuestionTitle(q.title),
                accuracy,
                partialAccuracy,
                averageScore: Math.round(averageScore * 100) / 100,
                maxScore: q.score,
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
    static generateCSVData(responses) {
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
                (0, respondentUtils_1.getResponseDisplayName)(response),
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
    static async getResponseStatusSummary() { }
}
exports.FormOverViewAnalyticsService = FormOverViewAnalyticsService;
exports.ResponseAnalyticsService = FormOverViewAnalyticsService;
