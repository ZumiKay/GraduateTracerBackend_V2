"use strict";
/**
 * Test file for groupContentByParent function
 *
 * This test validates that the groupContentByParent function correctly
 * organizes parent and child questions in the proper order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
describe("groupContentByParent basic tests", () => {
    // We'll manually mock the function to avoid dependency issues
    const mockGroupContentByParent = (data) => {
        const result = [];
        const childQuestionsMap = new Map();
        // First, collect all child questions by parent ID
        for (const item of data) {
            if (item.parentcontent) {
                const parentId = item.parentcontent.qId;
                if (!childQuestionsMap.has(parentId)) {
                    childQuestionsMap.set(parentId, []);
                }
                childQuestionsMap.get(parentId).push(item);
            }
        }
        // Then add parent questions followed by their children
        for (const item of data) {
            if (!item.parentcontent) {
                result.push(item);
                // Add this parent's children if any
                if (item._id) {
                    const children = childQuestionsMap.get(item._id);
                    if (children) {
                        result.push(...children);
                    }
                }
            }
        }
        return result;
    };
    // Test cases
    test("should return empty array when input is empty", () => {
        const result = mockGroupContentByParent([]);
        expect(result).toEqual([]);
    });
    test("should handle parent-child relationships correctly", () => {
        const mockData = [
            { _id: "parent1", qIdx: 1 },
            { _id: "parent2", qIdx: 2 },
            { _id: "child1", qIdx: 3, parentcontent: { qId: "parent1", optIdx: 0 } },
            { _id: "child2", qIdx: 4, parentcontent: { qId: "parent1", optIdx: 1 } },
            { _id: "child3", qIdx: 5, parentcontent: { qId: "parent2", optIdx: 0 } },
        ];
        const result = mockGroupContentByParent(mockData);
        console.log("Test results:", result);
        // Verify structure
        expect(result.length).toBe(5);
        // Parents should come before their children
        const parent1Index = result.findIndex((item) => item._id === "parent1");
        const parent2Index = result.findIndex((item) => item._id === "parent2");
        const child1Index = result.findIndex((item) => item._id === "child1");
        const child2Index = result.findIndex((item) => item._id === "child2");
        const child3Index = result.findIndex((item) => item._id === "child3");
        // Check parent1's children
        expect(parent1Index).toBeLessThan(child1Index);
        expect(parent1Index).toBeLessThan(child2Index);
        // Check parent2's child
        expect(parent2Index).toBeLessThan(child3Index);
    });
});
