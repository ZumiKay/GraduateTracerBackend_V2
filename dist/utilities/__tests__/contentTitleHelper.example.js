"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mixedContent = exports.bulletListExample = exports.textWithHardBreaks = exports.multipleParagraphs = exports.simpleParagraph = void 0;
const helper_1 = require("../helper");
// Example usage of contentTitleToString function with TipTap JSON Content
// Shows proper handling of breaks and spaces
// Example 1: Simple paragraph
const simpleParagraph = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "This is a simple paragraph.",
                },
            ],
        },
    ],
};
exports.simpleParagraph = simpleParagraph;
// Example 2: Multiple paragraphs with proper spacing
const multipleParagraphs = {
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
exports.multipleParagraphs = multipleParagraphs;
// Example 3: Text with hard breaks
const textWithHardBreaks = {
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
                {
                    type: "hardBreak",
                },
                {
                    type: "text",
                    text: "Line three",
                },
            ],
        },
    ],
};
exports.textWithHardBreaks = textWithHardBreaks;
// Example 4: Bullet list with proper line breaks
const bulletListExample = {
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
                {
                    type: "listItem",
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: "Third item",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};
exports.bulletListExample = bulletListExample;
// Example 5: Mixed content with headings and paragraphs
const mixedContent = {
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
        {
            type: "heading",
            attrs: { level: 2 },
            content: [
                {
                    type: "text",
                    text: "Subsection",
                },
            ],
        },
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "More content here.",
                },
            ],
        },
    ],
};
exports.mixedContent = mixedContent;
// Demo the outputs
console.log("=== ContentTitle to String Examples ===\n");
console.log("1. Simple paragraph:");
console.log(JSON.stringify((0, helper_1.contentTitleToString)(simpleParagraph)));
console.log();
console.log("2. Multiple paragraphs:");
console.log(JSON.stringify((0, helper_1.contentTitleToString)(multipleParagraphs)));
console.log();
console.log("3. Text with hard breaks:");
console.log(JSON.stringify((0, helper_1.contentTitleToString)(textWithHardBreaks)));
console.log();
console.log("4. Bullet list:");
console.log(JSON.stringify((0, helper_1.contentTitleToString)(bulletListExample)));
console.log();
console.log("5. Mixed content:");
console.log(JSON.stringify((0, helper_1.contentTitleToString)(mixedContent)));
console.log();
