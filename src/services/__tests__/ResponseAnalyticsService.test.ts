/* ----------------------- Test For ResponseAnalytics ----------------------- */

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

import Content, { ContentType } from "../../model/Content.model";
import Form from "../../model/Form.model";
import FormResponse, {
  FormResponseType,
  ResponseAnswerType,
  ResponseCompletionStatus,
  ResponseSetType,
} from "../../model/Response.model";
import { MockContentFactory } from "../../utilities/mockdata";
import { ResponseAnalyticsService } from "../ResponseAnalyticsService";

describe("Test Choice Analytics Data", () => {
  const globalFormId = MockContentFactory.createFormId();

  test("correctly Calculate choice Distribution", async () => {
    //Mocks
    const mockedQuestions: Array<ContentType> = [
      MockContentFactory.createCheckboxContent(),
      MockContentFactory.createMultipleChoiceContent(),
      MockContentFactory.createSelectionContent(),
    ];
    const mockedResponsesets: Array<Array<ResponseSetType>> = [
      [
        {
          question: mockedQuestions[0]._id!,
          response: [1, 2, 3],
          score: 10,
        },
        {
          question: mockedQuestions[1]._id!,
          response: 3,
          score: 10,
        },
        {
          question: mockedQuestions[2]._id!,
          response: 2,
          score: 10,
        },
      ],
      [
        {
          question: mockedQuestions[0]._id!,
          response: [1, 2, 3],
          score: 10,
        },
        {
          question: mockedQuestions[1]._id!,
          response: 2,
          score: 0,
        },
        {
          question: mockedQuestions[2]._id!,
          response: 2,
          score: 10,
        },
      ],
      [
        {
          question: mockedQuestions[0]._id!,
          response: [1, 0, 3],
          score: 0,
        },
        {
          question: mockedQuestions[1]._id!,
          response: 1,
          score: 0,
        },
        {
          question: mockedQuestions[2]._id!,
          response: 2,
          score: 10,
        },
      ],
    ];

    const mockedResponse: Array<FormResponseType> = [
      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: mockedResponsesets[0],
        maxScore: 30,
        completionStatus: ResponseCompletionStatus.autoscore,
      },
      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: mockedResponsesets[1],
        maxScore: 30,
        completionStatus: ResponseCompletionStatus.autoscore,
      },
      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: mockedResponsesets[2],
        maxScore: 30,
        completionStatus: ResponseCompletionStatus.autoscore,
      },
    ];

    (Form.findById as jest.Mock).mockResolvedValue({
      _id: globalFormId,
    });
    (FormResponse.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockedResponse),
    });

    (Content.find as jest.Mock).mockResolvedValue(mockedQuestions);

    const choiceDistributionData =
      await ResponseAnalyticsService.getChoiceQuestionAnalytics(
        globalFormId.toString(),
      );

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
    expect(selectionData.rawData?.find((d) => d.choiceIdx === 2)?.count).toBe(
      3,
    );
    expect(
      selectionData.rawData?.find((d) => d.choiceIdx === 2)?.percentage,
    ).toBe(100);
  });
});

/* ----------------------------- Form Analytics ----------------------------- */

describe("Test Form Analytic", () => {
  const globalFormId = MockContentFactory.createFormId();

  test("correctly Generate Querstion Analytics", async () => {
    /**
     * Helper to build a responseset item
     */
    const buildResponseSet = (
      question: ContentType,
      response: ResponseAnswerType,
      score: number,
    ) =>
      ({
        question: question._id!,
        questionId: question._id!,
        response,
        score,
      }) as unknown as ResponseSetType;

    //Mocks Data

    const mockedQuestions: Array<ContentType> = [
      MockContentFactory.createRangeDateContent(),
      MockContentFactory.createRangeNumberContent(),
      MockContentFactory.createShortAnswerContent(),
      MockContentFactory.createParagraphContent(),
    ];

    const mockedResponsesWithScore: Array<FormResponseType> = [
      //High Score
      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: [
          buildResponseSet(
            mockedQuestions[0],
            { start: "2024-01-01", end: "2024-06-01" },
            10,
          ),
          buildResponseSet(mockedQuestions[1], { start: 50, end: 100 }, 10),
          buildResponseSet(mockedQuestions[2], "Answer 3", 10),
          buildResponseSet(mockedQuestions[3], "Okay im with you", 0),
        ],
        maxScore: 40,
        totalScore: 30,
        completionStatus: ResponseCompletionStatus.completed,
      },

      //Mid Score
      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: [
          buildResponseSet(
            mockedQuestions[0],
            { start: "2024-02-01", end: "2024-08-01" },
            10,
          ),
          buildResponseSet(mockedQuestions[1], { start: 30, end: 80 }, 0),
          buildResponseSet(mockedQuestions[2], "polymorphism", 0),
          buildResponseSet(mockedQuestions[3], "A game built with Unity", 10),
        ],
        maxScore: 40,
        totalScore: 20,
        completionStatus: ResponseCompletionStatus.completed,
      },

      //Low score

      {
        _id: MockContentFactory.createFormId(),
        formId: globalFormId,
        userId: MockContentFactory.createFormId(),
        responseset: [
          buildResponseSet(
            mockedQuestions[0],
            { start: "2024-03-01", end: "2024-07-01" },
            0,
          ),
          buildResponseSet(mockedQuestions[1], { start: 20, end: 60 }, 10),
          buildResponseSet(mockedQuestions[2], "objects", 0),
          buildResponseSet(
            mockedQuestions[3],
            "A REST API built with Express",
            0,
          ),
        ],
        maxScore: 40,
        totalScore: 10,
        completionStatus: ResponseCompletionStatus.completed,
      },
    ];

    (Form.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: globalFormId, totalscore: 40 }),
    });
    (FormResponse.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockedResponsesWithScore),
    });
    (Content.find as jest.Mock).mockResolvedValue(mockedQuestions);

    const analytics = await ResponseAnalyticsService.getFormAnalytics(
      globalFormId.toString(),
    );

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
