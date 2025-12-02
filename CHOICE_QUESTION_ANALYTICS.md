# Choice Question Multi-Graph Analytics

## Overview

This feature provides comprehensive analytics for Choice Questions (Multiple Choice, Checkbox, Selection) with support for multiple graph visualization types: **Bar Chart**, **Pie Chart**, **Horizontal Bar Chart**, and **Doughnut Chart**.

## Features

✅ **Multiple Graph Types** - Single API call returns data for all graph types
✅ **Choice Questions Support** - Multiple Choice, Checkbox, Selection
✅ **Automatic Color Palette** - 20+ predefined colors for consistent visualization
✅ **Percentage Calculations** - Automatic percentage and count calculations
✅ **Response Distribution** - Detailed distribution data for each choice
✅ **Flexible Queries** - Get analytics for all questions or specific question
✅ **Zero-Count Filtering** - Pie/Doughnut charts exclude zero responses

---

## API Endpoint

### Get Choice Question Analytics

**Endpoint:** `GET /api/response/analytics/choice-questions`

**Authentication:** Required (JWT Token)

**Query Parameters:**

- `formId` (required): Form ID
- `questionId` (optional): Specific question ID. If not provided, returns analytics for all choice questions

**Headers:**

```http
Authorization: Bearer <access_token>
```

---

## Request Examples

### Get Analytics for All Choice Questions

```typescript
const response = await fetch(
  `/api/response/analytics/choice-questions?formId=${formId}`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);

const data = await response.json();
```

### Get Analytics for Specific Question

```typescript
const response = await fetch(
  `/api/response/analytics/choice-questions?formId=${formId}&questionId=${questionId}`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);

const data = await response.json();
```

---

## Response Format

```typescript
{
  "success": true,
  "code": 200,
  "message": "Choice question analytics retrieved successfully",
  "data": [
    {
      "questionId": "507f1f77bcf86cd799439011",
      "questionTitle": "What is your favorite programming language?",
      "questionType": "multiple",
      "totalResponses": 150,
      "availableGraphTypes": ["bar", "pie", "horizontalBar", "doughnut"],

      // Bar Chart Data
      "barChart": {
        "labels": ["JavaScript", "Python", "Java", "C++", "Go"],
        "datasets": [{
          "label": "Response Count",
          "data": [45, 60, 20, 15, 10],
          "backgroundColor": ["#FF6384CC", "#36A2EBCC", "#FFCE56CC", "#4BC0C0CC", "#9966FFCC"],
          "borderColor": ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
          "borderWidth": 2
        }]
      },

      // Pie Chart Data
      "pieChart": {
        "labels": ["JavaScript", "Python", "Java", "C++", "Go"],
        "datasets": [{
          "data": [45, 60, 20, 15, 10],
          "backgroundColor": ["#FF6384CC", "#36A2EBCC", "#FFCE56CC", "#4BC0C0CC", "#9966FFCC"],
          "borderColor": ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
          "borderWidth": 2
        }]
      },

      // Horizontal Bar Chart Data (sorted by count)
      "horizontalBarChart": {
        "labels": ["Python", "JavaScript", "Java", "C++", "Go"],
        "datasets": [{
          "label": "Response Count",
          "data": [60, 45, 20, 15, 10],
          "backgroundColor": ["#36A2EBCC", "#FF6384CC", "#FFCE56CC", "#4BC0C0CC", "#9966FFCC"],
          "borderColor": ["#36A2EB", "#FF6384", "#FFCE56", "#4BC0C0", "#9966FF"],
          "borderWidth": 2
        }]
      },

      // Doughnut Chart Data (with percentages)
      "doughnutChart": {
        "labels": [
          "JavaScript (30.0%)",
          "Python (40.0%)",
          "Java (13.3%)",
          "C++ (10.0%)",
          "Go (6.7%)"
        ],
        "datasets": [{
          "data": [45, 60, 20, 15, 10],
          "backgroundColor": ["#FF6384DD", "#36A2EBDD", "#FFCE56DD", "#4BC0C0DD", "#9966FFDD"],
          "borderColor": ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
          "borderWidth": 2
        }]
      },

      // Raw Distribution Data
      "rawData": [
        {
          "choiceIdx": 0,
          "choiceContent": "JavaScript",
          "count": 45,
          "percentage": 30.0,
          "color": "#FF6384"
        },
        {
          "choiceIdx": 1,
          "choiceContent": "Python",
          "count": 60,
          "percentage": 40.0,
          "color": "#36A2EB"
        },
        // ... more choices
      ]
    }
  ]
}
```

