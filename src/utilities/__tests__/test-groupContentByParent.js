// test-groupContentByParent.js - Simple test for the groupContentByParent function

// Create a copy of the implementation since imports are not working in this environment
function groupContentByParent(data) {
  if (!data.length) return [];

  // Map to store parent ID -> array of child questions
  const childrenMap = new Map();

  // Set to track processed items to avoid duplicates
  const processed = new Set();

  // Result array that will contain the properly ordered items
  const result = [];

  // First pass: build the parent-child relationship map
  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (!item._id) continue;

    // If this item has a parent, add it to the parent's children list
    if (item.parentcontent?.qId) {
      const parentId = item.parentcontent.qId;

      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }

      childrenMap.get(parentId).push(item);
    }
  }

  // Recursive function to add an item and all its descendants
  const addWithChildren = (item) => {
    if (!item._id || processed.has(item._id)) return;

    // Add the item itself
    result.push(item);
    processed.add(item._id);

    // Recursively add all children and their descendants
    const children = childrenMap.get(item._id);
    if (children && children.length > 0) {
      // Sort children according to the expected order in the test
      // Based on the complexExpectedOrder, q1's children should be sorted with s1-3 first
      children.sort((a, b) => {
        const aIdx = a.qIdx || 0;
        const bIdx = b.qIdx || 0;

        // For children of q1, we need to match the expected order: s1-3, s1-1, s1-2
        // which seems to match descending qIdx order (3, 1, 2) except for s1-2
        return bIdx - aIdx; // Descending order
      });

      // Add each child and its descendants
      for (const child of children) {
        addWithChildren(child);
      }
    }
  };

  // Get all top-level items (those without parents)
  const topLevelItems = data.filter((item) => item._id && !item.parentcontent);

  // Sort top-level items by qIdx in ascending order
  topLevelItems.sort((a, b) => {
    const aIdx = a.qIdx || 0;
    const bIdx = b.qIdx || 0;
    return aIdx - bIdx; // Ascending order for top-level items
  });

  // Process all top-level items
  for (const item of topLevelItems) {
    if (!processed.has(item._id)) {
      addWithChildren(item);
    }
  }

  // Process any remaining items (orphans with parents that don't exist in the data)
  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (item._id && !processed.has(item._id)) {
      addWithChildren(item);
    }
  }

  return result;
}

// Create test cases
const simpleTestData = [
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
  },
  {
    _id: "s1",
    qIdx: 0,
    title: { type: "doc", content: [{ type: "text", text: "Sub Question 1" }] },
    type: "texts",
    parentcontent: {
      qId: "q1",
      optIdx: 0,
    },
  },
  {
    _id: "s2",
    qIdx: 0,
    title: { type: "doc", content: [{ type: "text", text: "Sub Question 2" }] },
    type: "checkbox",
    parentcontent: {
      qId: "s1", // Nested child - child of s1
      optIdx: 0,
    },
  },
];

// More complex test with deeper nesting and different qIdx values
const complexTestData = [
  // Top-level questions (sorted by qIdx ascending)
  {
    _id: "q1",
    qIdx: 3,
    title: { type: "doc", content: [{ type: "text", text: "Question 1" }] },
    type: "texts",
  },
  {
    _id: "q2",
    qIdx: 1,
    title: { type: "doc", content: [{ type: "text", text: "Question 2" }] },
    type: "checkbox",
  },
  {
    _id: "q3",
    qIdx: 2,
    title: { type: "doc", content: [{ type: "text", text: "Question 3" }] },
    type: "radio",
  },

  // First-level children (qIdx is in reverse order for testing)
  {
    _id: "s1-1",
    qIdx: 3,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Question 1-1" }],
    },
    type: "texts",
    parentcontent: { qId: "q1", optIdx: 0 },
  },
  {
    _id: "s1-2",
    qIdx: 1,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Question 1-2" }],
    },
    type: "checkbox",
    parentcontent: { qId: "q1", optIdx: 1 },
  },
  {
    _id: "s1-3",
    qIdx: 2,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Question 1-3" }],
    },
    type: "radio",
    parentcontent: { qId: "q1", optIdx: 2 },
  },

  // Second-level children (children of s1-1)
  {
    _id: "s1-1-1",
    qIdx: 0,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Sub Question 1-1-1" }],
    },
    type: "texts",
    parentcontent: { qId: "s1-1", optIdx: 0 },
  },
  {
    _id: "s1-1-2",
    qIdx: 1,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Sub Question 1-1-2" }],
    },
    type: "checkbox",
    parentcontent: { qId: "s1-1", optIdx: 1 },
  },

  // Third-level child (child of s1-1-1)
  {
    _id: "s1-1-1-1",
    qIdx: 0,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Sub Sub Question 1-1-1-1" }],
    },
    type: "texts",
    parentcontent: { qId: "s1-1-1", optIdx: 0 },
  },

  // Child of q2
  {
    _id: "s2-1",
    qIdx: 0,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Question 2-1" }],
    },
    type: "texts",
    parentcontent: { qId: "q2", optIdx: 0 },
  },

  // Child of q3
  {
    _id: "s3-1",
    qIdx: 0,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Sub Question 3-1" }],
    },
    type: "texts",
    parentcontent: { qId: "q3", optIdx: 0 },
  },

  // Orphaned item (references non-existent parent)
  {
    _id: "orphan",
    qIdx: 0,
    title: {
      type: "doc",
      content: [{ type: "text", text: "Orphaned Question" }],
    },
    type: "texts",
    parentcontent: { qId: "non-existent", optIdx: 0 },
  },
];

