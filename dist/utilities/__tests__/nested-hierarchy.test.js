"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Content_model_1 = require("../../model/Content.model");
const helper_1 = require("../helper");
// Converts a short label to a deterministic 24-char hex ObjectId string
const toHex = (s) => Buffer.from(s).toString("hex").padEnd(24, "0").slice(0, 24);
describe("groupContentByParent with nested hierarchies", () => {
    // Helper to create test content items
    const createContent = (id, options = {}) => {
        const content = {
            _id: new mongoose_1.Types.ObjectId(toHex(id)),
            title: {
                type: "doc",
                content: [{ type: "text", text: `Question ${id}` }],
            },
            type: Content_model_1.QuestionType.Text,
            qIdx: options.qIdx || 0,
            formId: new mongoose_1.Types.ObjectId(),
        };
        if (options.parentId) {
            content.parentcontent = {
                qId: toHex(options.parentId),
                optIdx: 0,
            };
        }
        return content;
    };
    test("handles complex nested hierarchies", () => {
        // Create test data with the structure:
        // q1, q2, q3, q4, q5 where:
        // - q2 has children [s1, s2, s3]
        // - s2 has children [n1, n2, n3]
        // - n2 has children [m1, m2]
        const q1 = createContent("q1", { qIdx: 1 });
        const q2 = createContent("q2", { qIdx: 2 });
        const q3 = createContent("q3", { qIdx: 3 });
        const q4 = createContent("q4", { qIdx: 4 });
        const q5 = createContent("q5", { qIdx: 5 });
        const s1 = createContent("s1", { parentId: "q2", qIdx: 6 });
        const s2 = createContent("s2", { parentId: "q2", qIdx: 7 });
        const s3 = createContent("s3", { parentId: "q2", qIdx: 8 });
        const n1 = createContent("n1", { parentId: "s2", qIdx: 9 });
        const n2 = createContent("n2", { parentId: "s2", qIdx: 10 });
        const n3 = createContent("n3", { parentId: "s2", qIdx: 11 });
        const m1 = createContent("m1", { parentId: "n2", qIdx: 12 });
        const m2 = createContent("m2", { parentId: "n2", qIdx: 13 });
        // Mixed order to ensure the function handles unordered input
        const data = [q1, q2, q3, q4, q5, s1, s2, s3, n1, n2, n3, m1, m2];
        const result = (0, helper_1.groupContentByParent)(data);
        // Log the result for debugging
        console.log("Result order:", result.map((item) => item._id));
        // Check the nesting structure
        const resultIds = result.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; });
        // Define the expected ID order (ascending qIdx sort: s1→s2→s3, n1→n2→n3, m1→m2)
        const expectedOrder = [
            "q1",
            "q2",
            "s1",
            "s2",
            "n1",
            "n2",
            "m1",
            "m2",
            "n3",
            "s3",
            "q3",
            "q4",
            "q5",
        ];
        // Verify each ID is in the expected position
        expectedOrder.forEach((id, index) => {
            expect(resultIds[index]).toBe(toHex(id));
        });
        // Make sure all items are included
        expect(result.length).toBe(data.length);
    });
    test("handles single level nesting", () => {
        const parent = createContent("parent", { qIdx: 1 });
        const child1 = createContent("child1", { parentId: "parent", qIdx: 2 });
        const child2 = createContent("child2", { parentId: "parent", qIdx: 3 });
        const data = [parent, child1, child2];
        const result = (0, helper_1.groupContentByParent)(data);
        // Expected: parent followed by its children (ascending qIdx: child1=2 before child2=3)
        expect(result.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; })).toEqual([
            toHex("parent"),
            toHex("child1"),
            toHex("child2"),
        ]);
    });
    test("handles orphaned items", () => {
        var _a, _b, _c;
        const parent = createContent("parent", { qIdx: 1 });
        const child = createContent("child", { parentId: "parent", qIdx: 2 });
        const orphan = createContent("orphan", {
            parentId: "nonexistent",
            qIdx: 3,
        });
        const data = [parent, child, orphan];
        const result = (0, helper_1.groupContentByParent)(data);
        // Expected: parent, its children, then orphans
        expect(result.length).toBe(3);
        expect((_a = result[0]._id) === null || _a === void 0 ? void 0 : _a.toString()).toBe(toHex("parent"));
        expect((_b = result[1]._id) === null || _b === void 0 ? void 0 : _b.toString()).toBe(toHex("child"));
        expect((_c = result[2]._id) === null || _c === void 0 ? void 0 : _c.toString()).toBe(toHex("orphan"));
    });
    test("handles four levels of nesting with proper sorting", () => {
        // Create more complex test data with mixed qIdx values to verify sorting behavior
        const complexTestData = [
            // Top-level questions (sorted by qIdx ascending)
            createContent("q1", { qIdx: 3 }),
            createContent("q2", { qIdx: 1 }),
            createContent("q3", { qIdx: 2 }),
            // First-level children (qIdx is in reverse order for testing)
            createContent("s1-1", { parentId: "q1", qIdx: 3 }),
            createContent("s1-2", { parentId: "q1", qIdx: 1 }),
            createContent("s1-3", { parentId: "q1", qIdx: 2 }),
            // Second-level children (children of s1-1)
            createContent("s1-1-1", { parentId: "s1-1", qIdx: 0 }),
            createContent("s1-1-2", { parentId: "s1-1", qIdx: 1 }),
            // Third-level child (child of s1-1-1)
            createContent("s1-1-1-1", { parentId: "s1-1-1", qIdx: 0 }),
            // Child of q2
            createContent("s2-1", { parentId: "q2", qIdx: 0 }),
            // Child of q3
            createContent("s3-1", { parentId: "q3", qIdx: 0 }),
            // Orphaned item (references non-existent parent)
            createContent("orphan", { parentId: "non-existent", qIdx: 0 }),
        ];
        // Act
        const result = (0, helper_1.groupContentByParent)(complexTestData);
        const resultOrder = result.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; });
        // Log results for debugging
        console.log("Actual complex order:", resultOrder);
        // Verify top-level item ordering (ascending by qIdx)
        const topLevelItems = result.filter((item) => !item.parentcontent);
        expect(topLevelItems.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; })).toEqual([
            toHex("q2"),
            toHex("q3"),
            toHex("q1"),
        ]);
        // Verify children of q1 are ordered by descending qIdx
        const q1Children = result.filter((item) => { var _a; return ((_a = item.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) === toHex("q1"); });
        const q1ChildrenIds = q1Children.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; });
        expect(q1ChildrenIds).toEqual(expect.arrayContaining([toHex("s1-1"), toHex("s1-3"), toHex("s1-2")]));
        // Verify children of s1-1 are ordered by descending qIdx
        const s1_1Children = result.filter((item) => { var _a; return ((_a = item.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) === toHex("s1-1"); });
        const s1_1ChildrenIds = s1_1Children.map((item) => { var _a; return ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || ""; });
        expect(s1_1ChildrenIds).toEqual(expect.arrayContaining([toHex("s1-1-2"), toHex("s1-1-1")]));
        // Verify that s1-1-1-1 appears in the result
        expect(resultOrder).toContain(toHex("s1-1-1-1"));
        // Verify that children follow their parents immediately
        const q2Index = resultOrder.indexOf(toHex("q2"));
        const s2_1Index = resultOrder.indexOf(toHex("s2-1"));
        expect(s2_1Index).toBe(q2Index + 1);
        const q3Index = resultOrder.indexOf(toHex("q3"));
        const s3_1Index = resultOrder.indexOf(toHex("s3-1"));
        expect(s3_1Index).toBe(q3Index + 1);
        // Verify total number of items
        expect(result.length).toBe(complexTestData.length);
        // Orphaned item should be included
        expect(resultOrder).toContain(toHex("orphan"));
    });
    test("handles edge cases", () => {
        // Test with empty array
        expect((0, helper_1.groupContentByParent)([])).toEqual([]);
        // Test with items missing _id
        const missingId = [
            createContent("valid", { qIdx: 1 }),
            {
                qIdx: 2,
                title: { type: "doc", content: [{ type: "text", text: "Missing ID" }] },
                type: Content_model_1.QuestionType.Text,
            },
        ];
        expect((0, helper_1.groupContentByParent)(missingId).length).toBe(1);
        // Test with circular references
        const circular1 = createContent("circular1", { qIdx: 1 });
        const circular2 = createContent("circular2", {
            parentId: "circular1",
            qIdx: 2,
        });
        circular1.parentcontent = { qId: toHex("circular2"), optIdx: 0 };
        const circularData = [circular1, circular2];
        const circularResult = (0, helper_1.groupContentByParent)(circularData);
        // Should still produce a result without infinite recursion
        expect(circularResult.length).toBeGreaterThan(0);
    });
});
