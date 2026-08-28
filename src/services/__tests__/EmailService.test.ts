import nodemailer from "nodemailer";
import EmailService, {
  EmailData,
  FormLinkEmailData,
  ResponseEmailData,
  ResponseCardEmailData,
} from "../EmailService";
import { ContentTitle } from "../../model/Content.model";

jest.mock("nodemailer");

describe("EmailService", () => {
  let emailService: EmailService;
  let mockSendMail: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ADMIN_EMAIL: "admin@example.com",
      EMAIL_APP_PASSWORD: "app-password-secret",
      SMTP_USER: "smtp-sender@example.com",
      FRONTEND_URL: "https://graduatetracer.example.com",
    };

    mockSendMail = jest
      .fn()
      .mockResolvedValue({ messageId: "test-message-id" });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    emailService = new EmailService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Constructor and Transporter Initialization", () => {
    test("initializes nodemailer transport with gmail service and env auth credentials", () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: "gmail",
        auth: {
          user: "admin@example.com",
          pass: "app-password-secret",
        },
      });
    });
  });

  describe("sendEmail", () => {
    test("sends email successfully with valid data and returns true", async () => {
      const emailData: EmailData = {
        to: ["recipient1@example.com", "recipient2@example.com"],
        subject: "Test Subject",
        html: "<p>Test Content</p>",
      };

      const result = await emailService.sendEmail(emailData);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: "smtp-sender@example.com",
        to: "recipient1@example.com,recipient2@example.com",
        subject: "Test Subject",
        html: "<p>Test Content</p>",
      });
    });

    test("handles errors when sendMail rejects and returns false", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockSendMail.mockRejectedValueOnce(new Error("SMTP Connection Refused"));

      const emailData: EmailData = {
        to: ["recipient@example.com"],
        subject: "Fail Test",
        html: "<p>Fail</p>",
      };

      const result = await emailService.sendEmail(emailData);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error sending email:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("sendFormLinks", () => {
    test("generates correct HTML and sends form links with string title and message", async () => {
      const data: FormLinkEmailData = {
        formId: "form-12345",
        formTitle: "Graduate Survey 2026",
        formOwner: "University Admin",
        recipientEmails: ["student1@example.com", "student2@example.com"],
        message: "Please complete this survey by next week.",
      };

      const result = await emailService.sendFormLinks(data);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("student1@example.com,student2@example.com");
      expect(mailOptions.subject).toBe("Form Invitation: Graduate Survey 2026");
      expect(mailOptions.html).toContain(
        "https://graduatetracer.example.com/form-access/form-12345",
      );
      expect(mailOptions.html).toContain("Graduate Survey 2026");
      expect(mailOptions.html).toContain("University Admin");
      expect(mailOptions.html).toContain(
        "Please complete this survey by next week.",
      );
    });

    test("handles ContentTitle object and escapes HTML characters in formTitle and formOwner", async () => {
      const contentTitle: ContentTitle = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Survey <Alpha> & 'Beta' \"Gamma\"" },
            ],
          },
        ],
      };

      const data: FormLinkEmailData = {
        formId: "form-abc",
        formTitle: contentTitle,
        formOwner: "Admin <Main & Co>",
        recipientEmails: ["user@example.com"],
      };

      const result = await emailService.sendFormLinks(data);

      expect(result).toBe(true);
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.subject).toBe(
        "Form Invitation: Survey <Alpha> & 'Beta' \"Gamma\"",
      );
      // In HTML body, it should be escaped
      expect(mailOptions.html).toContain(
        "Survey &lt;Alpha&gt; &amp; &#039;Beta&#039; &quot;Gamma&quot;",
      );
      expect(mailOptions.html).toContain("Admin <Main & Co>");
      // Message paragraph should not exist if message is undefined
      expect(mailOptions.html).not.toContain("<em></em>");
    });
  });

  describe("sendResponseResults", () => {
    test("sends response results with complete data, correct score calculation, and auto-scored label", async () => {
      const submittedDate = new Date("2026-03-15T10:30:00Z");
      const data: ResponseEmailData = {
        to: "respondent@example.com",
        formTitle: "Exit Survey",
        totalScore: 80,
        maxScore: 100,
        responseId: "resp-999",
        isAutoScored: true,
        respondentName: "Jane Doe",
        submittedAt: submittedDate,
        questions: [
          {
            title: "Question 1: Multiple Choice",
            type: "MULTIPLE_CHOICE",
            answer: "Option A",
            userResponse: "Option A",
            score: 50,
            maxScore: 50,
          },
          {
            title: "Question 2: Partial Score",
            type: "CHECKBOX",
            answer: ["A", "B"],
            userResponse: ["A"],
            score: 20,
            maxScore: 30,
          },
          {
            title: "Question 3: Failed Question",
            type: "TEXT",
            answer: "Correct answer text",
            userResponse: "Wrong answer text",
            score: 0,
            maxScore: 20,
          },
          {
            title: "Question 4: No Correct Answer Provided",
            type: "TEXT",
            answer: null,
            userResponse: "My free response",
            score: 10,
            maxScore: 10,
          },
        ],
      };

      const result = await emailService.sendResponseResults(data);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("respondent@example.com");
      expect(mailOptions.subject).toBe("🎯 Results for: Exit Survey");
      expect(mailOptions.html).toContain("80/100");
      expect(mailOptions.html).toContain("80.0%");
      expect(mailOptions.html).toContain("Jane Doe");
      expect(mailOptions.html).toContain("resp-999");
      expect(mailOptions.html).toContain("🤖 Automatically calculated");
      expect(mailOptions.html).toContain(submittedDate.toLocaleDateString());

      // Question 1 - Full score (Correct)
      expect(mailOptions.html).toContain("✓ Correct");
      expect(mailOptions.html).toContain("score-correct");
      expect(mailOptions.html).toContain("correct-answer");
      expect(mailOptions.html).toContain("50/50 points");

      // Question 2 - Partial score
      expect(mailOptions.html).toContain("~ Partial");
      expect(mailOptions.html).toContain("score-partial");
      expect(mailOptions.html).toContain("20/30 points");

      // Question 3 - Incorrect score
      expect(mailOptions.html).toContain("✗ Incorrect");
      expect(mailOptions.html).toContain("score-incorrect");
      expect(mailOptions.html).toContain("wrong-answer");
      expect(mailOptions.html).toContain("0/20 points");

      // Question 4 - Question without answer key
      expect(mailOptions.html).toContain("My free response");
    });

    test("handles edge cases: zero score, default respondent name, default submitted date, manual scoring, and empty questions", async () => {
      const data: ResponseEmailData = {
        to: "anon@example.com",
        formTitle: "Anonymous Feedback",
        totalScore: 0,
        maxScore: 50,
        responseId: "resp-000",
        isAutoScored: false,
      };

      const result = await emailService.sendResponseResults(data);

      expect(result).toBe(true);
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.html).toContain("0/50");
      expect(mailOptions.html).toContain("0%");
      expect(mailOptions.html).toContain("Anonymous");
      expect(mailOptions.html).toContain("👨‍💼 Manually reviewed");
      expect(mailOptions.html).toContain(new Date().toLocaleDateString());
      expect(mailOptions.html).not.toContain("📝 Detailed Results");
    });
  });

  describe("sendResponseCardEmail", () => {
    const baseQuestion = {
      title: "Sample Question 1",
      type: "MULTIPLE_CHOICE",
      qIdx: 0,
      answer: 0,
      userResponse: 0,
      score: 10,
      maxScore: 10,
      isCorrect: true,
      choices: [
        { content: "Choice A", idx: 0, isCorrect: true },
        { content: "Choice B", idx: 1, isCorrect: false },
      ],
    };

    test.each([
      {
        percentage: 95,
        grade: "Excellent",
        emoji: "🏆",
        color: "#059669",
        bgColor: "#d1fae5",
      },
      {
        percentage: 85,
        grade: "Very Good",
        emoji: "🌟",
        color: "#0891b2",
        bgColor: "#cffafe",
      },
      {
        percentage: 75,
        grade: "Good",
        emoji: "👍",
        color: "#2563eb",
        bgColor: "#dbeafe",
      },
      {
        percentage: 65,
        grade: "Satisfactory",
        emoji: "📝",
        color: "#ca8a04",
        bgColor: "#fef9c3",
      },
      {
        percentage: 50,
        grade: "Pass",
        emoji: "✓",
        color: "#d97706",
        bgColor: "#ffedd5",
      },
      {
        percentage: 35,
        grade: "Needs Improvement",
        emoji: "📚",
        color: "#dc2626",
        bgColor: "#fee2e2",
      },
    ])(
      "assigns correct grade '$grade' and emoji '$emoji' for score percentage $percentage%",
      async ({ percentage, grade, emoji, color, bgColor }) => {
        const data: ResponseCardEmailData = {
          to: "grade-test@example.com",
          formTitle: "Grading Test",
          totalScore: percentage,
          maxScore: 100,
          scorePercentage: percentage,
          correctCount: 1,
          incorrectCount: 0,
          totalQuestions: 1,
          responseId: "resp-grade",
          isQuizForm: true,
          includeAnswerKey: true,
          questions: [baseQuestion],
        };

        const result = await emailService.sendResponseCardEmail(data);

        expect(result).toBe(true);
        const mailOptions = mockSendMail.mock.calls[0][0];

        expect(mailOptions.subject).toContain(
          `${emoji} Your Results: Grading Test (${percentage}%)`,
        );
        expect(mailOptions.html).toContain(grade);
        expect(mailOptions.html).toContain(color);
        expect(mailOptions.html).toContain(bgColor);
      },
    );

    test("formats userResponse with various types in formatUserResponse", async () => {
      const data: ResponseCardEmailData = {
        to: "types-test@example.com",
        formTitle: "Type Check Survey",
        totalScore: 50,
        maxScore: 100,
        scorePercentage: 50,
        correctCount: 2,
        incorrectCount: 2,
        totalQuestions: 7,
        responseId: "resp-types",
        isQuizForm: true,
        includeAnswerKey: true,
        respondentEmail: "respondent@example.com",
        respondentName: "Jane Doe",
        submittedAt: new Date("2026-05-10T14:00:00Z"),
        questions: [
          // 1. null / undefined / empty string
          {
            title: "Q1: Empty response",
            type: "TEXT",
            qIdx: 0,
            answer: "Expected",
            userResponse: null,
            score: 0,
            maxScore: 10,
            isCorrect: false,
          },
          // 2. Choice with numeric index found
          {
            title: "Q2: Single Choice Match",
            type: "CHOICE",
            qIdx: 1,
            answer: 1,
            userResponse: 1,
            score: 10,
            maxScore: 10,
            isCorrect: true,
            choices: [
              { content: "Option X <special>", idx: 0 },
              { content: "Option Y", idx: 1, isCorrect: true },
            ],
          },
          // 3. Choice with numeric index not found
          {
            title: "Q3: Single Choice Unknown",
            type: "CHOICE",
            qIdx: 2,
            answer: 0,
            userResponse: 99,
            score: 0,
            maxScore: 10,
            isCorrect: false,
            choices: [{ content: "Option X", idx: 0 }],
          },
          // 4. Choice with array of selected indices
          {
            title: "Q4: Multi Choice Match",
            type: "CHECKBOX",
            qIdx: 3,
            answer: [0, 1],
            userResponse: [0, 1],
            score: 10,
            maxScore: 10,
            isCorrect: true,
            choices: [
              { content: "Alpha", idx: 0, isCorrect: true },
              { content: "Beta", idx: 1, isCorrect: true },
              { content: "Gamma", idx: 2, isCorrect: false },
            ],
          },
          // 5. Choice with empty/non-matching array
          {
            title: "Q5: Multi Choice None",
            type: "CHECKBOX",
            qIdx: 4,
            answer: [0],
            userResponse: [999],
            score: 0,
            maxScore: 10,
            isCorrect: false,
            choices: [{ content: "Alpha", idx: 0 }],
          },
          // 6. Choice with object val format (array vs string)
          {
            title: "Q6: Object Val Format Array",
            type: "CHOICE_OBJ",
            qIdx: 5,
            answer: { val: ["Item 1", "Item 2"] },
            userResponse: { val: ["Item 1", "Item 2"] },
            score: 10,
            maxScore: 10,
            isCorrect: true,
            choices: [{ content: "Ignored", idx: 0 }],
          },
          {
            title: "Q7: Object Val Format Single",
            type: "CHOICE_OBJ",
            qIdx: 6,
            answer: { val: "Single Val" },
            userResponse: { val: "Single Val" },
            score: 10,
            maxScore: 10,
            isCorrect: true,
            choices: [{ content: "Ignored", idx: 0 }],
          },
        ],
      };

      const result = await emailService.sendResponseCardEmail(data);

      expect(result).toBe(true);
      const mailOptions = mockSendMail.mock.calls[0][0];

      // Respondent info checks
      expect(mailOptions.html).toContain("Jane Doe");
      expect(mailOptions.html).toContain("✉️ Email");
      expect(mailOptions.html).toContain("respondent@example.com");

      // Q1: No answer provided
      expect(mailOptions.html).toContain("No answer provided");
      // Q2: Option Y
      expect(mailOptions.html).toContain("Option Y");
      // Q3: Fallback string "99"
      expect(mailOptions.html).toContain("99");
      // Q4: Multi choice bullets
      expect(mailOptions.html).toContain("• Alpha");
      expect(mailOptions.html).toContain("• Beta");
      // Q5: No selections made
      expect(mailOptions.html).toContain("No selections made");
      // Q6: Object val array bullets
      expect(mailOptions.html).toContain("• Item 1");
      expect(mailOptions.html).toContain("• Item 2");
      // Q7: Object val single
      expect(mailOptions.html).toContain("Single Val");
    });

    test("formats non-choice responses (range object, generic object, primitive) and correct answers", async () => {
      const data: ResponseCardEmailData = {
        to: "non-choice@example.com",
        formTitle: "Non Choice Tests",
        totalScore: 30,
        maxScore: 50,
        scorePercentage: 60,
        correctCount: 2,
        incorrectCount: 1,
        totalQuestions: 4,
        responseId: "resp-non-choice",
        isQuizForm: false,
        includeAnswerKey: true,
        completionStatus: "Submitted Early",
        questions: [
          // Range object { start, end }
          {
            title: "Q1: Date/Time Range",
            type: "RANGE",
            qIdx: 0,
            answer: { start: "09:00", end: "17:00" },
            userResponse: { start: "09:00", end: "18:00" },
            score: 0,
            maxScore: 10,
            isCorrect: false,
          },
          // Generic object
          {
            title: "Q2: Coordinates",
            type: "OBJECT",
            qIdx: 1,
            answer: { lat: 10, lng: 20 },
            userResponse: { lat: 10, lng: 20 },
            score: 10,
            maxScore: 10,
            isCorrect: true,
          },
          // Array answer without choices
          {
            title: "Q3: Text List Answer",
            type: "TAGS",
            qIdx: 2,
            answer: ["React", "TypeScript"],
            userResponse: "React",
            score: 5,
            maxScore: 10,
            isCorrect: false,
          },
          // Question with zero maxScore (no score)
          {
            title: "Q4: Demographic Info",
            type: "TEXT",
            qIdx: 3,
            answer: null,
            userResponse: "Graduated in 2024",
            score: 0,
            maxScore: 0,
          },
        ],
      };

      const result = await emailService.sendResponseCardEmail(data);

      expect(result).toBe(true);
      const mailOptions = mockSendMail.mock.calls[0][0];

      // Status label (since respondentEmail is not provided)
      expect(mailOptions.html).toContain("📊 Status");
      expect(mailOptions.html).toContain("Submitted Early");

      // Q1 Range: start -> end
      expect(mailOptions.html).toContain("09:00 → 18:00");
      expect(mailOptions.html).toContain("09:00 → 17:00");

      // Q2 Generic Object JSON
      expect(mailOptions.html).toContain("&quot;lat&quot;:10");

      // Q3 Array correct answer
      expect(mailOptions.html).toContain("✓ React");
      expect(mailOptions.html).toContain("✓ TypeScript");
      // Partial score badge for Q3 (score 5 out of 10)
      expect(mailOptions.html).toContain("~ Partial");

      // Q4 No Score question (maxScore === 0): footer points row should not be rendered
      expect(mailOptions.html).not.toContain("0/0 points");
    });

    test("handles empty questions array", async () => {
      const data: ResponseCardEmailData = {
        to: "empty-questions@example.com",
        formTitle: "No Questions Form",
        totalScore: 0,
        maxScore: 0,
        scorePercentage: 0,
        correctCount: 0,
        incorrectCount: 0,
        totalQuestions: 0,
        responseId: "resp-empty",
        isQuizForm: false,
        includeAnswerKey: false,
        questions: [],
      };

      const result = await emailService.sendResponseCardEmail(data);

      expect(result).toBe(true);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).not.toContain("📋 Detailed Results");
    });
  });

  describe("Private Helper Methods", () => {
    describe("escapeHtml", () => {
      test("escapes all HTML special characters: &, <, >, \", '", () => {
        const escapeHtml = (emailService as any).escapeHtml.bind(emailService);

        expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#039;");
        expect(escapeHtml("Hello World")).toBe("Hello World");
        expect(escapeHtml("<script>alert('xss')</script>")).toBe(
          "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
        );
      });
    });

    describe("convertTitleToString", () => {
      test("returns string as is when input is a string", () => {
        const convertTitleToString = (
          emailService as any
        ).convertTitleToString.bind(emailService);

        expect(convertTitleToString("Simple Title")).toBe("Simple Title");
      });

      test("calls contentTitleToString when input is a ContentTitle object", () => {
        const convertTitleToString = (
          emailService as any
        ).convertTitleToString.bind(emailService);

        const contentTitle: ContentTitle = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Rich Text Title" }],
            },
          ],
        };

        expect(convertTitleToString(contentTitle)).toBe("Rich Text Title");
      });
    });

    describe("formatAnswer", () => {
      test("formats null and undefined as <em>No answer provided</em>", () => {
        const formatAnswer = (emailService as any).formatAnswer.bind(
          emailService,
        );

        expect(formatAnswer(null)).toBe("<em>No answer provided</em>");
        expect(formatAnswer(undefined)).toBe("<em>No answer provided</em>");
      });

      test("formats empty array as <em>No selections made</em> and non-empty array with joined commas", () => {
        const formatAnswer = (emailService as any).formatAnswer.bind(
          emailService,
        );

        expect(formatAnswer([])).toBe("<em>No selections made</em>");
        expect(formatAnswer(["Apple", "Banana", "Orange"])).toBe(
          "Apple, Banana, Orange",
        );
      });

      test("formats primitive numbers and booleans using String()", () => {
        const formatAnswer = (emailService as any).formatAnswer.bind(
          emailService,
        );

        expect(formatAnswer(42)).toBe("42");
        expect(formatAnswer(true)).toBe("true");
        expect(formatAnswer("plain text")).toBe("plain text");
      });
    });
  });
});
