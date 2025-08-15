// Create a simple standalone test that doesn't rely on import/require
// testOrdering.js

// Define types to match the ones from the original code
const ContentType = {};
const ParentContentType = {};

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
];

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