---

## Frontend Integration

### React with Chart.js Example

```typescript
import { Bar, Pie, HorizontalBar, Doughnut } from "react-chartjs-2";
import { MultiGraphAnalytics } from "@/types/analytics.types";

interface Props {
  analytics: MultiGraphAnalytics;
  graphType: "bar" | "pie" | "horizontalBar" | "doughnut";
}

const AnalyticsChart: React.FC<Props> = ({ analytics, graphType }) => {
  const chartData = (() => {
    switch (graphType) {
      case "bar":
        return analytics.barChart;
      case "pie":
        return analytics.pieChart;
      case "horizontalBar":
        return analytics.horizontalBarChart;
      case "doughnut":
        return analytics.doughnutChart;
      default:
        return analytics.barChart;
    }
  })();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: analytics.questionTitle,
      },
    },
  };

  return (
    <div className="chart-container" style={{ height: "400px" }}>
      {graphType === "bar" && <Bar data={chartData!} options={options} />}
      {graphType === "pie" && <Pie data={chartData!} options={options} />}
      {graphType === "horizontalBar" && (
        <HorizontalBar data={chartData!} options={options} />
      )}
      {graphType === "doughnut" && (
        <Doughnut data={chartData!} options={options} />
      )}

      <div className="analytics-summary">
        <p>Total Responses: {analytics.totalResponses}</p>
      </div>
    </div>
  );
};

export default AnalyticsChart;
```

### Vue with Chart.js Example

```vue
<template>
  <div class="analytics-chart">
    <h3>{{ analytics.questionTitle }}</h3>

    <div class="graph-selector">
      <button
        v-for="type in analytics.availableGraphTypes"
        :key="type"
        @click="selectedGraph = type"
        :class="{ active: selectedGraph === type }"
      >
        {{ type }}
      </button>
    </div>

    <div class="chart-container">
      <component
        :is="chartComponent"
        :data="chartData"
        :options="chartOptions"
      />
    </div>

    <div class="analytics-info">
      <p>Total Responses: {{ analytics.totalResponses }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { Bar, Pie, Doughnut } from "vue-chartjs";
import { MultiGraphAnalytics, GraphType } from "@/types/analytics.types";

export default defineComponent({
  components: { Bar, Pie, Doughnut },
  props: {
    analytics: {
      type: Object as () => MultiGraphAnalytics,
      required: true,
    },
  },
  setup(props) {
    const selectedGraph = ref<GraphType>(GraphType.BAR);

    const chartComponent = computed(() => {
      switch (selectedGraph.value) {
        case GraphType.BAR:
        case GraphType.HORIZONTAL_BAR:
          return "Bar";
        case GraphType.PIE:
          return "Pie";
        case GraphType.DOUGHNUT:
          return "Doughnut";
        default:
          return "Bar";
      }
    });

    const chartData = computed(() => {
      switch (selectedGraph.value) {
        case GraphType.BAR:
          return props.analytics.barChart;
        case GraphType.PIE:
          return props.analytics.pieChart;
        case GraphType.HORIZONTAL_BAR:
          return props.analytics.horizontalBarChart;
        case GraphType.DOUGHNUT:
          return props.analytics.doughnutChart;
        default:
          return props.analytics.barChart;
      }
    });

    const chartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: selectedGraph.value === GraphType.HORIZONTAL_BAR ? "y" : "x",
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: props.analytics.questionTitle,
        },
      },
    }));

    return {
      selectedGraph,
      chartComponent,
      chartData,
      chartOptions,
    };
  },
});
</script>
```

