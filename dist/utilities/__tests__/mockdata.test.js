"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const mockdata_1 = require("../mockdata");
const Response_model_1 = require("../../model/Response.model");
describe("MockContentFactory ResponseSet Generation", () => {
    describe("generateResponseForQuestion", () => {
        it("should return the answer defined on question if present", () => {
            const mcq = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                answer: { _id: new mongoose_1.Types.ObjectId(), answer: 2, isCorrect: true },
            });
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(mcq);
            expect(response).toBe(2);
        });
        it("should generate valid response for CheckBox without predefined answer", () => {
            const checkbox = mockdata_1.MockContentFactory.createCheckboxContent({
                answer: undefined,
            });
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(checkbox);
            expect(Array.isArray(response)).toBe(true);
        });
        it("should generate valid string for Text / ShortAnswer / Paragraph", () => {
            const text = mockdata_1.MockContentFactory.createTextContent();
            const shortAns = mockdata_1.MockContentFactory.createShortAnswerContent();
            const paragraph = mockdata_1.MockContentFactory.createParagraphContent();
            expect(typeof mockdata_1.MockContentFactory.generateResponseForQuestion(text)).toBe("string");
            expect(typeof mockdata_1.MockContentFactory.generateResponseForQuestion(shortAns)).toBe("string");
            expect(typeof mockdata_1.MockContentFactory.generateResponseForQuestion(paragraph)).toBe("string");
        });
        it("should generate valid number for Number question", () => {
            const numQ = mockdata_1.MockContentFactory.createNumberContent();
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(numQ);
            expect(typeof response).toBe("number");
        });
        it("should generate date string for Date question", () => {
            const dateQ = mockdata_1.MockContentFactory.createDateContent();
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(dateQ);
            expect(typeof response).toBe("string");
            expect(!isNaN(new Date(response).getTime())).toBe(true);
        });
        it("should generate RangeType<string> for RangeDate question", () => {
            const rangeDateQ = mockdata_1.MockContentFactory.createRangeDateContent();
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(rangeDateQ);
            expect(response).toHaveProperty("start");
            expect(response).toHaveProperty("end");
        });
        it("should generate RangeType<number> for RangeNumber question", () => {
            const rangeNumQ = mockdata_1.MockContentFactory.createRangeNumberContent();
            const response = mockdata_1.MockContentFactory.generateResponseForQuestion(rangeNumQ);
            expect(response).toHaveProperty("start");
            expect(response).toHaveProperty("end");
            expect(typeof response.start).toBe("number");
            expect(typeof response.end).toBe("number");
        });
    });
    describe("generateResponseSet", () => {
        it("should generate a default ResponseSetType when called without arguments", () => {
            const resSet = mockdata_1.MockContentFactory.generateResponseSet();
            expect(resSet.question).toBeDefined();
            expect(resSet.response).toBeDefined();
            expect(resSet.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
        });
        it("should generate a ResponseSetType from a ContentType question", () => {
            const mcq = mockdata_1.MockContentFactory.createMultipleChoiceContent({ score: 15 });
            const resSet = mockdata_1.MockContentFactory.generateResponseSet(mcq);
            expect(resSet.question).toEqual(mcq._id);
            expect(resSet.response).toBe(mcq.answer?.answer);
            expect(resSet.score).toBe(15);
            expect(resSet.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
        });
        it("should generate a ResponseSetType from an ObjectId question ID", () => {
            const qId = new mongoose_1.Types.ObjectId();
            const resSet = mockdata_1.MockContentFactory.generateResponseSet(qId, {
                response: "Custom Answer",
            });
            expect(resSet.question).toEqual(qId);
            expect(resSet.response).toBe("Custom Answer");
        });
        it("should accept partial overrides", () => {
            const qId = new mongoose_1.Types.ObjectId();
            const resSet = mockdata_1.MockContentFactory.generateResponseSet({
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
            const questions = mockdata_1.MockContentFactory.createSampleForm();
            const responseSets = mockdata_1.MockContentFactory.generateResponseSets(questions);
            expect(responseSets.length).toBe(questions.length);
            responseSets.forEach((set, index) => {
                expect(set.question).toEqual(questions[index]._id);
                expect(set.response).toBeDefined();
                expect(set.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            });
        });
    });
    describe("createResponseSet", () => {
        it("should return a fully typed ResponseSetType", () => {
            const resSet = mockdata_1.MockContentFactory.createResponseSet({ score: 25 });
            expect(resSet.question).toBeDefined();
            expect(resSet.score).toBe(25);
        });
    });
});
