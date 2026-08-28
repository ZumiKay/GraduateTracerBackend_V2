import { Types } from "mongoose";
import Content, { ContentType, QuestionType } from "../../model/Content.model";

export interface SurveyContentIds {
  satisfactionQ: Types.ObjectId;
  issueQ: Types.ObjectId;
  callbackQ: Types.ObjectId;
  featuresQ: Types.ObjectId;
  dashboardFrequencyQ: Types.ObjectId;
  feedbackQ: Types.ObjectId;
}

export interface CreateSurveyContentsResult {
  contents: ContentType[];
  ids: SurveyContentIds;
}

export async function createSurveyContents(
  formId: Types.ObjectId,
): Promise<CreateSurveyContentsResult> {
  const satisfactionQId = new Types.ObjectId();
  const issueQId = new Types.ObjectId();
  const callbackQId = new Types.ObjectId();
  const featuresQId = new Types.ObjectId();
  const dashboardFrequencyQId = new Types.ObjectId();
  const feedbackQId = new Types.ObjectId();

  const contents = await Content.insertMany([
    //Q1 with two conditions
    {
      _id: satisfactionQId,
      formId,
      qIdx: 0,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "How satisfied are you with our service?" },
            ],
          },
        ],
      },
      type: QuestionType.MultipleChoice,
      multiple: [
        { idx: 0, content: "Very Satisfied" },
        { idx: 1, content: "Satisfied" },
        { idx: 2, content: "Neutral" },
        { idx: 3, content: "Dissatisfied" },
        { idx: 4, content: "Very Dissatisfied" },
      ],
      conditional: [
        { key: 3, contentId: issueQId },
        { key: 4, contentId: callbackQId },
      ],
      require: true,
      page: 1,
      score: 0,
      hasAnswer: false,
    },

    //Question (1.1 child of question 1)
    {
      _id: issueQId,
      formId,
      qIdx: 1,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "What was your main issue with our service?",
              },
            ],
          },
        ],
      },
      type: QuestionType.ShortAnswer,
      parentcontent: {
        qId: satisfactionQId.toString(),
        qIdx: 0,
        optIdx: 3,
      },
      require: true,
      page: 1,
      score: 0,
      hasAnswer: false,
    },

    //Question (1.2 child of question 1)
    {
      _id: callbackQId,
      formId,
      qIdx: 2,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Would you like us to contact you to resolve your concerns?",
              },
            ],
          },
        ],
      },
      type: QuestionType.MultipleChoice,
      multiple: [
        { idx: 0, content: "Yes, please contact me" },
        { idx: 1, content: "No, thank you" },
      ],
      parentcontent: {
        qId: satisfactionQId.toString(),
        qIdx: 0,
        optIdx: 4,
      },
      require: false,
      page: 1,
      score: 0,
      hasAnswer: false,
    },

    //Question 2 with one condition
    {
      _id: featuresQId,
      formId,
      qIdx: 3,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "What features do you use most?" }],
          },
        ],
      },
      type: QuestionType.CheckBox,
      checkbox: [
        { idx: 0, content: "Dashboard" },
        { idx: 1, content: "Reports" },
        { idx: 2, content: "Analytics" },
        { idx: 3, content: "Integration" },
        { idx: 4, content: "Support" },
      ],
      conditional: [{ key: 0, contentId: dashboardFrequencyQId }],
      require: false,
      page: 1,
      score: 0,
      hasAnswer: false,
    },

    //Question 2.1 child of question 2
    {
      _id: dashboardFrequencyQId,
      formId,
      qIdx: 4,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "How often do you use the Dashboard?" },
            ],
          },
        ],
      },
      type: QuestionType.Selection,
      selection: [
        { idx: 0, content: "Daily" },
        { idx: 1, content: "Weekly" },
        { idx: 2, content: "Monthly" },
        { idx: 3, content: "Rarely" },
      ],
      parentcontent: {
        qId: featuresQId.toString(),
        qIdx: 3,
        optIdx: 0,
      },
      require: false,
      page: 1,
      score: 0,
      hasAnswer: false,
    },

    //Question 3 with no condition
    {
      _id: feedbackQId,
      formId,
      qIdx: 5,
      title: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Please provide any additional feedback:",
              },
            ],
          },
        ],
      },
      type: QuestionType.Paragraph,
      require: false,
      page: 2,
      score: 0,
      hasAnswer: false,
    },
  ]);

  return {
    contents: contents as unknown as ContentType[],
    ids: {
      satisfactionQ: satisfactionQId,
      issueQ: issueQId,
      callbackQ: callbackQId,
      featuresQ: featuresQId,
      dashboardFrequencyQ: dashboardFrequencyQId,
      feedbackQ: feedbackQId,
    },
  };
}
