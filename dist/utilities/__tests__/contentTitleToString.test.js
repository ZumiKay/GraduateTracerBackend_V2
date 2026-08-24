"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../helper");
describe("contentTitleToString - TipTap JSON Content", () => {
    it("should return empty string for null or undefined input", () => {
        expect((0, helper_1.contentTitleToString)(null)).toBe("");
        expect((0, helper_1.contentTitleToString)(undefined)).toBe("");
    });
    it("should extract simple text content", () => {
        const simpleText = {
            type: "text",
            text: "Simple question text",
        };
        expect((0, helper_1.contentTitleToString)(simpleText)).toBe("Simple question text");
    });
    it("should handle TipTap document structure", () => {
        const tipTapDoc = {
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
        expect((0, helper_1.contentTitleToString)(tipTapDoc)).toBe("This is a TipTap document");
    });
    it("should handle multiple paragraphs with proper spacing", () => {
        const multiParagraph = {
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
        expect((0, helper_1.contentTitleToString)(multiParagraph)).toBe("First paragraph. Second paragraph.");
    });
    it("should handle headings with proper spacing", () => {
        const headingWithParagraph = {
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
        expect((0, helper_1.contentTitleToString)(headingWithParagraph)).toBe("Main Title This is the content under the heading.");
    });
    it("should handle bullet lists with proper line breaks", () => {
        const bulletList = {
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
        const result = (0, helper_1.contentTitleToString)(bulletList);
        expect(result).toContain("• First item");
        expect(result).toContain("• Second item");
        expect(result.split("\n")).toHaveLength(2);
    });
    it("should handle hard breaks properly", () => {
        const hardBreakContent = {
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
        expect((0, helper_1.contentTitleToString)(hardBreakContent)).toBe("Line one\nLine two");
    });
    it("should clean up extra whitespace", () => {
        const complexContent = {
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
        expect((0, helper_1.contentTitleToString)(complexContent)).toBe("Text with multiple spaces");
    });
    describe("Math / LaTeX integration", () => {
        it("should convert inlineMath nodes to readable Unicode strings", () => {
            const mathDoc = {
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
            expect((0, helper_1.contentTitleToString)(mathDoc)).toBe("Energy equation: E = mc²");
        });
        it("should convert displayMath nodes with complex fractions and roots", () => {
            const displayDoc = {
                type: "doc",
                content: [
                    {
                        type: "displayMath",
                        attrs: { latex: "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
                    },
                ],
            };
            expect((0, helper_1.contentTitleToString)(displayDoc)).toBe("(-b ± √(b² - 4ac) / 2a)");
        });
    });
});
describe("latexToUnicode helper", () => {
    it("should return empty string for empty input", () => {
        expect((0, helper_1.latexToUnicode)("")).toBe("");
        expect((0, helper_1.latexToUnicode)(null)).toBe("");
    });
    it("should convert basic superscripts and subscripts", () => {
        expect((0, helper_1.latexToUnicode)("x^2 + y^2 = r^2")).toBe("x² + y² = r²");
        expect((0, helper_1.latexToUnicode)("a_1 + a_2 = a_3")).toBe("a₁ + a₂ = a₃");
    });
    it("should convert Greek letters and math operators", () => {
        expect((0, helper_1.latexToUnicode)("\\alpha + \\beta = \\gamma")).toBe("α + β = γ");
        expect((0, helper_1.latexToUnicode)("\\sin(\\theta) \\leq 1")).toBe("sin(θ) ≤ 1");
        expect((0, helper_1.latexToUnicode)("x \\pm y \\approx z")).toBe("x ± y ≈ z");
        expect((0, helper_1.latexToUnicode)("A \\times B \\cdot C")).toBe("A × B · C");
        expect((0, helper_1.latexToUnicode)("x \\in A \\cup B")).toBe("x ∈ A ∪ B");
    });
    it("should convert fractions and square roots with balanced nesting", () => {
        expect((0, helper_1.latexToUnicode)("\\frac{1}{2}")).toBe("(1 / 2)");
        expect((0, helper_1.latexToUnicode)("\\sqrt{x + y}")).toBe("√(x + y)");
        expect((0, helper_1.latexToUnicode)("\\sqrt[3]{8}")).toBe("∛(8)");
    });
    it("should convert calculus integrals and limits", () => {
        expect((0, helper_1.latexToUnicode)("\\int_{0}^{\\infty} e^{-x} dx = 1")).toBe("∫₀∞ e⁻ˣ dx = 1");
    });
});
