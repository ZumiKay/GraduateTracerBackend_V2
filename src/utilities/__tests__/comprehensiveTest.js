// comprehensiveTest.js - More complex test cases for groupContentByParent

// Copy of the groupContentByParent function
function groupContentByParent(data) {
  // Map to store parent ID -> child questions
  const childQuestionsMap = new Map();

  // Map to store parent ID -> conditional order information
  const conditionalOrderMap = new Map();

  // Group questions by their qIdx for better organization
  const qIdxGroups = new Map();

  // First pass: collect all relationships and organize questions by qIdx
  for (const item of data) {
    // Group by qIdx (for top-level questions)
    const qIdx = item.qIdx || 0;
    if (!qIdxGroups.has(qIdx)) {
      qIdxGroups.set(qIdx, []);
    }
    qIdxGroups.get(qIdx).push(item);

    // Store child questions by parent ID
    if (item.parentcontent && item.parentcontent.qId) {
      const parentId = item.parentcontent.qId;
      if (!childQuestionsMap.has(parentId)) {
        childQuestionsMap.set(parentId, []);
      }
      childQuestionsMap.get(parentId).push(item);
    }

    // Store conditional order information
    if (item._id && item.conditional && item.conditional.length > 0) {
      const orderMap = new Map();

      // Create mapping of child ID to its position in conditional array
      item.conditional.forEach((cond, index) => {
        if (cond.contentId) {
          orderMap.set(cond.contentId.toString(), index);
        }
      });

      conditionalOrderMap.set(item._id, orderMap);
    }
  }

  // Sort children by their position in parent's conditional array
  childQuestionsMap.forEach((children, parentId) => {
    const orderMap = conditionalOrderMap.get(parentId);

    if (orderMap) {
      // Sort children based on their order in the conditional array
      children.sort((a, b) => {
        const aId = a._id?.toString() || "";
        const bId = b._id?.toString() || "";

        // Get position from the order map, default to a high number if not found
        const aPos = orderMap.has(aId)
          ? orderMap.get(aId)
          : Number.MAX_SAFE_INTEGER;
        const bPos = orderMap.has(bId)
          ? orderMap.get(bId)
          : Number.MAX_SAFE_INTEGER;

        return aPos - bPos; // Sort by position in conditional array
      });
    }
  });

  // Result array and processed tracker
  const result = [];
  const processed = new Set();

  /**
   * Recursive function to add an item and all its children in proper order
   */
  const addItemWithChildren = (item) => {
    if (!item._id || processed.has(item._id)) return;

    // Add the item itself
    result.push(item);
    processed.add(item._id);

    // Process children in the order they appear in the conditional array
    const children = childQuestionsMap.get(item._id);
    if (children && children.length > 0) {
      for (const child of children) {
        addItemWithChildren(child);
      }
    }
  };

  // Get all qIdx values and sort them
  const qIdxValues = Array.from(qIdxGroups.keys()).sort((a, b) => a - b);

  // Process questions by qIdx, inserting each with its children
  for (const qIdx of qIdxValues) {
    const questionsWithThisQIdx = qIdxGroups.get(qIdx) || [];

    // Only process top-level questions (those without parentcontent)
    const topLevelQuestions = questionsWithThisQIdx.filter(
      (q) => !q.parentcontent && q._id && !processed.has(q._id)
    );

    // Sort top-level questions if needed (e.g., by some other criteria)
    for (const item of topLevelQuestions) {
      addItemWithChildren(item);
    }
  }

  // Include any orphaned items
  for (const item of data) {
    if (item._id && !processed.has(item._id)) {
      result.push(item);
      processed.add(item._id);
    }
  }

  return result;
}

// Helper function to run and verify test cases
function runTest(testCase, expectedOrder) {
  console.log(`\n=== Running test: ${testCase.name} ===`);

  // Run the groupContentByParent function
  const result = groupContentByParent(testCase.data);

  // Extract qIdx values and IDs for verification
  const qIdxOrder = result.map((item) => item.qIdx);
  const idOrder = result.map((item) => item._id);

  console.log("Expected qIdx order:", expectedOrder.qIdxOrder);
  console.log("Actual qIdx order:", qIdxOrder);

  console.log("Expected ID order:", expectedOrder.idOrder);
  console.log("Actual ID order:", idOrder);

  // Detailed result
  console.log("\nDetailed result:");
  result.forEach((item, index) => {
    const title = item.title?.content?.[0]?.text || "No title";
    console.log(`${index + 1}. ${item._id} (qIdx: ${item.qIdx}) - ${title}`);
  });

  // Check if the order matches the expected order
  const qIdxOrderMatch =
    qIdxOrder.length === expectedOrder.qIdxOrder.length &&
    qIdxOrder.every((val, idx) => val === expectedOrder.qIdxOrder[idx]);

  const idOrderMatch =
    idOrder.length === expectedOrder.idOrder.length &&
    idOrder.every((val, idx) => val === expectedOrder.idOrder[idx]);

  console.log("\nResults:");
  console.log("qIdx Order correct:", qIdxOrderMatch ? "✓ YES" : "✗ NO");
  console.log("ID Order correct:", idOrderMatch ? "✓ YES" : "✗ NO");

  return { qIdxOrderMatch, idOrderMatch };
}

