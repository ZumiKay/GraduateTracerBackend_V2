import { contentTitleToString, latexToUnicode } from "../helper";
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

  describe("Math / LaTeX integration", () => {
    it("should convert inlineMath nodes to readable Unicode strings", () => {
      const mathDoc: ContentTitle = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Energy equation: " },
              {
                type: "inlineMath",
                attrs: { latex: "E = mc^2" },
              },
            ],
          },
        ],
      };

      expect(contentTitleToString(mathDoc)).toBe("Energy equation: E = mc²");
    });

    it("should convert displayMath nodes with complex fractions and roots", () => {
      const displayDoc: ContentTitle = {
        type: "doc",
        content: [
          {
            type: "displayMath",
            attrs: { latex: "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
          },
        ],
      };

      expect(contentTitleToString(displayDoc)).toBe(
        "(-b ± √(b² - 4ac) / 2a)"
      );
    });
  });
});

describe("latexToUnicode helper", () => {
  it("should return empty string for empty input", () => {
    expect(latexToUnicode("")).toBe("");
    expect(latexToUnicode(null as never)).toBe("");
  });

  it("should convert basic superscripts and subscripts", () => {
    expect(latexToUnicode("x^2 + y^2 = r^2")).toBe("x² + y² = r²");
    expect(latexToUnicode("a_1 + a_2 = a_3")).toBe("a₁ + a₂ = a₃");
  });

  it("should convert Greek letters and math operators", () => {
    expect(latexToUnicode("\\alpha + \\beta = \\gamma")).toBe("α + β = γ");
    expect(latexToUnicode("\\sin(\\theta) \\leq 1")).toBe("sin(θ) ≤ 1");
    expect(latexToUnicode("x \\pm y \\approx z")).toBe("x ± y ≈ z");
    expect(latexToUnicode("A \\times B \\cdot C")).toBe("A × B · C");
    expect(latexToUnicode("x \\in A \\cup B")).toBe("x ∈ A ∪ B");
  });

  it("should convert fractions and square roots with balanced nesting", () => {
    expect(latexToUnicode("\\frac{1}{2}")).toBe("(1 / 2)");
    expect(latexToUnicode("\\sqrt{x + y}")).toBe("√(x + y)");
    expect(latexToUnicode("\\sqrt[3]{8}")).toBe("∛(8)");
  });

  it("should convert calculus integrals and limits", () => {
    expect(
      latexToUnicode("\\int_{0}^{\\infty} e^{-x} dx = 1")
    ).toBe("∫₀∞ e⁻ˣ dx = 1");
  });
});
