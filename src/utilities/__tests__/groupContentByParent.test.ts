import { Types } from "mongoose";
import { ContentType, QuestionType } from "../../model/Content.model";
import { groupContentByParent } from "../helper";

describe("groupContentByParent", () => {
  // Test case 1: Basic functionality with simple parent-child relationship
  test("should correctly group basic parent-child relationships", () => {
    // Arrange
    const formId = new Types.ObjectId();
    const mockData: Array<ContentType> = [
      {
        _id: new Types.ObjectId("q1"),
        qIdx: 1,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Question 1" }],
        },
        type: QuestionType.Text,
      },
      {
        _id: new Types.ObjectId("q2"),
        qIdx: 2,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Question 2" }],
        },
        type: QuestionType.CheckBox,
      },
      {
        _id: new Types.ObjectId("q3"),
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Sub Question 1" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "q1",
          optIdx: 0,
        },
      },
    ];

    // Act
    const result = groupContentByParent(mockData);

    console.log(result);

    // Assert
    expect(result.length).toBe(mockData.length);
    expect(result[0]._id).toBe("q1");
    expect(result[1]._id).toBe("q3"); // Child should be after parent
    expect(result[2]._id).toBe("q2"); // Next question after parent-child group
  });

  // Test case 2: Complex nested structure with multiple levels
  test("should correctly handle multiple nested levels with mixed parent relationships", () => {
    // Arrange
    const formId = new Types.ObjectId();
    const mockData: Array<ContentType> = [
      // Main questions (top level)
      {
        _id: new Types.ObjectId("q1"), // Main question 1
        qIdx: 1,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Main Question 1" }],
        },
        type: QuestionType.Text,
      },
      {
        _id: new Types.ObjectId("q2"), // Main question 2 with conditionals
        qIdx: 2,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Main Question 2" }],
        },
        type: QuestionType.CheckBox,
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId("000000000000000000000001"),
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: new Types.ObjectId("000000000000000000000002"),
          },
        ],
      },
      {
        _id: new Types.ObjectId("q3"), // Main question 3
        qIdx: 3,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Main Question 3" }],
        },
        type: QuestionType.Text, // Changed from Radio to Text since Radio isn't in the enum
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId("000000000000000000000003"),
          },
        ],
      },

      // First level of nested questions (sub-questions)
      {
        _id: new Types.ObjectId("s1"), // Sub-question 1 of q2
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Sub Question 1" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "q2",
          optIdx: 0,
        },
      },
      {
        _id: new Types.ObjectId("s2"), // Sub-question 2 of q2 with its own conditionals
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Sub Question 2" }],
        },
        type: QuestionType.CheckBox,
        parentcontent: {
          qId: "q2",
          optIdx: 1,
        },
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId("000000000000000000000004"),
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: new Types.ObjectId("000000000000000000000005"),
          },
        ],
      },
      {
        _id: new Types.ObjectId("s3"), // Sub-question of q3
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Sub Question 3" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "q3",
          optIdx: 0,
        },
      },

      // Second level of nested questions (nested sub-questions)
      {
        _id: new Types.ObjectId("n1"), // Nested question 1 of s2
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Nested Question 1" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "s2",
          optIdx: 0,
        },
      },
      {
        _id: new Types.ObjectId("n2"), // Nested question 2 of s2 with its own conditionals
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Nested Question 2" }],
        },
        type: QuestionType.Text, // Changed from Radio to Text
        parentcontent: {
          qId: "s2",
          optIdx: 1,
        },
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId("000000000000000000000006"),
          },
          {
            _id: new Types.ObjectId(),
            key: 1,
            contentId: new Types.ObjectId("000000000000000000000007"),
          },
          {
            _id: new Types.ObjectId(),
            key: 2,
            contentId: new Types.ObjectId("000000000000000000000008"),
          },
        ],
      },

      // Third level of nested questions (deeply nested)
      {
        _id: new Types.ObjectId("m1"), // Deeply nested question 1 of n2
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Deeply Nested Question 1" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "n2",
          optIdx: 0,
        },
      },
      {
        _id: new Types.ObjectId("m2"), // Deeply nested question 2 of n2
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Deeply Nested Question 2" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "n2",
          optIdx: 1,
        },
      },
      {
        _id: new Types.ObjectId("m3"), // Deeply nested question 3 of n2 with fourth level
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Deeply Nested Question 3" }],
        },
        type: QuestionType.CheckBox,
        parentcontent: {
          qId: "n2",
          optIdx: 2,
        },
        conditional: [
          {
            _id: new Types.ObjectId(),
            key: 0,
            contentId: new Types.ObjectId("000000000000000000000009"),
          },
        ],
      },

      // Fourth level of nesting
      {
        _id: new Types.ObjectId("d1"), // Fourth level nested question
        qIdx: 0,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Fourth Level Nested Question" }],
        },
        type: QuestionType.Text,
        parentcontent: {
          qId: "m3",
          optIdx: 0,
        },
      },

      // Additional main question
      {
        _id: new Types.ObjectId("q4"), // Main question 4
        qIdx: 4,
        formId,
        title: {
          type: "doc",
          content: [{ type: "text", text: "Main Question 4" }],
        },
        type: QuestionType.Text,
      },
    ];

    // Act
    const result = groupContentByParent(mockData);

    console.log(
      "Result IDs:",
      result.map((item) => item._id?.toString() || "")
    );

    // Assert
    // Expected ordering: parent followed by all its nested children recursively before siblings
    const expectedOrder = [
      "q1",
      "q2",
      "s1",
      "s2",
      "n1",
      "n2",
      "m1",
      "m2",
      "m3",
      "d1",
      "q3",
      "s3",
      "q4",
    ];
    const resultIds = result.map((item) => item._id?.toString() || "");

    // Check that all items are included in the result
    expect(result.length).toBe(mockData.length);

    // For each item, check that it's at the expected position
    expectedOrder.forEach((id, index) => {
      expect(resultIds[index]).toBe(id);
    });

    // Verify specific relationships
    // q2 should be followed by its children
    expect(resultIds.indexOf("q2") + 1).toBe(resultIds.indexOf("s1"));

    // s2 should be followed by its children
    expect(resultIds.indexOf("s2") + 1).toBe(resultIds.indexOf("n1"));

    // n2 should be followed by its children
    expect(resultIds.indexOf("n2") + 1).toBe(resultIds.indexOf("m1"));

    // m3 should be followed by its child
    expect(resultIds.indexOf("m3") + 1).toBe(resultIds.indexOf("d1"));

    // q3 should be followed by its child
    expect(resultIds.indexOf("q3") + 1).toBe(resultIds.indexOf("s3"));
  });
});
