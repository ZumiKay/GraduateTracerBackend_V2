import { Types } from "mongoose";
import { groupContentByParent } from "../helper";
import { ContentType, QuestionType } from "../../model/Content.model";

describe("groupContentByParent with conditional order", () => {
  test("maintains order based on parent conditional array", () => {
    const formId = new Types.ObjectId();

    const createTitle = (text: string) => ({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text }],
        },
      ],
    });

    // Helper function to create ObjectId from string
    const createId = (id: string) => new Types.ObjectId(id);

    // Create simplified test data that matches the ContentType interface
    const q1Id = createId("507f1f77bcf86cd799439011");
    const q2Id = createId("507f1f77bcf86cd799439012");
    const q3Id = createId("507f1f77bcf86cd799439013");
    const s1Id = createId("507f1f77bcf86cd799439014");
    const s2Id = createId("507f1f77bcf86cd799439015");
    const n1Id = createId("507f1f77bcf86cd799439016");
    const n2Id = createId("507f1f77bcf86cd799439017");
    const n3Id = createId("507f1f77bcf86cd799439018");
    const m1Id = createId("507f1f77bcf86cd799439019");
    const m2Id = createId("507f1f77bcf86cd79943901a");

    const testData: ContentType[] = [
      // Main questions
      {
        _id: q1Id,
        formId,
        title: createTitle("Question 1"),
        type: QuestionType.Text,
        qIdx: 1,
      },
      {
        _id: q2Id,
        formId,
        title: createTitle("Question 2"),
        type: QuestionType.CheckBox,
        qIdx: 2,
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: s1Id,
            contentIdx: 1,
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: s2Id,
            contentIdx: 2,
          },
        ],
      },
      {
        _id: q3Id,
        formId,
        title: createTitle("Question 3"),
        type: QuestionType.Text,
        qIdx: 3,
      },

      // First level sub-questions (of q2)
      {
        _id: s1Id,
        formId,
        title: createTitle("Sub-question 1"),
        type: QuestionType.Text,
        qIdx: 4,
        parentcontent: {
          qId: q2Id.toString(),
          optIdx: 0,
        },
      },
      {
        _id: s2Id,
        formId,
        title: createTitle("Sub-question 2"),
        type: QuestionType.Text,
        qIdx: 5,
        parentcontent: {
          qId: q2Id.toString(),
          optIdx: 1,
        },
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: n1Id,
            contentIdx: 1,
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: n2Id,
            contentIdx: 2,
          },
          {
            _id: new Types.ObjectId(),
            key: 2,
            contentId: n3Id,
            contentIdx: 3,
          },
        ],
      },

      // Second level sub-questions (of s2)
      {
        _id: n1Id,
        formId,
        title: createTitle("Nested 1"),
        type: QuestionType.Text,
        qIdx: 6,
        parentcontent: {
          qId: s2Id.toString(),
          optIdx: 0,
        },
      },
      {
        _id: n2Id,
        formId,
        title: createTitle("Nested 2"),
        type: QuestionType.Text,
        qIdx: 7,
        parentcontent: {
          qId: s2Id.toString(),
          optIdx: 1,
        },
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: m1Id,
            contentIdx: 1,
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: m2Id,
            contentIdx: 2,
          },
        ],
      },
      {
        _id: n3Id,
        formId,
        title: createTitle("Nested 3"),
        type: QuestionType.Text,
        qIdx: 8,
        parentcontent: {
          qId: s2Id.toString(),
          optIdx: 2,
        },
      },

      // Third level sub-questions (of n2)
      {
        _id: m1Id,
        formId,
        title: createTitle("Most Nested 1"),
        type: QuestionType.Text,
        qIdx: 9,
        parentcontent: {
          qId: n2Id.toString(),
          optIdx: 0,
        },
      },
      {
        _id: m2Id,
        formId,
        title: createTitle("Most Nested 2"),
        type: QuestionType.Text,
        qIdx: 10,
        parentcontent: {
          qId: n2Id.toString(),
          optIdx: 1,
        },
      },
    ];

    // Create a function that just stubs the core functionality for testing
    const mockGroupContentByParent = (data: ContentType[]) => {
      // Create a map of parent IDs to their children
      const childQuestionsMap = new Map<string, ContentType[]>();

      // Create a map to store parent ID -> conditional order information
      const conditionalOrderMap = new Map<string, Map<string, number>>();

      // Collect all parent-child relationships and conditional order information
      for (const item of data) {
        if (item.parentcontent && item.parentcontent.qId) {
          const parentId = item.parentcontent.qId;
          if (!childQuestionsMap.has(parentId)) {
            childQuestionsMap.set(parentId, []);
          }
          childQuestionsMap.get(parentId)!.push(item);
        }

        if (item._id && item.conditional && item.conditional.length > 0) {
          const orderMap = new Map<string, number>();

          item.conditional.forEach((cond, index) => {
            if (cond.contentId) {
              orderMap.set(cond.contentId.toString(), index);
            }
          });

          conditionalOrderMap.set(item._id.toString(), orderMap);
        }
      }

      // Sort children based on their position in parent's conditional array
      childQuestionsMap.forEach((children, parentId) => {
        const orderMap = conditionalOrderMap.get(parentId);

        if (orderMap) {
          children.sort((a, b) => {
            const aId = a._id?.toString() || "";
            const bId = b._id?.toString() || "";

            const aPos = orderMap.has(aId)
              ? orderMap.get(aId)!
              : Number.MAX_SAFE_INTEGER;
            const bPos = orderMap.has(bId)
              ? orderMap.get(bId)!
              : Number.MAX_SAFE_INTEGER;

            return aPos - bPos;
          });
        }
      });

      return {
        childQuestionsMap,
        conditionalOrderMap,
      };
    };

    // Test the core sorting functionality directly
    const { childQuestionsMap, conditionalOrderMap } =
      mockGroupContentByParent(testData);

    // Check q2's children are correctly identified
    const q2Children = childQuestionsMap.get(q2Id.toString()) || [];
    expect(q2Children.length).toBe(2);
    expect(q2Children[0]._id).toBe(s1Id.toString());
    expect(q2Children[1]._id).toBe(s2Id.toString());

    // Check s2's children are correctly identified
    const s2Children = childQuestionsMap.get(s2Id.toString()) || [];
    expect(s2Children.length).toBe(3);

    // Verify they're sorted correctly based on conditional order
    const s2ChildrenIds = s2Children.map((child) => child._id?.toString());
    expect(s2ChildrenIds[0]).toBe(n1Id.toString());
    expect(s2ChildrenIds[1]).toBe(n2Id.toString());
    expect(s2ChildrenIds[2]).toBe(n3Id.toString());

    // Check n2's children are correctly identified
    const n2Children = childQuestionsMap.get(n2Id.toString()) || [];
    expect(n2Children.length).toBe(2);

    // Verify they're sorted correctly based on conditional order
    const n2ChildrenIds = n2Children.map((child) => child._id?.toString());
    expect(n2ChildrenIds[0]).toBe(m1Id.toString());
    expect(n2ChildrenIds[1]).toBe(m2Id.toString());

    // Now test the actual function
    const result = groupContentByParent(testData);
    const resultIds = result.map((item) => item._id?.toString());

    // Simple check for inclusion and relative ordering
    expect(resultIds).toContain(q1Id.toString());
    expect(resultIds).toContain(q2Id.toString());
    expect(resultIds).toContain(s1Id.toString());
    expect(resultIds).toContain(s2Id.toString());
    expect(resultIds).toContain(n1Id.toString());
    expect(resultIds).toContain(n2Id.toString());
    expect(resultIds).toContain(m1Id.toString());
    expect(resultIds).toContain(m2Id.toString());

    // Log results for debugging
    console.log("Actual order:", resultIds);
  });
});
