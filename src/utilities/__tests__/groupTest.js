// groupTest.js - A minimal test with a simplified version of the groupContentByParent function

// Simplified version of the function based on the original
const groupContentByParent = (data) => {
  // Map to store parent ID -> child questions
  const childQuestionsMap = new Map();

  // Map to store parent ID -> conditional order information
  const conditionalOrderMap = new Map();

  // First pass: collect all parent-child relationships and conditional order information
  for (const item of data) {
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

  // Process parent questions (those without parentcontent)
  for (const item of data) {
    if (!item.parentcontent && item._id && !processed.has(item._id)) {
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
};

// Create minimal test data with the expected types
const testData = [
  {
    _id: "q1",
    formId: "form1",
    title: { type: "doc", content: [{ content: [{ text: "Q1" }] }] },
    type: "texts",
    qIdx: 1,
  },
  {
    _id: "q2",
    formId: "form1",
    title: { type: "doc", content: [{ content: [{ text: "Q2" }] }] },
    type: "checkbox",
    qIdx: 2,
    conditional: [
      {
        _id: "cond1",
        key: 0,
        contentId: "s1",
        contentIdx: 3,
      },
      {
        _id: "cond2",
        key: 1,
        contentId: "s2",
        contentIdx: 4,
      },
    ],
  },
  {
    _id: "q3",
    formId: "form1",
    title: { type: "doc", content: [{ content: [{ text: "Q3" }] }] },
    type: "texts",
    qIdx: 5,
  },
  {
    _id: "s2", // This appears before s1 in the original array
    formId: "form1",
    title: { type: "doc", content: [{ content: [{ text: "S2" }] }] },
    type: "texts",
    qIdx: 4,
    parentcontent: {
      qId: "q2",
      optIdx: 1,
    },
  },
  {
    _id: "s1",
    formId: "form1",
    title: { type: "doc", content: [{ content: [{ text: "S1" }] }] },
    type: "texts",
    qIdx: 3,
    parentcontent: {
      qId: "q2",
      optIdx: 0,
    },
  },
];

// Run the function
try {
  const result = groupContentByParent(testData);

  // Print the result
  console.log("Result order:");
  result.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item._id} - ${
        item.title.content[0]?.content?.[0]?.text || "No title"
      }`
    );
  });

  // Verify the expected order
  const resultIds = result.map((item) => item._id);
  const expectedOrder = ["q1", "q2", "s1", "s2", "q3"];

  // Check if the order matches
  const isOrderCorrect =
    JSON.stringify(resultIds) === JSON.stringify(expectedOrder);
  console.log("\nOrder correct?", isOrderCorrect);

  if (!isOrderCorrect) {
    console.log("Expected:", expectedOrder);
    console.log("Actual:", resultIds);
  }
} catch (error) {
  console.error("Error running groupContentByParent:", error);
}
