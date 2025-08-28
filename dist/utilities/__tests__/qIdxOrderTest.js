"use strict";
// qIdxOrderTest.ts - Test to verify the qIdx ordering in groupContentByParent
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../utilities/helper");
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
    ];
    // Run the groupContentByParent function
    const result = (0, helper_1.groupContentByParent)(testData);
    // Print the results
    console.log("Original data qIdx values:", testData.map((item) => item.qIdx));
    console.log("Result qIdx values:", result.map((item) => item.qIdx));
    console.log("\nDetailed result:");
    result.forEach((item, index) => {
        var _a, _b, _c;
        const title = ((_c = (_b = (_a = item.title) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) || "No title";
        console.log(`${index + 1}. ${item._id} (qIdx: ${item.qIdx}) - ${title}`);
    });
    // Verify expected order: [1, 2, 0, 7] - parent questions sorted by qIdx, children right after parents
    const qIdxOrder = result.map((item) => item.qIdx);
    const isCorrectOrder = qIdxOrder[0] === 1 && // First item should be qIdx 1
        qIdxOrder[1] === 2 && // Second item should be qIdx 2
        qIdxOrder[2] === 0 && // Third item should be the child with qIdx 0
        qIdxOrder[3] === 7; // Fourth item should be qIdx 7
    console.log("\nExpected order: [1, 2, 0, 7]");
    console.log("Actual order:", qIdxOrder);
    console.log("Order is correct:", isCorrectOrder ? "✓ YES" : "✗ NO");
}
// Execute the test
runQIdxOrderTest();
