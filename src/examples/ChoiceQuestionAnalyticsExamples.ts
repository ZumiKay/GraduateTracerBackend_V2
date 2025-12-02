/**
 * Example Usage for Choice Question Analytics
 * Demonstrates how to use the new multi-graph analytics API
 */

import {
  MultiGraphAnalytics,
  GraphType,
  ChoiceDistribution,
} from "../types/analytics.types";

/**
 * Example 1: Fetch analytics for all choice questions in a form
 */
export async function getAllChoiceQuestionAnalytics(
  formId: string,
  token: string
): Promise<MultiGraphAnalytics[]> {
  const response = await fetch(
    `/api/response/analytics/choice-questions?formId=${formId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch analytics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Example 2: Fetch analytics for a specific question
 */
export async function getSpecificQuestionAnalytics(
  formId: string,
  questionId: string,
  token: string
): Promise<MultiGraphAnalytics | null> {
  const response = await fetch(
    `/api/response/analytics/choice-questions?formId=${formId}&questionId=${questionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch analytics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0] || null;
}

/**
 * Example 3: Process analytics data for display
 */
export function processAnalyticsForDisplay(analytics: MultiGraphAnalytics) {
  return {
    questionTitle: analytics.questionTitle,
    totalResponses: analytics.totalResponses,
    mostPopularChoice: getMostPopularChoice(analytics.rawData),
    leastPopularChoice: getLeastPopularChoice(analytics.rawData),
    averageResponsesPerChoice:
      analytics.rawData.reduce((sum, item) => sum + item.count, 0) /
      analytics.rawData.length,
  };
}

/**
 * Helper: Get most popular choice
 */
function getMostPopularChoice(
  data: ChoiceDistribution[]
): ChoiceDistribution | null {
  if (data.length === 0) return null;
  return data.reduce((max, item) => (item.count > max.count ? item : max));
}

/**
 * Helper: Get least popular choice (excluding zero counts)
 */
function getLeastPopularChoice(
  data: ChoiceDistribution[]
): ChoiceDistribution | null {
  const nonZero = data.filter((item) => item.count > 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((min, item) => (item.count < min.count ? item : min));
}

/**
 * Example 4: Format data for Chart.js
 */
export function formatForChartJs(
  analytics: MultiGraphAnalytics,
  graphType: GraphType
) {
  switch (graphType) {
    case GraphType.BAR:
      return analytics.barChart;
    case GraphType.PIE:
      return analytics.pieChart;
    case GraphType.HORIZONTAL_BAR:
      return analytics.horizontalBarChart;
    case GraphType.DOUGHNUT:
      return analytics.doughnutChart;
    default:
      return analytics.barChart;
  }
}

/**
 * Example 5: Generate summary statistics
 */
export function generateSummaryStats(analytics: MultiGraphAnalytics[]) {
  const totalQuestions = analytics.length;
  const totalResponses = analytics.reduce(
    (sum, q) => sum + q.totalResponses,
    0
  );
  const avgResponsesPerQuestion = totalResponses / totalQuestions;

  const allChoices = analytics.flatMap((q) => q.rawData);
  const totalChoiceCount = allChoices.reduce(
    (sum, choice) => sum + choice.count,
    0
  );

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
export const manualTestExamples = `
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
