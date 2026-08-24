"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Content_model_1 = __importDefault(require("../../model/Content.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const Question_Service_1 = require("../Question.Service");
const mockdata_1 = require("../../utilities/mockdata");
const helper_1 = require("../../utilities/helper");
// Mock dependencies
jest.mock("../../model/Content.model");
jest.mock("../../model/Form.model");
describe("QuestionService", () => {
    const formId = new mongoose_1.Types.ObjectId().toString();
    const q1Id = new mongoose_1.Types.ObjectId();
    beforeEach(() => {
        jest.clearAllMocks();
        Question_Service_1.QuestionService.comparisonCache?.clear?.();
    });
    //save question
    describe("saveQuestion", () => {
        test("returns error for invalid payload", async () => {
            const result = await Question_Service_1.QuestionService.saveQuestion({
                data: null,
                formId: "",
            });
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("Invalid request payload");
        });
        test("returns error when validation issue is present in content", async () => {
            const result = await Question_Service_1.QuestionService.saveQuestion({
                formId,
                page: 1,
                data: [
                    mockdata_1.MockContentFactory.createTextContent({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        validationIssues: [{ type: "error" }],
                    }),
                ],
            });
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("Validation error");
        });
        test("returns noChanges: true when existing content matches new data", async () => {
            const mockQuestion = mockdata_1.MockContentFactory.createTextContent({
                _id: q1Id,
                formId: new mongoose_1.Types.ObjectId(formId),
                page: 1,
                qIdx: 0,
            });
            Content_model_1.default.find.mockResolvedValue([mockQuestion]);
            Form_model_1.default.updateOne.mockResolvedValue({ modifiedCount: 1 });
            const result = await Question_Service_1.QuestionService.saveQuestion({
                formId,
                page: 1,
                title: "Updated Title",
                data: [mockQuestion],
            });
            expect(result.success).toBe(true);
            expect(result.noChanges).toBe(true);
            expect(result.message).toBe("No changes detected");
            expect(Form_model_1.default.updateOne).toHaveBeenCalledWith({ _id: formId }, { title: "Updated Title" });
        });
        test("returns score validation error if child scores exceed parent score", async () => {
            const parentQId = new mongoose_1.Types.ObjectId();
            const childQId = new mongoose_1.Types.ObjectId();
            const parentQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                _id: parentQId,
                formId: new mongoose_1.Types.ObjectId(formId),
                score: 10,
                qIdx: 0,
                conditional: [
                    { _id: new mongoose_1.Types.ObjectId(), key: 0, contentId: childQId },
                ],
            });
            const childQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                _id: childQId,
                formId: new mongoose_1.Types.ObjectId(formId),
                score: 15, // Exceeds parent's 10
                qIdx: 1,
                parentcontent: { qId: parentQId.toString(), optIdx: 0 },
            });
            Content_model_1.default.find.mockResolvedValue([]);
            const result = await Question_Service_1.QuestionService.saveQuestion({
                formId,
                page: 1,
                data: [parentQuestion, childQuestion],
            });
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("Score Validation Error");
        });
        test("successfully saves questions, runs bulk operations, and recalculates form score", async () => {
            const mockQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                _id: q1Id,
                formId: new mongoose_1.Types.ObjectId(formId),
                page: 1,
                qIdx: 0,
                score: 10,
            });
            Content_model_1.default.find
                .mockResolvedValueOnce([]) // existingContent (empty)
                .mockResolvedValueOnce([]) // toBeDeleted (empty)
                .mockResolvedValueOnce([{ score: 10, isBonusScore: false }]) // calculateFormTotalScore
                .mockResolvedValueOnce([mockQuestion]); // fetchUpdatedContent
            Content_model_1.default.bulkWrite.mockResolvedValue({ ok: 1 });
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ totalscore: 0 }),
            });
            Form_model_1.default.updateOne.mockResolvedValue({ modifiedCount: 1 });
            const result = await Question_Service_1.QuestionService.saveQuestion({
                formId,
                page: 1,
                title: "My Form",
                data: [mockQuestion],
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe("Saved Completed");
            expect(Content_model_1.default.bulkWrite).toHaveBeenCalled();
            expect(Form_model_1.default.updateOne).toHaveBeenCalledWith({ _id: formId }, expect.objectContaining({ totalscore: 10, title: "My Form" }));
        });
        test("detects useChildScoreSum change and recalculates form score", async () => {
            const parentQId = new mongoose_1.Types.ObjectId();
            const existingQuestion = mockdata_1.MockContentFactory.createCheckboxContent({
                _id: parentQId,
                formId: new mongoose_1.Types.ObjectId(formId),
                score: 10,
                useChildScoreSum: false,
                qIdx: 0,
            });
            const updatedQuestion = mockdata_1.MockContentFactory.createCheckboxContent({
                _id: parentQId,
                formId: new mongoose_1.Types.ObjectId(formId),
                score: 10,
                useChildScoreSum: true,
                qIdx: 0,
            });
            Content_model_1.default.find
                .mockResolvedValueOnce([existingQuestion]) // existingContent
                .mockResolvedValueOnce([]) // toBeDeleted
                .mockResolvedValueOnce([{ score: 10, isBonusScore: false }]) // calculateFormTotalScore
                .mockResolvedValueOnce([updatedQuestion]); // fetchUpdatedContent
            Content_model_1.default.bulkWrite.mockResolvedValue({ ok: 1 });
            Form_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ totalscore: 10 }),
            });
            Form_model_1.default.updateOne.mockResolvedValue({ modifiedCount: 1 });
            const result = await Question_Service_1.QuestionService.saveQuestion({
                formId,
                page: 1,
                data: [updatedQuestion],
            });
            expect(result.success).toBe(true);
            expect(Form_model_1.default.updateOne).toHaveBeenCalledWith({ _id: formId }, expect.objectContaining({ totalscore: 10 }));
        });
    });
    describe("Condition question valdiation test", () => {
        const validationChildQuestionScore = Question_Service_1.QuestionService.validateChildQuestionScores;
        test("should return null If question is invalid or have no score", () => {
            const parentQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({});
            const childsQuestion = [
                mockdata_1.MockContentFactory.createTextContent(),
                mockdata_1.MockContentFactory.createParagraphContent({ score: 0 }),
            ];
            const conditonedContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                parent: parentQuestion,
                childs: childsQuestion,
            });
            const isValid = validationChildQuestionScore(conditonedContents, conditonedContents);
            expect(isValid).toBe(null);
        });
        describe("useChildSum test", () => {
            let parent;
            let childs;
            beforeEach(() => {
                //Checkbox with 5 opt and 100 scores
                parent = mockdata_1.MockContentFactory.createCheckboxContent({
                    score: 100,
                    useChildScoreSum: true,
                });
                //Childs with the sum of score of 100
                childs = [
                    mockdata_1.MockContentFactory.createMultipleChoiceContent({ score: 10 }),
                    mockdata_1.MockContentFactory.createSelectionContent({ score: 20 }),
                    mockdata_1.MockContentFactory.createRangeNumberContent({ score: 30 }),
                    mockdata_1.MockContentFactory.createDateContent({ score: 20 }),
                    mockdata_1.MockContentFactory.createRangeNumberContent({ score: 20 }),
                ];
            });
            test("shoud return null score if all the contents is correct", () => {
                //Checkbox with 5 options with 100 score
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).toBeNull();
            });
            test("should return message if score is invalid", () => {
                childs[2].score = 0;
                childs[3].score = 10;
                const conditionalContents = (0, helper_1.AddQuestionNumbering)({
                    questions: mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                        parent,
                        childs,
                    }),
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).not.toBeNull();
                expect(isValid?.length).toBeGreaterThan(0);
                expect(isValid).toContain("Sum of children scores");
            });
            test("should return error message when child scores sum exceeds parent score", () => {
                childs[0].score = 50; // Sum becomes 50 + 20 + 30 + 20 + 20 = 140
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).not.toBeNull();
                expect(isValid).toBe(`Sum of children scores (140) of question ${parent.qIdx} must equal parent score (${parent.score})`);
            });
            test("should return error message when child scores sum is less than parent score", () => {
                childs[0].score = 5; // Sum becomes 5 + 20 + 30 + 20 + 20 = 95
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).not.toBeNull();
                expect(isValid).toBe(`Sum of children scores (95) of question ${parent.qIdx} must equal parent score (${parent.score})`);
            });
            test("should return null when a single child has score equal to parent score and others have 0", () => {
                childs[0].score = 100;
                childs[1].score = 0;
                childs[2].score = 0;
                childs[3].score = 0;
                childs[4].score = 0;
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).toBeNull();
            });
            test("should return null when some children have undefined score and defined scores sum to parent score", () => {
                childs[0].score = 50;
                childs[1].score = 50;
                childs[2].score = undefined;
                childs[3].score = undefined;
                childs[4].score = undefined;
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).toBeNull();
            });
            test("should bypass sum validation when parent has isBonusScore: true", () => {
                parent.isBonusScore = true;
                childs[0].score = 500; // Sum is 590, != 100
                const conditionalContents = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent,
                    childs,
                });
                const isValid = validationChildQuestionScore(conditionalContents, conditionalContents);
                expect(isValid).toBeNull();
            });
            test("should correctly validate child score sum matching via contentIdx", () => {
                const parentId = new mongoose_1.Types.ObjectId();
                const customParent = mockdata_1.MockContentFactory.createCheckboxContent({
                    _id: parentId,
                    qIdx: 0,
                    score: 50,
                    useChildScoreSum: true,
                    conditional: [
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: undefined,
                            contentIdx: 1,
                        },
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 1,
                            contentId: undefined,
                            contentIdx: 2,
                        },
                    ],
                });
                const child1 = mockdata_1.MockContentFactory.createTextContent({
                    qIdx: 1,
                    score: 20,
                    parentcontent: {
                        qId: parentId.toString(),
                        optIdx: 0,
                    },
                });
                const child2 = mockdata_1.MockContentFactory.createTextContent({
                    qIdx: 2,
                    score: 30,
                    parentcontent: {
                        qId: parentId.toString(),
                        optIdx: 1,
                    },
                });
                const data = [customParent, child1, child2];
                // Valid sum (20 + 30 = 50)
                expect(validationChildQuestionScore(data, data)).toBeNull();
                // Invalid sum (20 + 40 = 60 != 50)
                child2.score = 40;
                expect(validationChildQuestionScore(data, data)).toBe(`Sum of children scores (60) of question ${customParent.qIdx} must equal parent score (${customParent.score})`);
            });
            test("should validate multiple parents with different useChildScoreSum configurations independently", () => {
                const parent1 = mockdata_1.MockContentFactory.createCheckboxContent({
                    _id: new mongoose_1.Types.ObjectId(),
                    qIdx: 0,
                    score: 60,
                    useChildScoreSum: true,
                });
                const p1Child1 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    score: 40,
                });
                const p1Child2 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    score: 20,
                });
                const p1Tree = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent: parent1,
                    childs: [p1Child1, p1Child2],
                });
                const parent2 = mockdata_1.MockContentFactory.createCheckboxContent({
                    _id: new mongoose_1.Types.ObjectId(),
                    qIdx: 3,
                    score: 50,
                    useChildScoreSum: false,
                });
                const p2Child1 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    score: 40,
                });
                const p2Child2 = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    score: 30,
                });
                const p2Tree = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
                    parent: parent2,
                    childs: [p2Child1, p2Child2],
                });
                const combinedData = [...p1Tree, ...p2Tree];
                // Both trees valid under their respective rules
                expect(validationChildQuestionScore(combinedData, combinedData)).toBeNull();
                // Breaking parent1's sum validation (40 + 30 = 70 != 60)
                p1Tree[2].score = 30;
                expect(validationChildQuestionScore(combinedData, combinedData)).toContain(`Sum of children scores (70) of question ${parent1.qIdx} must equal parent score (${parent1.score})`);
            });
        });
    });
    //Delete question
    describe("deleteQuestion", () => {
        test("returns error for missing id or formId", async () => {
            const result = await Question_Service_1.QuestionService.deleteQuestion("", formId);
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("Invalid request payload");
        });
        test("returns error if content not found", async () => {
            Content_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                }),
            });
            const result = await Question_Service_1.QuestionService.deleteQuestion(q1Id.toString(), formId);
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("Content not found");
        });
        test("successfully deletes question and linked conditional questions", async () => {
            const childId = new mongoose_1.Types.ObjectId();
            Content_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        score: 10,
                        conditional: [{ contentId: childId }],
                    }),
                }),
            });
            Content_model_1.default.deleteOne.mockResolvedValue({ deletedCount: 1 });
            Content_model_1.default.deleteMany.mockResolvedValue({ deletedCount: 1 });
            Content_model_1.default.updateMany.mockResolvedValue({ modifiedCount: 1 });
            Form_model_1.default.updateOne.mockResolvedValue({ modifiedCount: 1 });
            const result = await Question_Service_1.QuestionService.deleteQuestion(q1Id.toString(), formId);
            expect(result.success).toBe(true);
            expect(result.message).toBe("Question Deleted");
            expect(Content_model_1.default.deleteOne).toHaveBeenCalledWith({ _id: q1Id.toString() });
            expect(Content_model_1.default.deleteMany).toHaveBeenCalledWith({
                _id: { $in: [childId] },
            });
            expect(Form_model_1.default.updateOne).toHaveBeenCalledWith({ _id: formId }, {
                $pull: { contentIds: q1Id.toString() },
                $inc: { totalscore: -10 },
            });
        });
    });
    describe("saveSolution", () => {
        test("returns error if data is empty", async () => {
            const result = await Question_Service_1.QuestionService.saveSolution([]);
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toBe("No solution data provided");
        });
        test("successfully saves solutions using Form.bulkWrite", async () => {
            Form_model_1.default.bulkWrite.mockResolvedValue({ ok: 1 });
            const solutions = [
                {
                    _id: new mongoose_1.Types.ObjectId(),
                    answer: 1,
                },
            ];
            const result = await Question_Service_1.QuestionService.saveSolution(solutions);
            expect(result.success).toBe(true);
            expect(result.message).toBe("Solution Saved");
            expect(Form_model_1.default.bulkWrite).toHaveBeenCalled();
        });
    });
    describe("utility methods", () => {
        test("convertStringToDate parses valid dates and returns undefined for invalid", () => {
            expect(Question_Service_1.QuestionService.convertStringToDate("2026-08-18")).toBeInstanceOf(Date);
            expect(Question_Service_1.QuestionService.convertStringToDate("invalid-date")).toBeUndefined();
        });
        test("generateNewQuestionIds assigns new ObjectIds only to questions without _id", () => {
            const existingId = new mongoose_1.Types.ObjectId();
            const data = [
                { _id: existingId, text: "Existing" },
                { text: "New" },
            ];
            const { questionIdMap, newIds } = Question_Service_1.QuestionService.generateNewQuestionIds(data);
            expect(questionIdMap.size).toBe(1);
            expect(questionIdMap.has(1)).toBe(true);
            expect(newIds.length).toBe(1);
        });
        test("calculateFormTotalScore separates bonus scores from totalscore", async () => {
            Content_model_1.default.find.mockResolvedValue([
                { score: 10, isBonusScore: false },
                { score: 5, isBonusScore: true },
                { score: 20 },
            ]);
            const scores = await Question_Service_1.QuestionService.calculateFormTotalScore(formId);
            expect(scores.totalscore).toBe(30);
            expect(scores.extraScore).toBe(5);
        });
    });
});
