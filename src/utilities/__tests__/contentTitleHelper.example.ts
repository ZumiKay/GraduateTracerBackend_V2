import { contentTitleToString } from "../helper";
import { ContentTitle } from "../../model/Content.model";

// Example usage of contentTitleToString function with TipTap JSON Content
// Shows proper handling of breaks and spaces

// Example 1: Simple paragraph
const simpleParagraph: ContentTitle = {
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

// Example 2: Multiple paragraphs with proper spacing
const multipleParagraphs: ContentTitle = {
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

// Example 3: Text with hard breaks
const textWithHardBreaks: ContentTitle = {
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

// Example 4: Bullet list with proper line breaks
const bulletListExample: ContentTitle = {
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

// Example 5: Mixed content with headings and paragraphs
const mixedContent: ContentTitle = {
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

// Demo the outputs
console.log("=== ContentTitle to String Examples ===\n");

console.log("1. Simple paragraph:");
console.log(JSON.stringify(contentTitleToString(simpleParagraph)));
console.log();

console.log("2. Multiple paragraphs:");
console.log(JSON.stringify(contentTitleToString(multipleParagraphs)));
console.log();

console.log("3. Text with hard breaks:");
console.log(JSON.stringify(contentTitleToString(textWithHardBreaks)));
console.log();

console.log("4. Bullet list:");
console.log(JSON.stringify(contentTitleToString(bulletListExample)));
console.log();

console.log("5. Mixed content:");
console.log(JSON.stringify(contentTitleToString(mixedContent)));
console.log();

export {
  simpleParagraph,
  multipleParagraphs,
  textWithHardBreaks,
  bulletListExample,
  mixedContent,
};
