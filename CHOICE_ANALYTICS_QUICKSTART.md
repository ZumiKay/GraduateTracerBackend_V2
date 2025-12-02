# 🚀 Quick Start: Choice Question Analytics

## What You Get

Single API call returns **4 graph types** for choice questions:

- 📊 Bar Chart
- 🥧 Pie Chart
- 📈 Horizontal Bar (sorted by popularity)
- 🍩 Doughnut Chart

---

## Step 1: Make API Call

```javascript
fetch("/api/response/analytics/choice-questions?formId=YOUR_FORM_ID", {
  headers: { Authorization: `Bearer YOUR_TOKEN` },
})
  .then((res) => res.json())
  .then((data) => console.log(data.data));
```

---

## Step 2: Get Your Data

```javascript
{
  "data": [
    {
      "questionId": "...",
      "questionTitle": "What is your favorite language?",
      "questionType": "multiple",
      "totalResponses": 150,
      "barChart": { /* ready for Chart.js */ },
      "pieChart": { /* ready for Chart.js */ },
      "horizontalBarChart": { /* ready for Chart.js */ },
      "doughnutChart": { /* ready for Chart.js */ },
      "rawData": [ /* counts & percentages */ ]
    }
  ]
}
```

---

## Step 3: Render Chart (React Example)

```tsx
import { Bar } from "react-chartjs-2";

function MyChart({ analytics }) {
  return <Bar data={analytics.barChart} />;
}
```

---

## That's It! 🎉

✅ **No calculation needed** - percentages computed  
✅ **No color selection** - auto-assigned from 20-color palette  
✅ **No data formatting** - Chart.js ready  
✅ **Multiple views** - 4 graph types included

---

## Want More?

📖 **Full docs:** `CHOICE_QUESTION_ANALYTICS.md`  
⚡ **Quick ref:** `CHOICE_QUESTION_ANALYTICS_QUICK_REF.md`  
💻 **Code examples:** `src/examples/ChoiceQuestionAnalyticsExamples.ts`
