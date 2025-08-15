// sortTest.js - A simple test file to verify the conditional sorting logic
const assert = require("assert");

// Mock data structures
const childQuestionsMap = new Map();
const conditionalOrderMap = new Map();
const q2Id = "q2";
const s1Id = "s1";
const s2Id = "s2";

// Set up child questions
childQuestionsMap.set(q2Id, [
  { _id: s2Id, title: { content: [{ content: [{ text: "S2" }] }] } },
  { _id: s1Id, title: { content: [{ content: [{ text: "S1" }] }] } },
]);

// Set up conditional order
conditionalOrderMap.set(
  q2Id,
  new Map([
    [s1Id, 0], // S1 should be first
    [s2Id, 1], // S2 should be second
  ])
);

// Function that mimics the core sorting logic
function sortByConditionalOrder() {
  // Sort children based on their position in parent's conditional array
  childQuestionsMap.forEach((children, parentId) => {
    const orderMap = conditionalOrderMap.get(parentId);

    if (orderMap) {
      children.sort((a, b) => {
        const aId = a._id || "";
        const bId = b._id || "";

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

  return childQuestionsMap.get(q2Id).map((item) => item._id);
}

// Run the sort
const result = sortByConditionalOrder();
console.log("Sorted order:", result);

// Verify the result
assert.deepStrictEqual(
  result,
  [s1Id, s2Id],
  "Items should be sorted based on conditional order"
);
console.log("Test passed!");
