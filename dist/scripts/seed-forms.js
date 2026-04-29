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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedFormData = seedFormData;
const mongoose_1 = __importDefault(require("mongoose"));
const User_model_1 = __importStar(require("../model/User.model"));
const Form_model_1 = __importStar(require("../model/Form.model"));
const Content_model_1 = __importStar(require("../model/Content.model"));
const Response_model_1 = __importStar(require("../model/Response.model"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)({});
function seedFormData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Starting form seeding process...");
            // Clear existing data (optional - remove if you want to preserve existing data)
            yield Promise.all([
                Response_model_1.default.deleteMany({}),
                Content_model_1.default.deleteMany({}),
                Form_model_1.default.deleteMany({}),
                User_model_1.default.deleteMany({}),
            ]);
            console.log("✓ Cleared existing data");
            // 1. Create Users
            const hashedPassword = yield bcrypt_1.default.hash("Password@123", 10);
            const users = yield User_model_1.default.insertMany([
                {
                    email: "owner@example.com",
                    name: "Form Owner",
                    password: hashedPassword,
                    role: User_model_1.ROLE.USER,
                },
                {
                    email: "editor@example.com",
                    name: "Form Editor",
                    password: hashedPassword,
                    role: User_model_1.ROLE.USER,
                },
                {
                    email: "collaborator@example.com",
                    name: "Form Collaborator",
                    password: hashedPassword,
                    role: User_model_1.ROLE.USER,
                },
                {
                    email: "respondent1@example.com",
                    name: "John Doe",
                    password: hashedPassword,
                    role: User_model_1.ROLE.USER,
                },
                {
                    email: "respondent2@example.com",
                    name: "Jane Smith",
                    password: hashedPassword,
                    role: User_model_1.ROLE.USER,
                },
                {
                    email: "admin@example.com",
                    name: "Admin User",
                    password: hashedPassword,
                    role: User_model_1.ROLE.ADMIN,
                },
            ]);
            console.log(`✓ Created ${users.length} users`);
            const [owner, editor, collaborator, respondent1, respondent2, admin] = users;
            // 2. Create Forms
            const forms = yield Form_model_1.default.insertMany([
                {
                    title: "Customer Satisfaction Survey",
                    type: Form_model_1.TypeForm.Normal,
                    user: owner._id,
                    owners: [editor._id],
                    editors: [collaborator._id],
                    submittype: Form_model_1.SubmitType.Multiple,
                    setting: {
                        qcolor: "#4F46E5",
                        bg: "#FFFFFF",
                        navbar: "#1E40AF",
                        text: "#1F2937",
                        submitonce: false,
                        email: true,
                        autosave: true,
                        returnscore: Form_model_1.returnscore.partial,
                        acceptResponses: true,
                        acceptGuest: true,
                    },
                    totalpage: 2,
                    totalscore: 0,
                    pendingCollarborators: [
                        {
                            code: "INVITE123",
                            expireIn: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                            user: admin._id,
                        },
                    ],
                },
                {
                    title: "JavaScript Quiz 2024",
                    type: Form_model_1.TypeForm.Quiz,
                    user: owner._id,
                    owners: [],
                    editors: [editor._id],
                    submittype: Form_model_1.SubmitType.Once,
                    setting: {
                        qcolor: "#059669",
                        bg: "#F0FDF4",
                        navbar: "#065F46",
                        text: "#064E3B",
                        submitonce: true,
                        email: true,
                        autosave: false,
                        returnscore: Form_model_1.returnscore.manual,
                        acceptResponses: true,
                        acceptGuest: false,
                    },
                    totalpage: 3,
                    totalscore: 0,
                },
                {
                    title: "Employee Feedback Form",
                    type: Form_model_1.TypeForm.Normal,
                    user: editor._id,
                    owners: [owner._id],
                    editors: [],
                    submittype: Form_model_1.SubmitType.Multiple,
                    setting: {
                        qcolor: "#DC2626",
                        bg: "#FEF2F2",
                        navbar: "#991B1B",
                        text: "#7F1D1D",
                        submitonce: false,
                        email: false,
                        autosave: true,
                        acceptResponses: true,
                        acceptGuest: false,
                    },
                    totalpage: 1,
                    totalscore: 0,
                    pendingOwnershipTransfer: {
                        code: "TRANSFER456",
                        expireIn: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
                        fromUser: editor._id,
                        toUser: owner._id,
                    },
                },
            ]);
            console.log(`✓ Created ${forms.length} forms`);
            const [surveyForm, quizForm, feedbackForm] = forms;
            // 3. Create Contents (Questions) for each form
            const contents = [];
            // Customer Satisfaction Survey Questions
            const surveyContents = yield Content_model_1.default.insertMany([
                {
                    formId: surveyForm._id,
                    qIdx: 0,
                    questionId: "Q1",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: "How satisfied are you with our service?",
                                    },
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
                    require: true,
                    page: 1,
                    score: 0,
                    hasAnswer: false,
                },
                {
                    formId: surveyForm._id,
                    qIdx: 1,
                    questionId: "Q2",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    { type: "text", text: "What features do you use most?" },
                                ],
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
                    require: false,
                    page: 1,
                    score: 0,
                    hasAnswer: false,
                },
                {
                    formId: surveyForm._id,
                    qIdx: 2,
                    questionId: "Q3",
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
            contents.push(...surveyContents);
            // JavaScript Quiz Questions
            const quizContents = yield Content_model_1.default.insertMany([
                {
                    formId: quizForm._id,
                    qIdx: 0,
                    questionId: "Q1",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: "What does 'const' keyword do in JavaScript?",
                                    },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.MultipleChoice,
                    multiple: [
                        { idx: 0, content: "Declares a block-scoped constant" },
                        { idx: 1, content: "Declares a function" },
                        { idx: 2, content: "Declares a variable that can be reassigned" },
                        { idx: 3, content: "Declares a global variable" },
                    ],
                    require: true,
                    page: 1,
                    score: 10,
                    hasAnswer: true,
                    answer: {
                        answer: 0,
                        isCorrect: true,
                    },
                },
                {
                    formId: quizForm._id,
                    qIdx: 1,
                    questionId: "Q2",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: "Which of the following are JavaScript data types?",
                                    },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.CheckBox,
                    checkbox: [
                        { idx: 0, content: "String" },
                        { idx: 1, content: "Number" },
                        { idx: 2, content: "Boolean" },
                        { idx: 3, content: "Character" },
                        { idx: 4, content: "Symbol" },
                    ],
                    require: true,
                    page: 1,
                    score: 15,
                    hasAnswer: true,
                    answer: {
                        answer: [0, 1, 2, 4],
                        isCorrect: true,
                    },
                },
                {
                    formId: quizForm._id,
                    qIdx: 2,
                    questionId: "Q3",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: "Explain the concept of closure in JavaScript:",
                                    },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.Paragraph,
                    require: true,
                    page: 2,
                    score: 25,
                    hasAnswer: true,
                    answer: {
                        answer: "A closure is a function that has access to variables in its outer scope, even after the outer function has returned.",
                        isCorrect: true,
                    },
                },
                {
                    formId: quizForm._id,
                    qIdx: 3,
                    questionId: "Q4",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    { type: "text", text: "What is the output of: typeof null?" },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.ShortAnswer,
                    require: true,
                    page: 3,
                    score: 10,
                    hasAnswer: true,
                    answer: {
                        answer: "object",
                        isCorrect: true,
                    },
                },
                {
                    formId: quizForm._id,
                    qIdx: 4,
                    questionId: "Q5",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    { type: "text", text: "Select your experience level:" },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.Selection,
                    selection: [
                        { idx: 0, content: "Beginner" },
                        { idx: 1, content: "Intermediate" },
                        { idx: 2, content: "Advanced" },
                        { idx: 3, content: "Expert" },
                    ],
                    require: true,
                    page: 3,
                    score: 0,
                    hasAnswer: false,
                },
            ]);
            contents.push(...quizContents);
            // Employee Feedback Questions
            const feedbackContents = yield Content_model_1.default.insertMany([
                {
                    formId: feedbackForm._id,
                    qIdx: 0,
                    questionId: "Q1",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [{ type: "text", text: "Rate your work-life balance:" }],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.RangeNumber,
                    rangenumber: {
                        start: 1,
                        end: 10,
                    },
                    require: true,
                    page: 1,
                    score: 0,
                    hasAnswer: false,
                },
                {
                    formId: feedbackForm._id,
                    qIdx: 1,
                    questionId: "Q2",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    { type: "text", text: "When did you join the company?" },
                                ],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.Date,
                    require: true,
                    page: 1,
                    score: 0,
                    hasAnswer: false,
                },
                {
                    formId: feedbackForm._id,
                    qIdx: 2,
                    questionId: "Q3",
                    title: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [{ type: "text", text: "Additional comments:" }],
                            },
                        ],
                    },
                    type: Content_model_1.QuestionType.Paragraph,
                    require: false,
                    page: 1,
                    score: 0,
                    hasAnswer: false,
                },
            ]);
            contents.push(...feedbackContents);
            console.log(`✓ Created ${contents.length} content items (questions)`);
            // Update form contentIds
            yield Form_model_1.default.findByIdAndUpdate(surveyForm._id, {
                contentIds: surveyContents.map((c) => c._id),
            });
            yield Form_model_1.default.findByIdAndUpdate(quizForm._id, {
                contentIds: quizContents.map((c) => c._id),
            });
            yield Form_model_1.default.findByIdAndUpdate(feedbackForm._id, {
                contentIds: feedbackContents.map((c) => c._id),
            });
            // 4. Create Form Responses
            const responses = [];
            // Survey Responses
            const surveyResponses = yield Response_model_1.default.insertMany([
                {
                    formId: surveyForm._id,
                    userId: respondent1._id,
                    responseset: [
                        {
                            question: surveyContents[0]._id,
                            response: 1, // Satisfied
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: surveyContents[1]._id,
                            response: [0, 1, 2], // Dashboard, Reports, Analytics
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: surveyContents[2]._id,
                            response: "Great service! Very happy with the features.",
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 0,
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                    respondentEmail: respondent1.email,
                    respondentName: respondent1.name,
                    respondentType: Response_model_1.RespondentType.user,
                    submittedAt: new Date(),
                },
                {
                    formId: surveyForm._id,
                    userId: respondent2._id,
                    responseset: [
                        {
                            question: surveyContents[0]._id,
                            response: 0, // Very Satisfied
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: surveyContents[1]._id,
                            response: [1, 3], // Reports, Integration
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 0,
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.partial,
                    respondentEmail: respondent2.email,
                    respondentName: respondent2.name,
                    respondentType: Response_model_1.RespondentType.user,
                },
                {
                    formId: surveyForm._id,
                    responseset: [
                        {
                            question: surveyContents[0]._id,
                            response: 2, // Neutral
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: surveyContents[1]._id,
                            response: [0, 4], // Dashboard, Support
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: surveyContents[2]._id,
                            response: "Good overall, but could improve response time.",
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 0,
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                    respondentEmail: "guest@example.com",
                    respondentName: "Anonymous Guest",
                    respondentType: Response_model_1.RespondentType.guest,
                    respondentFingerprint: "fp_abc123xyz",
                    respondentIP: "192.168.1.100",
                    submittedAt: new Date(),
                },
            ]);
            responses.push(...surveyResponses);
            // Quiz Responses
            const quizResponses = yield Response_model_1.default.insertMany([
                {
                    formId: quizForm._id,
                    userId: respondent1._id,
                    responseset: [
                        {
                            question: quizContents[0]._id,
                            response: 0, // Correct answer
                            score: 10,
                            scoringMethod: Response_model_1.ScoringMethod.AUTO,
                        },
                        {
                            question: quizContents[1]._id,
                            response: [0, 1, 2, 4], // Correct answer
                            score: 15,
                            scoringMethod: Response_model_1.ScoringMethod.AUTO,
                        },
                        {
                            question: quizContents[2]._id,
                            response: "A closure is when a function remembers variables from its outer scope.",
                            score: 20,
                            comment: "Good understanding, but could be more detailed.",
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                        {
                            question: quizContents[3]._id,
                            response: "object",
                            score: 10,
                            scoringMethod: Response_model_1.ScoringMethod.AUTO,
                        },
                        {
                            question: quizContents[4]._id,
                            response: 2, // Advanced
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 60,
                    totalScore: 55,
                    completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                    respondentEmail: respondent1.email,
                    respondentName: respondent1.name,
                    respondentType: Response_model_1.RespondentType.user,
                    submittedAt: new Date(),
                },
                {
                    formId: quizForm._id,
                    userId: respondent2._id,
                    responseset: [
                        {
                            question: quizContents[0]._id,
                            response: 2, // Wrong answer
                            score: 0,
                            scoringMethod: Response_model_1.ScoringMethod.AUTO,
                        },
                        {
                            question: quizContents[1]._id,
                            response: [0, 1, 3], // Partially correct
                            score: 7,
                            comment: "Partial credit: 'Character' is not a JavaScript data type",
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                        {
                            question: quizContents[2]._id,
                            response: "Closures are about functions inside functions.",
                            score: 15,
                            comment: "Basic understanding shown, needs more detail.",
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                        {
                            question: quizContents[3]._id,
                            response: "null",
                            score: 0,
                            scoringMethod: Response_model_1.ScoringMethod.AUTO,
                        },
                        {
                            question: quizContents[4]._id,
                            response: 1, // Intermediate
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 60,
                    totalScore: 22,
                    completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                    respondentEmail: respondent2.email,
                    respondentName: respondent2.name,
                    respondentType: Response_model_1.RespondentType.user,
                    submittedAt: new Date(),
                },
            ]);
            responses.push(...quizResponses);
            // Feedback Responses
            const feedbackResponses = yield Response_model_1.default.insertMany([
                {
                    formId: feedbackForm._id,
                    userId: respondent1._id,
                    responseset: [
                        {
                            question: feedbackContents[0]._id,
                            response: { start: 7, end: 7 },
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: feedbackContents[1]._id,
                            response: "2022-05-15",
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: feedbackContents[2]._id,
                            response: "Great team environment and good benefits.",
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 0,
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.completed,
                    respondentEmail: respondent1.email,
                    respondentName: respondent1.name,
                    respondentType: Response_model_1.RespondentType.user,
                    submittedAt: new Date(),
                },
                {
                    formId: feedbackForm._id,
                    userId: collaborator._id,
                    responseset: [
                        {
                            question: feedbackContents[0]._id,
                            response: { start: 9, end: 9 },
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                        {
                            question: feedbackContents[1]._id,
                            response: "2021-03-10",
                            scoringMethod: Response_model_1.ScoringMethod.NONE,
                        },
                    ],
                    maxScore: 0,
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.partial,
                    respondentEmail: collaborator.email,
                    respondentName: collaborator.name,
                    respondentType: Response_model_1.RespondentType.user,
                },
            ]);
            responses.push(...feedbackResponses);
            console.log(`✓ Created ${responses.length} form responses`);
            console.log("\n=== Seeding Summary ===");
            console.log(`Users created: ${users.length}`);
            console.log(`Forms created: ${forms.length}`);
            console.log(`Contents (questions) created: ${contents.length}`);
            console.log(`Responses created: ${responses.length}`);
            console.log("\nSeeding completed successfully! ✅");
            return {
                users,
                forms: forms,
                contents,
                responses,
            };
        }
        catch (error) {
            console.error("Error during seeding:", error);
            throw error;
        }
    });
}
// Execute seeding if run directly
if (require.main === module) {
    const mongoUri = "mongodb+srv://Graduate:8WP26uoL6qaEgpGo@graduatetracer.pzdpgky.mongodb.net/?retryWrites=true&w=majority&appName=GraduateTracer";
    mongoose_1.default
        .connect(mongoUri)
        .then(() => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Connected to MongoDB");
        yield seedFormData();
        yield mongoose_1.default.disconnect();
        console.log("Disconnected from MongoDB");
        process.exit(0);
    }))
        .catch((error) => {
        console.error("Database connection error:", error);
        process.exit(1);
    });
}
