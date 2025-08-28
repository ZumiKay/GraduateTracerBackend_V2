"use strict";
// qIdxOrder.test.ts - Jest test to verify the qIdx ordering in groupContentByParent
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../utilities/helper");
describe("groupContentByParent", () => {
    it("should properly order questions with children appearing right after their parents", () => {
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
        // Get the qIdx values of the result for easy verification
        const qIdxOrder = result.map((item) => item.qIdx);
        // Log details for debugging
        console.log("Original data qIdx values:", testData.map((item) => item.qIdx));
        console.log("Result qIdx values:", qIdxOrder);
        result.forEach((item, index) => {
            var _a, _b, _c;
            const title = ((_c = (_b = (_a = item.title) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) || "No title";
            console.log(`${index + 1}. ${item._id} (qIdx: ${item.qIdx}) - ${title}`);
        });
        // Expected order: qIdx=1, qIdx=2, qIdx=0 (child of 2), qIdx=7
        expect(qIdxOrder[0]).toBe(1); // First item should be qIdx 1
        expect(qIdxOrder[1]).toBe(2); // Second item should be qIdx 2
        expect(qIdxOrder[2]).toBe(0); // Third item should be the child with qIdx 0
        expect(qIdxOrder[3]).toBe(7); // Fourth item should be qIdx 7
        // Also verify the IDs to ensure the correct items are in the right order
        expect(result[0]._id).toBe("q1");
        expect(result[1]._id).toBe("q2");
        expect(result[2]._id).toBe("s1");
        expect(result[3]._id).toBe("q3");
    });
});