---

## Supported Question Types

| Question Type   | Type Value  | Supports Multiple Selection | Graph Support   |
| --------------- | ----------- | --------------------------- | --------------- |
| Multiple Choice | `multiple`  | No                          | ✅ Full Support |
| Checkbox        | `checkbox`  | Yes                         | ✅ Full Support |
| Selection       | `selection` | No                          | ✅ Full Support |

---

## Color Palette

The analytics service uses a predefined color palette with 20 colors:

```javascript
const CHART_COLORS = [
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
```

Colors are applied cyclically if there are more than 20 choices.

---

## Graph Type Differences

### Bar Chart

- Shows vertical bars
- Best for comparing values
- Default sort: by choice index

### Pie Chart

- Shows proportions as slices
- Best for showing part-to-whole relationships
- Filters out zero-count choices

### Horizontal Bar Chart

- Shows horizontal bars
- **Sorted by count** (highest to lowest)
- Best for rankings

### Doughnut Chart

- Similar to pie chart with center hole
- Labels include percentages
- Filters out zero-count choices

---

## Response Handling

### Multiple Selections (Checkbox)

The system handles responses where users select multiple choices:

```typescript
// Response format for checkbox questions
{
  "response": [0, 2, 4] // User selected choices at indices 0, 2, and 4
}
```

Each selected choice increments its count independently.

### Single Selection (Multiple Choice, Selection)

```typescript
{
  "response": 1 // User selected choice at index 1
}
```

### ResponseAnswerReturnType Format

```typescript
{
  "response": {
    "key": 2,
    "val": "JavaScript"
  }
}
```

---

## Performance Considerations

- **Batch Processing**: Single API call returns all graph formats
- **Efficient Queries**: Optimized MongoDB queries with proper indexing
- **Client-Side Rendering**: Graph rendering happens on frontend
- **Caching**: Consider caching analytics data for frequently accessed forms

---

## Error Handling

```typescript
try {
  const response = await fetch(
    `/api/response/analytics/choice-questions?formId=${formId}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch analytics");
  }

  const data = await response.json();

  if (!data.success) {
    console.error("Analytics error:", data.message);
    return;
  }

  // Process analytics data
  setAnalytics(data.data);
} catch (error) {
  console.error("Error fetching analytics:", error);
  // Show error to user
}
```

---

## Best Practices

1. **Choose Appropriate Graph Type**

   - Use **Bar Charts** for comparisons
   - Use **Pie/Doughnut Charts** for proportions (when total = 100%)
   - Use **Horizontal Bar** for rankings

2. **Handle Empty Data**

   - Check `totalResponses` before rendering
   - Display "No responses yet" message if zero

3. **Responsive Design**

   - Set container height explicitly
   - Use `responsive: true` and `maintainAspectRatio: false`

4. **Color Accessibility**

   - Consider adding patterns for colorblind users
   - Ensure sufficient contrast

5. **Performance**
   - Limit number of choices displayed
   - Consider pagination for forms with many responses

---

## Future Enhancements

- [ ] Custom color palettes
- [ ] Export charts as images
- [ ] Real-time updates with WebSockets
- [ ] Comparison across multiple forms
- [ ] Time-based analytics (responses over time)
- [ ] Advanced filtering options

---

## Troubleshooting

### No data returned

- Verify formId is correct
- Check if form has choice-type questions
- Ensure responses exist for the form

### Colors not displaying

- Check if frontend chart library is properly configured
- Verify color format (hex with transparency)

### Wrong graph type

- Ensure you're accessing the correct property (`barChart`, `pieChart`, etc.)
- Check `availableGraphTypes` array

---

## API Response Status Codes

| Code | Description                                |
| ---- | ------------------------------------------ |
| 200  | Success                                    |
| 400  | Bad Request (invalid formId or questionId) |
| 401  | Unauthorized (missing or invalid token)    |
| 403  | Forbidden (no access to form)              |
| 404  | Form or Question not found                 |
| 500  | Server error                               |

---

## License

This feature is part of the Graduate Tracer system.