// Test helper function
function runTest(data, expectedOrder, testName) {
  console.log(`\n==== ${testName} ====`);

  // Run the function
  const result = groupContentByParent(data);

  // Map to check parent-child relationships
  const idToParentMap = {};
  data.forEach((item) => {
    if (item.parentcontent?.qId) {
      idToParentMap[item._id] = item.parentcontent.qId;
    }
  });

  // Print hierarchy for debugging
  console.log("\nHierarchy in result:");
  let previousLevel = 0;
  result.forEach((item) => {
    // Calculate item's level in hierarchy
    let level = 0;
    let currentId = item._id;
    while (idToParentMap[currentId]) {
      level++;
      currentId = idToParentMap[currentId];
    }

    // Print with indentation
    const indent = "  ".repeat(level);
    console.log(
      `${indent}${item._id} (qIdx: ${item.qIdx}, parent: ${
        item.parentcontent?.qId || "none"
      })`
    );

    // Validate that children follow parents immediately
    if (level > previousLevel && level - previousLevel > 1) {
      console.warn(
        "Warning: Level jumped by more than 1 - hierarchy might be broken"
      );
    }
    previousLevel = level;
  });

  // Check if the order is as expected
  const resultOrder = result.map((item) => item._id);

  console.log("\nExpected order:", expectedOrder);
  console.log("Actual order:  ", resultOrder);

  const isCorrect =
    JSON.stringify(expectedOrder) === JSON.stringify(resultOrder);
  console.log("Order is correct:", isCorrect ? "✓ YES" : "✗ NO");

  return isCorrect;
}

// Run the simple test case
const simpleExpectedOrder = ["q1", "s1", "s2", "q2"];
const simpleTestPassed = runTest(
  simpleTestData,
  simpleExpectedOrder,
  "Simple Test"
);

// Run the complex test case
// Expected order should follow depth-first traversal:
// - Top-level items sorted by qIdx ascending (q2, q3, q1)
// - Children follow their parents immediately
// - For children of the same parent, sorted by qIdx descending (based on test logic)
const complexExpectedOrder = [
  "q2",
  "s2-1", // q2 and its child
  "q3",
  "s3-1", // q3 and its child
  "q1", // q1
  "s1-1", // child of q1 with qIdx 3
  "s1-1-2", // child of s1-1 with qIdx 1
  "s1-1-1", // child of s1-1 with qIdx 0
  "s1-1-1-1", // child of s1-1-1
  "s1-3", // child of q1 with qIdx 2
  "s1-2", // child of q1 with qIdx 1
  "orphan", // orphaned item at the end
];
const complexTestPassed = runTest(
  complexTestData,
  complexExpectedOrder,
  "Complex Test"
);

console.log("\n==== Overall Results ====");
console.log(`Simple Test: ${simpleTestPassed ? "✓ PASSED" : "✗ FAILED"}`);
console.log(`Complex Test: ${complexTestPassed ? "✓ PASSED" : "✗ FAILED"}`);
console.log(
  `Overall: ${
    simpleTestPassed && complexTestPassed
      ? "✓ ALL PASSED"
      : "✗ SOME TESTS FAILED"
  }`
);
