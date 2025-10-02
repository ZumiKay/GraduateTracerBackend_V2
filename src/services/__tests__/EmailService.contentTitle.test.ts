import EmailService, {
  ResponseEmailData,
  FormLinkEmailData,
} from "../EmailService";
import { ContentTitle } from "../../model/Content.model";

// Test examples for EmailService with ContentTitle support

const mockContentTitle: ContentTitle = {
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

const mockQuestionTitle: ContentTitle = {
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

// Test ResponseEmailData with ContentTitle
const testResponseEmailData: ResponseEmailData = {
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

// Test FormLinkEmailData with ContentTitle
const testFormLinkEmailData: FormLinkEmailData = {
  formId: "form123",
  formTitle: mockContentTitle,
  formOwner: "Form Administrator",
  recipientEmails: ["recipient1@example.com", "recipient2@example.com"],
  message: "Please complete this form at your earliest convenience.",
};

// Example usage (commented out to prevent actual email sending during tests)
/*
const emailService = new EmailService();

// Test sending response results
emailService.sendResponseResults(testResponseEmailData)
  .then(success => {
    console.log("Response email sent:", success);
  })
  .catch(error => {
    console.error("Error sending response email:", error);
  });

// Test sending form links
emailService.sendFormLinks(testFormLinkEmailData)
  .then(success => {
    console.log("Form link emails sent:", success);
  })
  .catch(error => {
    console.error("Error sending form link emails:", error);
  });
*/

export {
  testResponseEmailData,
  testFormLinkEmailData,
  mockContentTitle,
  mockQuestionTitle,
};
