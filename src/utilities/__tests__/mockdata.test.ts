import { Types } from "mongoose";
import { MockContentFactory } from "../mockdata";
import { QuestionType } from "../../model/Content.model";
import { ScoringMethod } from "../../model/Response.model";

describe("MockContentFactory ResponseSet Generation", () => {
  describe("generateResponseForQuestion", () => {
    it("should return the answer defined on question if present", () => {
      const mcq = MockContentFactory.createMultipleChoiceContent({
        answer: { _id: new Types.ObjectId(), answer: 2, isCorrect: true },
      });
      const response = MockContentFactory.generateResponseForQuestion(mcq);
      expect(response).toBe(2);
    });

    it("should generate valid response for CheckBox without predefined answer", () => {
      const checkbox = MockContentFactory.createCheckboxContent({
        answer: undefined,
      });
      const response = MockContentFactory.generateResponseForQuestion(checkbox);
      expect(Array.isArray(response)).toBe(true);
    });

    it("should generate valid string for Text / ShortAnswer / Paragraph", () => {
      const text = MockContentFactory.createTextContent();
      const shortAns = MockContentFactory.createShortAnswerContent();
      const paragraph = MockContentFactory.createParagraphContent();

      expect(typeof MockContentFactory.generateResponseForQuestion(text)).toBe("string");
      expect(typeof MockContentFactory.generateResponseForQuestion(shortAns)).toBe("string");
      expect(typeof MockContentFactory.generateResponseForQuestion(paragraph)).toBe("string");
    });

    it("should generate valid number for Number question", () => {
      const numQ = MockContentFactory.createNumberContent();
      const response = MockContentFactory.generateResponseForQuestion(numQ);
      expect(typeof response).toBe("number");
    });

    it("should generate date string for Date question", () => {
      const dateQ = MockContentFactory.createDateContent();
      const response = MockContentFactory.generateResponseForQuestion(dateQ);
      expect(typeof response).toBe("string");
      expect(!isNaN(new Date(response as string).getTime())).toBe(true);
    });

    it("should generate RangeType<string> for RangeDate question", () => {
      const rangeDateQ = MockContentFactory.createRangeDateContent();
      const response = MockContentFactory.generateResponseForQuestion(rangeDateQ) as {
        start: string;
        end: string;
      };
      expect(response).toHaveProperty("start");
      expect(response).toHaveProperty("end");
    });

    it("should generate RangeType<number> for RangeNumber question", () => {
      const rangeNumQ = MockContentFactory.createRangeNumberContent();
      const response = MockContentFactory.generateResponseForQuestion(rangeNumQ) as {
        start: number;
        end: number;
      };
      expect(response).toHaveProperty("start");
      expect(response).toHaveProperty("end");
      expect(typeof response.start).toBe("number");
      expect(typeof response.end).toBe("number");
    });
  });

  describe("generateResponseSet", () => {
    it("should generate a default ResponseSetType when called without arguments", () => {
      const resSet = MockContentFactory.generateResponseSet();
      expect(resSet.question).toBeDefined();
      expect(resSet.response).toBeDefined();
      expect(resSet.scoringMethod).toBe(ScoringMethod.AUTO);
    });

    it("should generate a ResponseSetType from a ContentType question", () => {
      const mcq = MockContentFactory.createMultipleChoiceContent({ score: 15 });
      const resSet = MockContentFactory.generateResponseSet(mcq);

      expect(resSet.question).toEqual(mcq._id);
      expect(resSet.response).toBe(mcq.answer?.answer);
      expect(resSet.score).toBe(15);
      expect(resSet.scoringMethod).toBe(ScoringMethod.AUTO);
    });

    it("should generate a ResponseSetType from an ObjectId question ID", () => {
      const qId = new Types.ObjectId();
      const resSet = MockContentFactory.generateResponseSet(qId, {
        response: "Custom Answer",
      });

      expect(resSet.question).toEqual(qId);
      expect(resSet.response).toBe("Custom Answer");
    });

    it("should accept partial overrides", () => {
      const qId = new Types.ObjectId();
      const resSet = MockContentFactory.generateResponseSet({
        question: qId,
        response: [1, 2],
        score: 50,
      });

      expect(resSet.question).toEqual(qId);
      expect(resSet.response).toEqual([1, 2]);
      expect(resSet.score).toBe(50);
    });
  });

  describe("generateResponseSets", () => {
    it("should generate an array of ResponseSetType for sample form questions", () => {
      const questions = MockContentFactory.createSampleForm();
      const responseSets = MockContentFactory.generateResponseSets(questions);

      expect(responseSets.length).toBe(questions.length);
      responseSets.forEach((set, index) => {
        expect(set.question).toEqual(questions[index]._id);
        expect(set.response).toBeDefined();
        expect(set.scoringMethod).toBe(ScoringMethod.AUTO);
      });
    });
  });

  describe("createResponseSet", () => {
    it("should return a fully typed ResponseSetType", () => {
      const resSet = MockContentFactory.createResponseSet({ score: 25 });
      expect(resSet.question).toBeDefined();
      expect(resSet.score).toBe(25);
    });
  });
});
