"use strict";
/* ----------------------- Test For ResponseAnalytics ----------------------- */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* ------------------------------ Mock Modules ------------------------------ */
jest.mock("../../model/Response.model", () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
    ResponseCompletionStatus: {
        completed: "completed",
        noscore: "noscore",
        notreturn: "notreturn",
        autoscore: "autoscore",
        partial: "partial",
        abandoned: "abandoned",
        submitted: "submitted",
    },
}));
jest.mock("../../model/Content.model.ts", () => ({
    __esModule: true,
    default: {
        find: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
    QuestionType: {
        MultipleChoice: "multiple",
        CheckBox: "checkbox",
        Text: "texts",
        Number: "number",
        Date: "date",
        RangeDate: "rangedate",
        Selection: "selection",
        RangeNumber: "rangenumber",
        ShortAnswer: "shortanswer",
        Paragraph: "paragraph",
    },
}));
jest.mock("../../model/Form.model.ts", () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));
const Content_model_1 = __importDefault(require("../../model/Content.model"));
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const Response_model_1 = __importStar(require("../../model/Response.model"));
const mockdata_1 = require("../../utilities/mockdata");
const ResponseAnalyticsService_1 = require("../ResponseAnalyticsService");
describe("Test Choice Analytics Data", () => {
    const globalFormId = mockdata_1.MockContentFactory.createFormId();
    test("correctly Calculate choice Distribution", async () => {
        //Mocks
        const mockedQuestions = [
            mockdata_1.MockContentFactory.createCheckboxContent(),
            mockdata_1.MockContentFactory.createMultipleChoiceContent(),
            mockdata_1.MockContentFactory.createSelectionContent(),
        ];
        const mockedResponsesets = [
            [
                {
                    question: mockedQuestions[0]._id,
                    response: [1, 2, 3],
                    score: 10,
                },
                {
                    question: mockedQuestions[1]._id,
                    response: 3,
                    score: 10,
                },
                {
                    question: mockedQuestions[2]._id,
                    response: 2,
                    score: 10,
                },
            ],
            [
                {
                    question: mockedQuestions[0]._id,
                    response: [1, 2, 3],
                    score: 10,
                },
                {
                    question: mockedQuestions[1]._id,
                    response: 2,
                    score: 0,
                },
                {
                    question: mockedQuestions[2]._id,
                    response: 2,
                    score: 10,
                },
            ],
            [
                {
                    question: mockedQuestions[0]._id,
                    response: [1, 0, 3],
                    score: 0,
                },
                {
                    question: mockedQuestions[1]._id,
                    response: 1,
                    score: 0,
                },
                {
                    question: mockedQuestions[2]._id,
                    response: 2,
                    score: 10,
                },
            ],
        ];
        const mockedResponse = [
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: mockedResponsesets[0],
                maxScore: 30,
                completionStatus: Response_model_1.ResponseCompletionStatus.autoscore,
            },
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: mockedResponsesets[1],
                maxScore: 30,
                completionStatus: Response_model_1.ResponseCompletionStatus.autoscore,
            },
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: mockedResponsesets[2],
                maxScore: 30,
                completionStatus: Response_model_1.ResponseCompletionStatus.autoscore,
            },
        ];
        Form_model_1.default.findById.mockResolvedValue({
            _id: globalFormId,
        });
        Response_model_1.default.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockedResponse),
        });
        Content_model_1.default.find.mockResolvedValue(mockedQuestions);
        const choiceDistributionData = await ResponseAnalyticsService_1.ResponseAnalyticsService.getChoiceQuestionAnalytics(globalFormId.toString());
        //Matcher
        expect(choiceDistributionData.length).toBe(3);
        // Checkbox question
        const checkboxData = choiceDistributionData[0];
        expect(checkboxData.totalResponses).toBe(3);
        expect(checkboxData.rawData?.find((d) => d.choiceIdx === 0)?.count).toBe(1);
        expect(checkboxData.rawData?.find((d) => d.choiceIdx === 1)?.count).toBe(3);
        expect(checkboxData.rawData?.find((d) => d.choiceIdx === 2)?.count).toBe(2);
        expect(checkboxData.rawData?.find((d) => d.choiceIdx === 3)?.count).toBe(3);
        expect(checkboxData.rawData?.find((d) => d.choiceIdx === 4)?.count).toBe(0);
        // Multiple choice question
        const multipleData = choiceDistributionData[1];
        expect(multipleData.totalResponses).toBe(3);
        expect(multipleData.rawData?.find((d) => d.choiceIdx === 1)?.count).toBe(1);
        expect(multipleData.rawData?.find((d) => d.choiceIdx === 2)?.count).toBe(1);
        expect(multipleData.rawData?.find((d) => d.choiceIdx === 3)?.count).toBe(1);
        // Selection question: all 3 responses chose idx 2
        const selectionData = choiceDistributionData[2];
        expect(selectionData.totalResponses).toBe(3);
        expect(selectionData.rawData?.find((d) => d.choiceIdx === 2)?.count).toBe(3);
        expect(selectionData.rawData?.find((d) => d.choiceIdx === 2)?.percentage).toBe(100);
    });
});
/* ----------------------------- Form Analytics ----------------------------- */
describe("Test Form Analytic", () => {
    const globalFormId = mockdata_1.MockContentFactory.createFormId();
    test("correctly Generate Querstion Analytics", async () => {
        /**
         * Helper to build a responseset item
         */
        const buildResponseSet = (question, response, score) => ({
            question: question._id,
            questionId: question._id,
            response,
            score,
        });
        //Mocks Data
        const mockedQuestions = [
            mockdata_1.MockContentFactory.createRangeDateContent(),
            mockdata_1.MockContentFactory.createRangeNumberContent(),
            mockdata_1.MockContentFactory.createShortAnswerContent(),
            mockdata_1.MockContentFactory.createParagraphContent(),
        ];
        const mockedResponsesWithScore = [
            //High Score
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: [
                    buildResponseSet(mockedQuestions[0], { start: "2024-01-01", end: "2024-06-01" }, 10),
                    buildResponseSet(mockedQuestions[1], { start: 50, end: 100 }, 10),
                    buildResponseSet(mockedQuestions[2], "Answer 3", 10),
                    buildResponseSet(mockedQuestions[3], "Okay im with you", 0),
                ],
                maxScore: 40,
                totalScore: 30,
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
            },
            //Mid Score
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: [
                    buildResponseSet(mockedQuestions[0], { start: "2024-02-01", end: "2024-08-01" }, 10),
                    buildResponseSet(mockedQuestions[1], { start: 30, end: 80 }, 0),
                    buildResponseSet(mockedQuestions[2], "polymorphism", 0),
                    buildResponseSet(mockedQuestions[3], "A game built with Unity", 10),
                ],
                maxScore: 40,
                totalScore: 20,
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
            },
            //Low score
            {
                _id: mockdata_1.MockContentFactory.createFormId(),
                formId: globalFormId,
                userId: mockdata_1.MockContentFactory.createFormId(),
                responseset: [
                    buildResponseSet(mockedQuestions[0], { start: "2024-03-01", end: "2024-07-01" }, 0),
                    buildResponseSet(mockedQuestions[1], { start: 20, end: 60 }, 10),
                    buildResponseSet(mockedQuestions[2], "objects", 0),
                    buildResponseSet(mockedQuestions[3], "A REST API built with Express", 0),
                ],
                maxScore: 40,
                totalScore: 10,
                completionStatus: Response_model_1.ResponseCompletionStatus.completed,
            },
        ];
        Form_model_1.default.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: globalFormId, totalscore: 40 }),
        });
        Response_model_1.default.find.mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockedResponsesWithScore),
        });
        Content_model_1.default.find.mockResolvedValue(mockedQuestions);
        const analytics = await ResponseAnalyticsService_1.ResponseAnalyticsService.getFormAnalytics(globalFormId.toString());
        /* ------------------------------ Basic metric ------------------------------ */
        expect(analytics.totalResponses).toBe(3);
        expect(analytics.completedResponses).toBe(3);
        expect(analytics.averageScore).toBeCloseTo(20); // (30+20+10)/3
        expect(analytics.responseRate).toBe(100);
        /* --------------------------- Question Analytics --------------------------- */
        const { questionAnalytics, scoreDistribution } = analytics;
        expect(questionAnalytics.length).toBe(4);
        const rangeDateQ = questionAnalytics[0];
        expect(rangeDateQ.questionType).toBe("rangedate");
        expect(rangeDateQ.totalResponses).toBe(3);
        expect(rangeDateQ.correctResponses).toBe(2);
        expect(rangeDateQ.accuracy).toBeCloseTo(66.67);
        const rangeNumberQ = questionAnalytics[1];
        expect(rangeNumberQ.questionType).toBe("rangenumber");
        expect(rangeNumberQ.totalResponses).toBe(3);
        expect(rangeNumberQ.correctResponses).toBe(2);
        expect(rangeNumberQ.accuracy).toBeCloseTo(66.67);
        const shortAnswerQ = questionAnalytics[2];
        expect(shortAnswerQ.questionType).toBe("shortanswer");
        expect(shortAnswerQ.totalResponses).toBe(3);
        expect(shortAnswerQ.correctResponses).toBe(1);
        expect(shortAnswerQ.accuracy).toBeCloseTo(33.33);
        const paragraphQ = questionAnalytics[3];
        expect(paragraphQ.questionType).toBe("paragraph");
        expect(paragraphQ.totalResponses).toBe(3);
        expect(paragraphQ.correctResponses).toBe(1);
        expect(paragraphQ.accuracy).toBeCloseTo(33.33);
        /* --------------------------- Score Distribution --------------------------- */
        expect(scoreDistribution[0].percentage).toBe(0);
        expect(scoreDistribution[1].percentage).toBeCloseTo(33.33);
        expect(scoreDistribution[2].percentage).toBeCloseTo(33.33);
        expect(scoreDistribution[3].percentage).toBeCloseTo(33.33);
        expect(scoreDistribution[4].percentage).toBe(0);
    });
});
