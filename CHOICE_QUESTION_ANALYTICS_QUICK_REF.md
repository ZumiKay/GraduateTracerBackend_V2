# Choice Question Analytics - Quick Reference

## 🚀 Quick Start

### API Endpoint

```
GET /api/response/analytics/choice-questions?formId={formId}&questionId={questionId}
```

### Response Structure

```typescript
{
  "data": [
    {
      "questionId": "string",
      "questionTitle": "string",
      "questionType": "multiple" | "checkbox" | "selection",
      "totalResponses": number,
      "availableGraphTypes": ["bar", "pie", "horizontalBar", "doughnut"],
      "barChart": {...},      // Vertical bar chart data
      "pieChart": {...},      // Pie chart data
      "horizontalBarChart": {...},  // Horizontal bar (sorted by count)
      "doughnutChart": {...}, // Doughnut chart data
      "rawData": [...]        // Raw distribution data
    }
  ]
}
```

---

## 📊 Graph Types

| Type               | Best For               | Sorting         |
| ------------------ | ---------------------- | --------------- |
| **Bar Chart**      | Comparisons            | By choice index |
| **Pie Chart**      | Proportions            | By choice index |
| **Horizontal Bar** | Rankings               | By count (desc) |
| **Doughnut**       | Proportions with style | By choice index |

---

## 🎨 Features

✅ Multiple graph formats in one API call  
✅ Automatic color assignment (20-color palette)  
✅ Percentage calculations  
✅ Zero-count filtering (pie/doughnut)  
✅ Supports multiple selections (checkbox)  
✅ Works with all choice question types

---

## 💻 Usage Examples

### Fetch Analytics

```typescript
const response = await fetch(
  `/api/response/analytics/choice-questions?formId=${formId}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);
const { data } = await response.json();
```

### Render Chart (React + Chart.js)

```tsx
import { Bar } from "react-chartjs-2";

<Bar
  data={analytics.barChart}
  options={{
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: analytics.questionTitle,
      },
    },
  }}
/>;
```

---

## 🔑 Key Properties

### ChoiceDistribution (rawData)

```typescript
{
  choiceIdx: number,      // Choice index
  choiceContent: string,  // Choice text
  count: number,          // Number of responses
  percentage: number,     // Percentage (0-100)
  color: string          // Hex color code
}
```

### Chart Data Format

```typescript
{
  labels: string[],       // Choice labels
  datasets: [{
    data: number[],       // Response counts
    backgroundColor: string[],
    borderColor: string[],
    borderWidth: number
  }]
}
```

---

## ⚠️ Important Notes

1. **Authentication Required** - JWT token in Authorization header
2. **Choice Questions Only** - Multiple Choice, Checkbox, Selection
3. **Zero Filtering** - Pie/Doughnut charts exclude zero-count choices
4. **Horizontal Bar** - Sorted by count (highest first)
5. **Doughnut Labels** - Include percentages in labels

---

## 🎯 Query Parameters

| Parameter    | Required | Description                      |
| ------------ | -------- | -------------------------------- |
| `formId`     | ✅ Yes   | Form ID to analyze               |
| `questionId` | ❌ No    | Specific question (omit for all) |

---

## 📈 Response Codes

| Code | Meaning                   |
| ---- | ------------------------- |
| 200  | Success                   |
| 400  | Invalid formId/questionId |
| 401  | Unauthorized              |
| 403  | No access to form         |
| 500  | Server error              |

---

## 🎨 Color Palette (First 10)

```
#FF6384 (Pink-Red)
#36A2EB (Blue)
#FFCE56 (Yellow)
#4BC0C0 (Teal)
#9966FF (Purple)
#FF9F40 (Orange)
#C9CBCF (Gray)
...and more
```

---

## 🔧 Troubleshooting

**No data returned?**

- Check formId validity
- Ensure form has choice questions
- Verify responses exist

**Wrong colors?**

- Colors auto-assigned cyclically
- 20 colors available

**Chart not rendering?**

- Check chart library installation
- Verify data structure matches library format
- Set container height explicitly

---

## 📚 See Full Documentation

For detailed examples, frontend integration, and advanced usage:  
→ See `CHOICE_QUESTION_ANALYTICS.md`
