"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockQuestionTitle = exports.mockContentTitle = exports.testFormLinkEmailData = exports.testResponseEmailData = void 0;
// Test examples for EmailService with ContentTitle support
const mockContentTitle = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "Sample Form Title with Rich Content",
                },
            ],
        },
    ],
};
exports.mockContentTitle = mockContentTitle;
const mockQuestionTitle = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [
                {
                    type: "text",
                    text: "What is your favorite programming language?",
                },
            ],
        },
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "Please select from the options below:",
                },
            ],
        },
    ],
};
exports.mockQuestionTitle = mockQuestionTitle;
// Test ResponseEmailData with ContentTitle
const testResponseEmailData = {
    to: "test@example.com",
    formTitle: mockContentTitle,
    totalScore: 85,
    maxScore: 100,
    responseId: "12345",
    isAutoScored: true,
    questions: [
        {
            title: mockQuestionTitle,
            type: "multiple",
            answer: "JavaScript",
            userResponse: "JavaScript",
            score: 10,
            maxScore: 10,
            isCorrect: true,
        },
        {
            title: "What is 2 + 2?", // String title still works
            type: "number",
            answer: 4,
            userResponse: 4,
            score: 5,
            maxScore: 5,
            isCorrect: true,
        },
    ],
    respondentName: "John Doe",
    submittedAt: new Date(),
};
exports.testResponseEmailData = testResponseEmailData;
// Test FormLinkEmailData with ContentTitle
const testFormLinkEmailData = {
    formId: "form123",
    formTitle: mockContentTitle,
    formOwner: "Form Administrator",
    recipientEmails: ["recipient1@example.com", "recipient2@example.com"],
    message: "Please complete this form at your earliest convenience.",
};
exports.testFormLinkEmailData = testFormLinkEmailData;
