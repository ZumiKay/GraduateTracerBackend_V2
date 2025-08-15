// qIdxOrderTest.ts - Test to verify the qIdx ordering in groupContentByParent

import { ContentType } from "../../model/Content.model";
import { groupContentByParent } from "../../utilities/helper";

// Create a simple console test function
function runQIdxOrderTest() {
  // Create test data that reproduces the ordering issue
  const testData = [
    {
      _id: "q1",
      qIdx: 1,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Question 1" }],
      },
      type: "texts",
    },
    {
      _id: "q2",
      qIdx: 2,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Question 2" }],
      },
      type: "checkbox",
      conditional: [
        {
          _id: "cond1",
          key: 0,
          contentId: "s1",
        },
      ],
    },
    {
      _id: "q3",
      qIdx: 7,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Question 3 (qIdx 7)" }],
      },
      type: "texts",
    },
    {
      _id: "s1",
      qIdx: 0, // Sub-question with qIdx 0
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question (qIdx 0)" }],
      },
      type: "texts",
      parentcontent: {
        qId: "q2",
        optIdx: 0,
      },
    },
  ] as ContentType[];

  // Run the groupContentByParent function
  const result = groupContentByParent(testData);

  // Print the results
  console.log(
    "Original data qIdx values:",
    testData.map((item) => item.qIdx)
  );
  console.log(
    "Result qIdx values:",
    result.map((item) => item.qIdx)
  );
  console.log("\nDetailed result:");
  result.forEach((item, index) => {
    const title = item.title?.content?.[0]?.text || "No title";
    console.log(`${index + 1}. ${item._id} (qIdx: ${item.qIdx}) - ${title}`);
  });

  // Verify expected order: [1, 2, 0, 7] - parent questions sorted by qIdx, children right after parents
  const qIdxOrder = result.map((item) => item.qIdx);
  const isCorrectOrder =
    qIdxOrder[0] === 1 && // First item should be qIdx 1
    qIdxOrder[1] === 2 && // Second item should be qIdx 2
    qIdxOrder[2] === 0 && // Third item should be the child with qIdx 0
    qIdxOrder[3] === 7; // Fourth item should be qIdx 7

  console.log("\nExpected order: [1, 2, 0, 7]");
  console.log("Actual order:", qIdxOrder);
  console.log("Order is correct:", isCorrectOrder ? "✓ YES" : "✗ NO");
}

// Execute the test
runQIdxOrderTest();
