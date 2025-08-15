// test-actual-implementation.js - Test for the actual groupContentByParent implementation

// Create a simplified version of the actual implementation
const { groupContentByParent } = require("../helper");

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
  try {
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
  } catch (error) {
    console.error("Error running test:", error);
    return false;
  }
}

// Run the simple test case
const simpleExpectedOrder = ["q1", "s1", "s2", "q2"];
const simpleTestPassed = runTest(
  simpleTestData,
  simpleExpectedOrder,
  "Simple Test"
);

// Run the complex test case
// Expected order should match our implementation's behavior
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
