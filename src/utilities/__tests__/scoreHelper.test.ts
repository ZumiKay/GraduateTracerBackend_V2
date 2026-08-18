import { ContentType } from "../../model/Content.model";
import { MockContentFactory } from "../mockdata";
import { getFormScoringAnalysis } from "../scoreHelper";

describe("getFormScoringAnalysis", () => {
  const formId = MockContentFactory.createFormId();

  describe("Basic Question Sets", () => {
    test("returns all zeros and isAutoScoreable: false for empty question list", () => {
      const result = getFormScoringAnalysis({ questions: [] });

      expect(result).toEqual({
        isAutoScoreable: false,
        scoredQuestions: 0,
        autoScorableQuestions: 0,
        manualGradingQuestions: 0,
      });
    });

    test("isAutoScoreable should be false if there is a manual grading question", () => {
      const questions = [
        MockContentFactory.createMultipleChoiceContent({ score: 20 }),
        MockContentFactory.createNumberContent({ score: 10 }),
        MockContentFactory.createParagraphContent({
          score: 5,
          answer: undefined,
        }),
      ];

      const result = getFormScoringAnalysis({ questions });

      expect(result.isAutoScoreable).toBe(false);
      expect(result.manualGradingQuestions).toBe(1);
      expect(result.autoScorableQuestions).toBe(2);
      expect(result.scoredQuestions).toBe(3);
    });

    test("isAutoScoreable should be true when all scored questions have answer keys", () => {
      const questions = [
        MockContentFactory.createMultipleChoiceContent({ score: 10 }),
        MockContentFactory.createCheckboxContent({ score: 15 }),
        MockContentFactory.createNumberContent({ score: 5 }),
        MockContentFactory.createShortAnswerContent({
          score: 20,
          answer: { answer: "answer key", isCorrect: true } as any,
        }),
      ];

      const result = getFormScoringAnalysis({ questions });

      expect(result.isAutoScoreable).toBe(true);
      expect(result.scoredQuestions).toBe(4);
      expect(result.autoScorableQuestions).toBe(4);
      expect(result.manualGradingQuestions).toBe(0);
    });

    test("display-only text questions should never count towards scored or manual grading", () => {
      const questions = [
        MockContentFactory.createTextContent({ score: 0 }),
        MockContentFactory.createTextContent({ score: 10 as any }), // Text questions ignored even if score present
        MockContentFactory.createMultipleChoiceContent({ score: 10 }),
      ];

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(2);
      expect(result.autoScorableQuestions).toBe(1); // Only MultipleChoice has answer key
      expect(result.manualGradingQuestions).toBe(0); // Text is display-only
    });
  });

  //Larget question sets
  describe("Large Question Sets", () => {
    test("accurately counts 500 fully auto-scorable questions", () => {
      const COUNT = 500;
      const questions: ContentType[] = Array.from({ length: COUNT }, (_, i) => {
        const types = [
          MockContentFactory.createMultipleChoiceContent({
            formId,
            qIdx: i,
            score: 10,
          }),
          MockContentFactory.createCheckboxContent({
            formId,
            qIdx: i,
            score: 15,
          }),
          MockContentFactory.createNumberContent({ formId, qIdx: i, score: 5 }),
          MockContentFactory.createDateContent({ formId, qIdx: i, score: 5 }),
        ];
        return types[i % types.length];
      });

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(COUNT);
      expect(result.autoScorableQuestions).toBe(COUNT);
      expect(result.manualGradingQuestions).toBe(0);
      expect(result.isAutoScoreable).toBe(true);
    });

    test("accurately analyzes 1,000 mixed questions across all categories", () => {
      const AUTO_COUNT = 400;
      const MANUAL_COUNT = 200;
      const NON_SCORED_COUNT = 200;
      const DISPLAY_TEXT_COUNT = 200;
      const TOTAL =
        AUTO_COUNT + MANUAL_COUNT + NON_SCORED_COUNT + DISPLAY_TEXT_COUNT; // 1,000

      const questions: ContentType[] = [];

      // 1. Auto-scorable (score > 0 with answer keys)
      for (let i = 0; i < AUTO_COUNT; i++) {
        questions.push(
          MockContentFactory.createMultipleChoiceContent({
            formId,
            qIdx: questions.length,
            score: 10,
          }),
        );
      }

      // 2. Manual grading (ShortAnswer & Paragraph with score > 0 but no answer keys)
      for (let i = 0; i < MANUAL_COUNT; i++) {
        questions.push(
          i % 2 === 0
            ? MockContentFactory.createShortAnswerContent({
                formId,
                qIdx: questions.length,
                score: 10,
                answer: undefined,
              })
            : MockContentFactory.createParagraphContent({
                formId,
                qIdx: questions.length,
                score: 15,
                answer: undefined,
              }),
        );
      }

      // 3. Non-scored questions (score: 0)
      for (let i = 0; i < NON_SCORED_COUNT; i++) {
        questions.push(
          MockContentFactory.createMultipleChoiceContent({
            formId,
            qIdx: questions.length,
            score: 0,
          }),
        );
      }

      // 4. Display-only text questions
      for (let i = 0; i < DISPLAY_TEXT_COUNT; i++) {
        questions.push(
          MockContentFactory.createTextContent({
            formId,
            qIdx: questions.length,
            score: 0,
          }),
        );
      }

      expect(questions.length).toBe(TOTAL);

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(AUTO_COUNT + MANUAL_COUNT); // 600
      expect(result.autoScorableQuestions).toBe(AUTO_COUNT); // 400
      expect(result.manualGradingQuestions).toBe(MANUAL_COUNT); // 200
      expect(result.isAutoScoreable).toBe(false);
    });

    test("detects a single manual grading question among 500 auto-scorable questions (boundary test)", () => {
      const TOTAL = 500;
      const questions: ContentType[] = Array.from(
        { length: TOTAL - 1 },
        (_, i) =>
          MockContentFactory.createMultipleChoiceContent({
            formId,
            qIdx: i,
            score: 10,
          }),
      );

      // Insert 1 manual grading question at the end
      questions.push(
        MockContentFactory.createParagraphContent({
          formId,
          qIdx: TOTAL - 1,
          score: 25,
          answer: undefined,
        }),
      );

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(TOTAL);
      expect(result.autoScorableQuestions).toBe(TOTAL - 1);
      expect(result.manualGradingQuestions).toBe(1);
      expect(result.isAutoScoreable).toBe(false);
    });

    test("correctly handles 300 non-scored questions", () => {
      const COUNT = 300;
      const questions: ContentType[] = Array.from({ length: COUNT }, (_, i) =>
        MockContentFactory.createMultipleChoiceContent({
          formId,
          qIdx: i,
          score: 0,
        }),
      );

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(0);
      expect(result.autoScorableQuestions).toBe(0);
      expect(result.manualGradingQuestions).toBe(0);
      expect(result.isAutoScoreable).toBe(false);
    });

    test("analyzes 250 ShortAnswer/Paragraph questions with valid answer keys as auto-scorable", () => {
      const COUNT = 250;
      const questions: ContentType[] = Array.from({ length: COUNT }, (_, i) =>
        i % 2 === 0
          ? MockContentFactory.createShortAnswerContent({
              formId,
              qIdx: i,
              score: 10,
              answer: { answer: `sample answer ${i}`, isCorrect: true } as any,
            })
          : MockContentFactory.createParagraphContent({
              formId,
              qIdx: i,
              score: 20,
              answer: {
                answer: `paragraph answer ${i}`,
                isCorrect: true,
              } as any,
            }),
      );

      const result = getFormScoringAnalysis({ questions });

      expect(result.scoredQuestions).toBe(COUNT);
      expect(result.autoScorableQuestions).toBe(COUNT);
      expect(result.manualGradingQuestions).toBe(0);
      expect(result.isAutoScoreable).toBe(true);
    });

    test("processes 5,000 questions efficiently", () => {
      const COUNT = 5000;
      const questions: ContentType[] = Array.from({ length: COUNT }, (_, i) =>
        MockContentFactory.createMultipleChoiceContent({
          formId,
          qIdx: i,
          score: 10,
        }),
      );

      const startTime = performance.now();
      const result = getFormScoringAnalysis({ questions });
      const durationMs = performance.now() - startTime;

      expect(result.scoredQuestions).toBe(COUNT);
      expect(result.autoScorableQuestions).toBe(COUNT);
      expect(result.isAutoScoreable).toBe(true);
      expect(durationMs).toBeLessThan(500); // Must execute in under 500ms
    });
  });
});