// Test case 1: Basic ordering with one child question
const testCase1 = {
  name: "Basic ordering with one child question",
  data: [
    {
      _id: "q1",
      qIdx: 1,
      title: { type: "doc", content: [{ type: "text", text: "Question 1" }] },
      type: "texts",
    },
    {
      _id: "q2",
      qIdx: 2,
      title: { type: "doc", content: [{ type: "text", text: "Question 2" }] },
      type: "checkbox",
      conditional: [{ _id: "cond1", key: 0, contentId: "s1" }],
    },
    {
      _id: "q3",
      qIdx: 7,
      title: { type: "doc", content: [{ type: "text", text: "Question 3" }] },
      type: "texts",
    },
    {
      _id: "s1",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 1" }],
      },
      type: "texts",
      parentcontent: { qId: "q2", optIdx: 0 },
    },
  ],
};

// Test case 2: Multiple children with different qIdx values
const testCase2 = {
  name: "Multiple children with different qIdx values",
  data: [
    {
      _id: "q1",
      qIdx: 1,
      title: { type: "doc", content: [{ type: "text", text: "Question 1" }] },
      type: "texts",
    },
    {
      _id: "q2",
      qIdx: 2,
      title: { type: "doc", content: [{ type: "text", text: "Question 2" }] },
      type: "checkbox",
      conditional: [
        { _id: "cond1", key: 0, contentId: "s1" },
        { _id: "cond2", key: 1, contentId: "s2" },
      ],
    },
    {
      _id: "q3",
      qIdx: 7,
      title: { type: "doc", content: [{ type: "text", text: "Question 3" }] },
      type: "texts",
    },
    {
      _id: "s1",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 1" }],
      },
      type: "texts",
      parentcontent: { qId: "q2", optIdx: 0 },
    },
    {
      _id: "s2",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 2" }],
      },
      type: "texts",
      parentcontent: { qId: "q2", optIdx: 1 },
    },
  ],
};

// Test case 3: Deeply nested hierarchy
const testCase3 = {
  name: "Deeply nested hierarchy",
  data: [
    {
      _id: "q1",
      qIdx: 1,
      title: { type: "doc", content: [{ type: "text", text: "Question 1" }] },
      type: "texts",
    },
    {
      _id: "q2",
      qIdx: 2,
      title: { type: "doc", content: [{ type: "text", text: "Question 2" }] },
      type: "checkbox",
      conditional: [{ _id: "cond1", key: 0, contentId: "s1" }],
    },
    {
      _id: "q3",
      qIdx: 7,
      title: { type: "doc", content: [{ type: "text", text: "Question 3" }] },
      type: "texts",
    },
    {
      _id: "s1",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 1" }],
      },
      type: "checkbox",
      conditional: [{ _id: "cond2", key: 0, contentId: "n1" }],
      parentcontent: { qId: "q2", optIdx: 0 },
    },
    {
      _id: "n1",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Nested Question 1" }],
      },
      type: "texts",
      parentcontent: { qId: "s1", optIdx: 0 },
    },
  ],
};

// Test case 4: Mixed qIdx values and conditional questions
const testCase4 = {
  name: "Mixed qIdx values and conditional questions",
  data: [
    {
      _id: "q1",
      qIdx: 5,
      title: { type: "doc", content: [{ type: "text", text: "Question 1" }] },
      type: "texts",
    },
    {
      _id: "q2",
      qIdx: 3,
      title: { type: "doc", content: [{ type: "text", text: "Question 2" }] },
      type: "checkbox",
      conditional: [{ _id: "cond1", key: 0, contentId: "s1" }],
    },
    {
      _id: "q3",
      qIdx: 1,
      title: { type: "doc", content: [{ type: "text", text: "Question 3" }] },
      type: "checkbox",
      conditional: [{ _id: "cond2", key: 0, contentId: "s2" }],
    },
    {
      _id: "s1",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 1" }],
      },
      type: "texts",
      parentcontent: { qId: "q2", optIdx: 0 },
    },
    {
      _id: "s2",
      qIdx: 0,
      title: {
        type: "doc",
        content: [{ type: "text", text: "Sub Question 2" }],
      },
      type: "texts",
      parentcontent: { qId: "q3", optIdx: 0 },
    },
  ],
};

// Expected results
const expectedResults = {
  testCase1: {
    qIdxOrder: [1, 2, 0, 7],
    idOrder: ["q1", "q2", "s1", "q3"],
  },
  testCase2: {
    qIdxOrder: [1, 2, 0, 0, 7],
    idOrder: ["q1", "q2", "s1", "s2", "q3"],
  },
  testCase3: {
    qIdxOrder: [1, 2, 0, 0, 7],
    idOrder: ["q1", "q2", "s1", "n1", "q3"],
  },
  testCase4: {
    qIdxOrder: [1, 0, 3, 0, 5],
    idOrder: ["q3", "s2", "q2", "s1", "q1"],
  },
};

// Run all test cases
console.log("==== COMPREHENSIVE TEST CASES ====");
const results = {
  testCase1: runTest(testCase1, expectedResults.testCase1),
  testCase2: runTest(testCase2, expectedResults.testCase2),
  testCase3: runTest(testCase3, expectedResults.testCase3),
  testCase4: runTest(testCase4, expectedResults.testCase4),
};

// Summary
console.log("\n==== TEST RESULTS SUMMARY ====");
let allPassed = true;
Object.entries(results).forEach(([testName, result]) => {
  const passed = result.qIdxOrderMatch && result.idOrderMatch;
  console.log(`${testName}: ${passed ? "✅ PASSED" : "❌ FAILED"}`);
  if (!passed) allPassed = false;
});

console.log(
  "\nOverall result:",
  allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
);
