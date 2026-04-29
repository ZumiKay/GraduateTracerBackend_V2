"use strict";
/**
 * Example Usage for Choice Question Analytics
 * Demonstrates how to use the new multi-graph analytics API
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualTestExamples = void 0;
exports.getAllChoiceQuestionAnalytics = getAllChoiceQuestionAnalytics;
exports.getSpecificQuestionAnalytics = getSpecificQuestionAnalytics;
exports.processAnalyticsForDisplay = processAnalyticsForDisplay;
exports.formatForChartJs = formatForChartJs;
exports.generateSummaryStats = generateSummaryStats;
const analytics_types_1 = require("../types/analytics.types");
/**
 * Example 1: Fetch analytics for all choice questions in a form
 */
function getAllChoiceQuestionAnalytics(formId, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`/api/response/analytics/choice-questions?formId=${formId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }
        const data = yield response.json();
        return data.data;
    });
}
/**
 * Example 2: Fetch analytics for a specific question
 */
function getSpecificQuestionAnalytics(formId, questionId, token) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`/api/response/analytics/choice-questions?formId=${formId}&questionId=${questionId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }
        const data = yield response.json();
        return data.data[0] || null;
    });
}
/**
 * Example 3: Process analytics data for display
 */
function processAnalyticsForDisplay(analytics) {
    return {
        questionTitle: analytics.questionTitle,
        totalResponses: analytics.totalResponses,
        mostPopularChoice: getMostPopularChoice(analytics.rawData),
        leastPopularChoice: getLeastPopularChoice(analytics.rawData),
        averageResponsesPerChoice: analytics.rawData.reduce((sum, item) => sum + item.count, 0) /
            analytics.rawData.length,
    };
}
/**
 * Helper: Get most popular choice
 */
function getMostPopularChoice(data) {
    if (data.length === 0)
        return null;
    return data.reduce((max, item) => (item.count > max.count ? item : max));
}
/**
 * Helper: Get least popular choice (excluding zero counts)
 */
function getLeastPopularChoice(data) {
    const nonZero = data.filter((item) => item.count > 0);
    if (nonZero.length === 0)
        return null;
    return nonZero.reduce((min, item) => (item.count < min.count ? item : min));
}
/**
 * Example 4: Format data for Chart.js
 */
function formatForChartJs(analytics, graphType) {
    switch (graphType) {
        case analytics_types_1.GraphType.BAR:
            return analytics.barChart;
        case analytics_types_1.GraphType.PIE:
            return analytics.pieChart;
        case analytics_types_1.GraphType.HORIZONTAL_BAR:
            return analytics.horizontalBarChart;
        case analytics_types_1.GraphType.DOUGHNUT:
            return analytics.doughnutChart;
        default:
            return analytics.barChart;
    }
}
/**
 * Example 5: Generate summary statistics
 */
function generateSummaryStats(analytics) {
    const totalQuestions = analytics.length;
    const totalResponses = analytics.reduce((sum, q) => sum + q.totalResponses, 0);
    const avgResponsesPerQuestion = totalResponses / totalQuestions;
    const allChoices = analytics.flatMap((q) => q.rawData);
    const totalChoiceCount = allChoices.reduce((sum, choice) => sum + choice.count, 0);
    return {
        totalQuestions,
        totalResponses,
        avgResponsesPerQuestion: avgResponsesPerQuestion.toFixed(2),
        totalChoices: allChoices.length,
        totalChoiceSelections: totalChoiceCount,
    };
}
/**
 * Manual Testing Script
 * Use this in your browser console or API testing tool like Postman
 */
exports.manualTestExamples = `
// Example 1: Get analytics for all choice questions
fetch('/api/response/analytics/choice-questions?formId=YOUR_FORM_ID', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(res => res.json())
.then(data => console.log('All Questions:', data));

// Example 2: Get analytics for specific question
fetch('/api/response/analytics/choice-questions?formId=YOUR_FORM_ID&questionId=YOUR_QUESTION_ID', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(res => res.json())
.then(data => console.log('Specific Question:', data));

// Example 3: View different graph types
fetch('/api/response/analytics/choice-questions?formId=YOUR_FORM_ID', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(res => res.json())
.then(data => {
  const analytics = data.data[0];
  console.log('Bar Chart:', analytics.barChart);
  console.log('Pie Chart:', analytics.pieChart);
  console.log('Horizontal Bar:', analytics.horizontalBarChart);
  console.log('Doughnut:', analytics.doughnutChart);
  console.log('Raw Data:', analytics.rawData);
});
`;
