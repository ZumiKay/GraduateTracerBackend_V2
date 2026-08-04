"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSurveyContents = createSurveyContents;
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../../model/Content.model"));
async function createSurveyContents(formId) {
    const satisfactionQId = new mongoose_1.Types.ObjectId();
    const issueQId = new mongoose_1.Types.ObjectId();
    const callbackQId = new mongoose_1.Types.ObjectId();
    const featuresQId = new mongoose_1.Types.ObjectId();
    const dashboardFrequencyQId = new mongoose_1.Types.ObjectId();
    const feedbackQId = new mongoose_1.Types.ObjectId();
    const contents = await Content_model_1.default.insertMany([
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
            type: Content_model_1.QuestionType.MultipleChoice,
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
            type: Content_model_1.QuestionType.ShortAnswer,
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
            type: Content_model_1.QuestionType.MultipleChoice,
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
            type: Content_model_1.QuestionType.CheckBox,
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
            type: Content_model_1.QuestionType.Selection,
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
            type: Content_model_1.QuestionType.Paragraph,
            require: false,
            page: 2,
            score: 0,
            hasAnswer: false,
        },
    ]);
    return {
        contents: contents,
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
