import { contentTitleToString } from "../helper";
import { ContentTitle } from "../../model/Content.model";

describe("contentTitleToString - TipTap JSON Content", () => {
  it("should return empty string for null or undefined input", () => {
    expect(contentTitleToString(null)).toBe("");
    expect(contentTitleToString(undefined)).toBe("");
  });

  it("should extract simple text content", () => {
    const simpleText: ContentTitle = {
      type: "text",
      text: "Simple question text",
    };

    expect(contentTitleToString(simpleText)).toBe("Simple question text");
  });

  it("should handle TipTap document structure", () => {
    const tipTapDoc: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is a TipTap document",
            },
          ],
        },
      ],
    };

    expect(contentTitleToString(tipTapDoc)).toBe("This is a TipTap document");
  });

  it("should handle multiple paragraphs with proper spacing", () => {
    const multiParagraph: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "First paragraph.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Second paragraph.",
            },
          ],
        },
      ],
    };

    expect(contentTitleToString(multiParagraph)).toBe(
      "First paragraph. Second paragraph."
    );
  });

  it("should handle headings with proper spacing", () => {
    const headingWithParagraph: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            {
              type: "text",
              text: "Main Title",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is the content under the heading.",
            },
          ],
        },
      ],
    };

    expect(contentTitleToString(headingWithParagraph)).toBe(
      "Main Title This is the content under the heading."
    );
  });

  it("should handle bullet lists with proper line breaks", () => {
    const bulletList: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "First item",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Second item",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = contentTitleToString(bulletList);
    expect(result).toContain("• First item");
    expect(result).toContain("• Second item");
    expect(result.split("\n")).toHaveLength(2);
  });

  it("should handle hard breaks properly", () => {
    const hardBreakContent: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Line one",
            },
            {
              type: "hardBreak",
            },
            {
              type: "text",
              text: "Line two",
            },
          ],
        },
      ],
    };

    expect(contentTitleToString(hardBreakContent)).toBe("Line one\nLine two");
  });

  it("should clean up extra whitespace", () => {
    const complexContent: ContentTitle = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Text with    multiple   spaces",
            },
          ],
        },
      ],
    };

    expect(contentTitleToString(complexContent)).toBe(
      "Text with multiple spaces"
    );
  });
});
