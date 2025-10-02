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
});
