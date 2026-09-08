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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//FormResponseController Integration Testing
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importStar(require("mongoose"));
const app_1 = __importDefault(require("../../../app"));
const helper_1 = require("../../../utilities/helper");
const customType_1 = require("../../../types/customType");
const User_middleware_1 = require("../../../middleware/User.middleware");
const helper_integration_1 = require("./helper.integration");
const Form_model_1 = __importStar(require("../../../model/Form.model"));
const User_model_1 = __importStar(require("../../../model/User.model"));
const Formsession_model_1 = __importDefault(require("../../../model/Formsession.model"));
const Response_model_1 = __importStar(require("../../../model/Response.model"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const Notification_model_1 = __importDefault(require("../../../model/Notification.model"));
const EmailService_1 = __importDefault(require("../../../services/EmailService"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mockdata_1 = require("../../../utilities/mockdata");
describe("FormResponse Controller Integration Test", () => {
    const baseURL = "/v0/api/response";
    let sampleFormData = undefined;
    let sampleUser = undefined;
    beforeAll(async () => {
        //Mocked DB
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
        jest.spyOn(EmailService_1.default.prototype, "sendEmail").mockResolvedValue(true);
        jest
            .spyOn(EmailService_1.default.prototype, "sendResponseResults")
            .mockResolvedValue(true);
    });
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = helper_integration_1.testEnv;
    });
    afterAll(async () => {
        await User_model_1.default.deleteMany({});
        await Form_model_1.default.deleteMany({});
        await Usersession_model_1.default.deleteMany({});
        await Content_model_1.default.deleteMany({});
        await Response_model_1.default.deleteMany({});
        await Formsession_model_1.default.deleteMany({});
        await Notification_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    describe("GetPublicFormData", () => {
        let localFormId;
        let localInitialURL;
        beforeEach(() => {
            jest.clearAllMocks();
            localFormId = new mongoose_1.Types.ObjectId();
            localInitialURL = `${baseURL}/form/${localFormId}`;
        });
        test("400 if missing ty", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default).get(localInitialURL);
            expect(superTest.status).toBe(400);
            expect(superTest.body).toStrictEqual(customType_1.RESPONSES.invalidRequestType());
        });
        test("500 if missing env", async () => {
            process.env = {
                ...helper_integration_1.testEnv,
                REFRESH_TOKEN_COOKIE: undefined,
            };
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(localInitialURL)
                .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.initial });
            expect(superTest.status).toBe(500);
            expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(500));
        });
        describe(`ty = ${User_middleware_1.GetPublicFormDataTyEnum.initial}`, () => {
            let FormOwner;
            beforeAll(async () => {
                //create user
                FormOwner = await (0, helper_integration_1.createTestUser)();
            });
            afterAll(async () => {
                sampleFormData = undefined;
            });
            test("status 404 if the form is closed", async () => {
                sampleFormData = await (0, helper_integration_1.createTestForm)(FormOwner._id, {
                    setting: {
                        acceptResponses: false,
                        email: true,
                    },
                });
                localInitialURL = `${baseURL}/form/${sampleFormData.id}`;
                const superTest = await (0, supertest_1.default)(app_1.default).get(localInitialURL).query({
                    ty: User_middleware_1.GetPublicFormDataTyEnum.initial,
                });
                expect(superTest.status).toBe(404);
                expect(superTest.body).toStrictEqual((0, helper_1.ReturnCode)(404, "Form is closed"));
            });
            describe("Require email form", () => {
                let testRespondent;
                let loggedIn;
                beforeEach(async () => {
                    //Create form and question
                    sampleFormData = await (0, helper_integration_1.createTestForm)(FormOwner._id);
                    sampleFormData.id &&
                        (await (0, helper_integration_1.createQuestionsWithFormId)({
                            formId: new mongoose_1.Types.ObjectId(sampleFormData.id),
                        }));
                    localInitialURL = `${baseURL}/form/${sampleFormData.id}`;
                    sampleUser = {
                        email: "TestRespondent@gmail.com",
                        name: "TestRespondent",
                        password: "pass@12345",
                        role: User_model_1.ROLE.USER,
                    };
                    testRespondent = await (0, helper_integration_1.createTestUser)(sampleUser);
                    loggedIn = await (0, helper_integration_1.loggedUserInForm)({
                        email: testRespondent.email,
                        password: sampleUser?.password,
                        formId: sampleFormData?.id,
                    });
                });
                afterAll(async () => {
                    await Formsession_model_1.default.deleteMany({});
                    await Response_model_1.default.deleteMany({});
                });
                test("status 200 isResponse shoud be true if user response exist in submitonce form", async () => {
                    //create response
                    await (0, helper_integration_1.createResponse)({
                        formId: sampleFormData?.id,
                        userId: testRespondent?._id.toString(),
                    });
                    const superTest = await (0, supertest_1.default)(app_1.default)
                        .get(localInitialURL)
                        .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.initial })
                        .withCredentials()
                        .set("Cookie", [
                        `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
                        `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
                    ]);
                    expect(superTest.status).toBe(200);
                    expect(superTest.body.code).toBe(200);
                    expect(superTest.body.message).toBe("Success");
                    expect(superTest.body.data._id).toBe(sampleFormData?.id);
                    expect(superTest.body.data.title).toBe(sampleFormData?.title);
                    expect(superTest.body.data.type).toBe(sampleFormData?.type);
                    expect(superTest.body.data.totalpage).toBe(sampleFormData?.totalpage);
                    expect(superTest.body.data.isAuthenticated).toBe(true);
                    expect(superTest.body.data.isResponsed).toMatchObject({
                        message: "You already submitted response",
                    });
                });
                test("status 400 If form contents have some invalid", async () => {
                    //Prerequisite
                    await (0, helper_integration_1.createQuestionsWithFormId)({
                        formId: new mongoose_1.Types.ObjectId(sampleFormData?.id),
                        replaceQuestion: [
                            mockdata_1.MockContentFactory.createCheckboxContent({ checkbox: [] }),
                            mockdata_1.MockContentFactory.createRangeDateContent({
                                rangedate: {
                                    start: new Date("2026-08-01"),
                                    end: new Date("2026-07-01"),
                                },
                            }),
                        ],
                    });
                    //Invalid form contents matcher
                    const superTest = await (0, supertest_1.default)(app_1.default)
                        .get(localInitialURL)
                        .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.initial })
                        .withCredentials()
                        .set("Cookie", [
                        `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
                        `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
                    ]);
                    expect(superTest.status).toBe(400);
                    expect(superTest.body.code).toBe(400);
                    expect(superTest.body.data.data.contentValidation).toBeDefined();
                    expect(superTest.body.data.data.contentValidation.some((item) => !item.isValid)).toBe(true);
                    expect(superTest.body.data.data.contentValidation[0].errors.length).toBeGreaterThan(0);
                });
                test("status 200 return formdata with isAuthenticate to true", async () => {
                    const superTest = await (0, supertest_1.default)(app_1.default)
                        .get(localInitialURL)
                        .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.initial })
                        .withCredentials()
                        .set("Cookie", [
                        `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
                        `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
                    ]);
                    expect(superTest.status).toBe(200);
                    expect(superTest.body?.data).toBeDefined();
                    expect(superTest.body.data.isAuthenticated).toBe(true);
                });
            });
        });
        describe(`ty = ${User_middleware_1.GetPublicFormDataTyEnum.data}`, () => {
            let FormOwner;
            beforeAll(async () => {
                FormOwner = await (0, helper_integration_1.createTestUser)();
            });
            afterEach(async () => {
                await Formsession_model_1.default.deleteMany({});
            });
            test("status 401 if missing session cookies", async () => {
                const form = await (0, helper_integration_1.createTestForm)(FormOwner._id);
                const superTest = await (0, supertest_1.default)(app_1.default)
                    .get(`${baseURL}/form/${form.id}`)
                    .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.data });
                expect(superTest.status).toBe(401);
                expect(superTest.body).toStrictEqual(customType_1.RESPONSES.missingSessionToken());
            });
            test("status 200 returns form data with questions when respondent session is valid", async () => {
                const form = await (0, helper_integration_1.createTestForm)(FormOwner._id);
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: new mongoose_1.Types.ObjectId(form.id),
                });
                const respondent = await (0, helper_integration_1.createTestUser)({
                    email: "DataRespondent@gmail.com",
                    name: "DataRespondent",
                    password: "pass@12345",
                    role: User_model_1.ROLE.USER,
                });
                const loggedIn = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondent.email,
                    password: "pass@12345",
                    formId: form.id,
                });
                const superTest = await (0, supertest_1.default)(app_1.default)
                    .get(`${baseURL}/form/${form.id}`)
                    .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.data, p: 1 })
                    .withCredentials()
                    .set("Cookie", [
                    `${process.env.ACCESS_RESPONDENT_COOKIE}=${loggedIn?.accessToken}`,
                    `${process.env.RESPONDENT_COOKIE}=${loggedIn?.refreshToken}`,
                ]);
                expect(superTest.status).toBe(200);
                expect(superTest.body.code).toBe(200);
                expect(superTest.body.data.contents).toBeDefined();
                expect(Array.isArray(superTest.body.data.contents)).toBe(true);
                expect(superTest.body.data.contents.length).toBeGreaterThan(0);
                expect(superTest.body.data.isAuthenticated).toBe(true);
                expect(superTest.body.data.isLoggedIn).toBe(true);
            });
        });
        describe(`ty = ${User_middleware_1.GetPublicFormDataTyEnum.preview}`, () => {
            let FormOwner;
            beforeAll(async () => {
                FormOwner = await (0, helper_integration_1.createTestUser)();
            });
            afterEach(async () => {
                await Usersession_model_1.default.deleteMany({});
            });
            test("status 200 returns form preview with questions when accessed by form owner", async () => {
                const form = await (0, helper_integration_1.createTestForm)(FormOwner._id);
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: new mongoose_1.Types.ObjectId(form.id),
                });
                const accessToken = jsonwebtoken_1.default.sign({ sub: FormOwner._id.toString(), role: FormOwner.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
                const superTest = await (0, supertest_1.default)(app_1.default)
                    .get(`${baseURL}/form/${form.id}`)
                    .query({ ty: User_middleware_1.GetPublicFormDataTyEnum.preview, p: 1 })
                    .withCredentials()
                    .set("Cookie", [
                    `${process.env.ACCESS_TOKEN_COOKIE || "graduate_accessT"}=${accessToken}`,
                ]);
                expect(superTest.status).toBe(200);
                expect(superTest.body.code).toBe(200);
                expect(superTest.body.data._id).toBe(form.id);
                expect(superTest.body.data.contents).toBeDefined();
                expect(Array.isArray(superTest.body.data.contents)).toBe(true);
                expect(superTest.body.data.contents.length).toBeGreaterThan(0);
                expect(superTest.body.data.isAuthenticated).toBe(true);
            });
        });
    });
    /**
     * Test case analysis for SubmitFormResponseMethod
     * @private vlidateSubmissionInput
     *  [] Response must be an array
     *  [] all question must have _id
     *
     * @static createSubmissionWithTracking
     *  [] gather all require tracking data
     *
     * Form type processing service
     *  [] processFormSubmission (quiz form process)
     *    [] addscore method
     *      [] all normal question type score
     *      [] normal condition question score
     *      [] condition with useChildSum = true
     *      [] condtion with isBonusScore = true
     *    [] send notirfacation to notify new response
     *
     *
     */
    describe("Submit Form Response Method", () => {
        let formOwner;
        let respondentUser;
        let testQuizForm;
        beforeEach(async () => {
            formOwner = await (0, helper_integration_1.createTestUser)({
                name: "Quiz Owner",
                email: `owner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
            });
            respondentUser = await (0, helper_integration_1.createTestUser)({
                name: "Quiz Respondent",
                email: `respondent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@gmail.com`,
                password: "pass@12345",
            });
            testQuizForm = await (0, helper_integration_1.createTestForm)(formOwner._id, {
                type: Form_model_1.TypeForm.Quiz,
                totalscore: 50,
                setting: {
                    acceptResponses: true,
                    acceptGuest: true,
                    email: true,
                    submitonce: false,
                    returnscore: Form_model_1.returnscore.partial,
                },
            });
        });
        describe("validateSubmissionInput", () => {
            test("status 400 if responseSet is not an array", async () => {
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const invalidResponseset = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: mockdata_1.MockContentFactory.generateResponseSet(),
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(invalidResponseset);
                expect(res.status).toBe(400);
                expect(res.body.code).toBe(400);
                expect(res.body.validationErrors).toContain("Response set must be an array");
            });
            test("status 400 if response item is missing question ID or response", async () => {
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const invalidResponseset = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: [
                        { question: "", response: 0 },
                        { question: new mongoose_1.Types.ObjectId().toString(), response: null },
                    ],
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(invalidResponseset);
                expect(res.status).toBe(400);
                expect(res.body.code).toBe(400);
                expect(res.body.validationErrors).toBeDefined();
                expect(res.body.validationErrors.length).toBeGreaterThan(0);
            });
        });
        describe("processFormSubmission - scoring condition questions", () => {
            test("normal condition question score: scores both parent and child when answered correctly", async () => {
                const parentId = new mongoose_1.Types.ObjectId();
                const childId = new mongoose_1.Types.ObjectId();
                const parentQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: parentId,
                    formId: testQuizForm._id,
                    qIdx: 0,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    conditional: [
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: childId,
                            contentIdx: 1,
                        },
                    ],
                });
                const childQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: childId,
                    formId: testQuizForm._id,
                    qIdx: 1,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 1, isCorrect: true },
                    parentcontent: {
                        qId: parentId.toString(),
                        qIdx: 0,
                        optIdx: 0,
                    },
                });
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: testQuizForm._id,
                    replaceQuestion: [parentQuestion, childQuestion],
                });
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const submissionData = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: [
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: parentId.toString(),
                            response: 0,
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: childId.toString(),
                            response: 1,
                        }),
                    ],
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(submissionData);
                expect(res.status).toBe(200);
                expect(res.body.code).toBe(200);
                expect(res.body.data).toBeDefined();
                expect(res.body.data.totalScore).toBe(20);
                expect(res.body.data.isNonScore).toBe(false);
                // Verify database persistence in FormResponse
                const savedResponse = await Response_model_1.default.findById(res.body.data.responseId).lean();
                expect(savedResponse).toBeDefined();
                expect(savedResponse?.totalScore).toBe(20);
                expect(savedResponse?.responseset).toHaveLength(2);
                const parentResp = savedResponse?.responseset.find((r) => r.question.toString() === parentId.toString());
                const childResp = savedResponse?.responseset.find((r) => r.question.toString() === childId.toString());
                expect(parentResp?.score).toBe(10);
                expect(parentResp?.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
                expect(childResp?.score).toBe(10);
                expect(childResp?.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            });
            test("condition with useChildScoreSum = true: calculates individual child scores correctly", async () => {
                const parentId = new mongoose_1.Types.ObjectId();
                const child1Id = new mongoose_1.Types.ObjectId();
                const child2Id = new mongoose_1.Types.ObjectId();
                const parentQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: parentId,
                    formId: testQuizForm._id,
                    qIdx: 0,
                    score: 20,
                    useChildScoreSum: true,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    conditional: [
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: child1Id,
                            contentIdx: 1,
                        },
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: child2Id,
                            contentIdx: 2,
                        },
                    ],
                });
                const child1Question = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: child1Id,
                    formId: testQuizForm._id,
                    qIdx: 1,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    parentcontent: {
                        qId: parentId.toString(),
                        qIdx: 0,
                        optIdx: 0,
                    },
                });
                const child2Question = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: child2Id,
                    formId: testQuizForm._id,
                    qIdx: 2,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 1, isCorrect: true },
                    parentcontent: {
                        qId: parentId.toString(),
                        qIdx: 0,
                        optIdx: 0,
                    },
                });
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: testQuizForm._id,
                    replaceQuestion: [parentQuestion, child1Question, child2Question],
                });
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const submissionData = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: [
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: parentId.toString(),
                            response: 0,
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: child1Id.toString(),
                            response: 0,
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: child2Id.toString(),
                            response: 1,
                        }),
                    ],
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(submissionData);
                expect(res.status).toBe(200);
                expect(res.body.code).toBe(200);
                const savedResponse = await Response_model_1.default.findById(res.body.data.responseId).lean();
                expect(savedResponse).toBeDefined();
                const child1Resp = savedResponse?.responseset.find((r) => r.question.toString() === child1Id.toString());
                const child2Resp = savedResponse?.responseset.find((r) => r.question.toString() === child2Id.toString());
                expect(child1Resp?.score).toBe(10);
                expect(child1Resp?.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
                expect(child2Resp?.score).toBe(10);
                expect(child2Resp?.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            });
            test("condition with isBonusScore = true: separates bonus child score into extraScore", async () => {
                const bonusParentId = new mongoose_1.Types.ObjectId();
                const bonusChildId = new mongoose_1.Types.ObjectId();
                const normalQuestionId = new mongoose_1.Types.ObjectId();
                const bonusParent = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: bonusParentId,
                    formId: testQuizForm._id,
                    qIdx: 0,
                    score: 0,
                    isBonusScore: true,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    conditional: [
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: bonusChildId,
                            contentIdx: 1,
                        },
                    ],
                });
                const bonusChild = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: bonusChildId,
                    formId: testQuizForm._id,
                    qIdx: 1,
                    score: 5,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    parentcontent: {
                        qId: bonusParentId.toString(),
                        qIdx: 0,
                        optIdx: 0,
                    },
                });
                const normalQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: normalQuestionId,
                    formId: testQuizForm._id,
                    qIdx: 2,
                    score: 20,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                });
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: testQuizForm._id,
                    replaceQuestion: [bonusParent, bonusChild, normalQuestion],
                });
                await Form_model_1.default.findByIdAndUpdate(testQuizForm._id, { totalscore: 20 });
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const submissionData = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: [
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: bonusParentId.toString(),
                            response: 0,
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: bonusChildId.toString(),
                            response: 0,
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: normalQuestionId.toString(),
                            response: 0,
                        }),
                    ],
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(submissionData);
                expect(res.status).toBe(200);
                expect(res.body.code).toBe(200);
                expect(res.body.data.totalScore).toBe(20);
                expect(res.body.data.extraScore).toBe(5);
                const savedResponse = await Response_model_1.default.findById(res.body.data.responseId).lean();
                expect(savedResponse).toBeDefined();
                expect(savedResponse?.totalScore).toBe(20);
                expect(savedResponse?.extraScore).toBe(5);
                expect(savedResponse?.maxScore).toBe(20);
            });
            test("condition question with incorrect answer receives 0 score", async () => {
                const parentId = new mongoose_1.Types.ObjectId();
                const childId = new mongoose_1.Types.ObjectId();
                const parentQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: parentId,
                    formId: testQuizForm._id,
                    qIdx: 0,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 0, isCorrect: true },
                    conditional: [
                        {
                            _id: new mongoose_1.Types.ObjectId(),
                            key: 0,
                            contentId: childId,
                            contentIdx: 1,
                        },
                    ],
                });
                const childQuestion = mockdata_1.MockContentFactory.createMultipleChoiceContent({
                    _id: childId,
                    formId: testQuizForm._id,
                    qIdx: 1,
                    score: 10,
                    answer: { _id: new mongoose_1.Types.ObjectId(), answer: 1, isCorrect: true },
                    parentcontent: {
                        qId: parentId.toString(),
                        qIdx: 0,
                        optIdx: 0,
                    },
                });
                await (0, helper_integration_1.createQuestionsWithFormId)({
                    formId: testQuizForm._id,
                    replaceQuestion: [parentQuestion, childQuestion],
                });
                const session = await (0, helper_integration_1.loggedUserInForm)({
                    email: respondentUser.email,
                    password: "pass@12345",
                    formId: testQuizForm.id,
                });
                const submissionData = {
                    respondentEmail: respondentUser.email,
                    respondentName: respondentUser.name,
                    responseSet: [
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: parentId.toString(),
                            response: 0, // correct (10 pts)
                        }),
                        mockdata_1.MockContentFactory.generateResponseSet({
                            question: childId.toString(),
                            response: 0, // incorrect (correct is 1, so 0 pts)
                        }),
                    ],
                };
                const res = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/submit-response/${testQuizForm.id}`)
                    .set("Cookie", [
                    `${helper_integration_1.testEnv.ACCESS_RESPONDENT_COOKIE}=${session?.accessToken}`,
                    `${helper_integration_1.testEnv.RESPONDENT_COOKIE}=${session?.refreshToken}`,
                ])
                    .send(submissionData);
                expect(res.status).toBe(200);
                expect(res.body.code).toBe(200);
                expect(res.body.data.totalScore).toBe(10);
                const savedResponse = await Response_model_1.default.findById(res.body.data.responseId).lean();
                expect(savedResponse?.totalScore).toBe(10);
                const childResp = savedResponse?.responseset.find((r) => r.question.toString() === childId.toString());
                expect(childResp?.score).toBe(0);
                expect(childResp?.scoringMethod).toBe(Response_model_1.ScoringMethod.AUTO);
            });
        });
        describe("Batch Update Scores (PUT /v0/api/response/batch-update-scores)", () => {
            let ownerUser;
            let nonOwnerUser;
            let ownerToken;
            let nonOwnerToken;
            let quizForm;
            let resp1;
            let resp2;
            let testQuestion;
            beforeEach(async () => {
                ownerUser = await (0, helper_integration_1.createTestUser)({
                    email: `batch_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
                });
                nonOwnerUser = await (0, helper_integration_1.createTestUser)({
                    email: `batch_nonowner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
                });
                ownerToken = jsonwebtoken_1.default.sign({ sub: ownerUser._id.toString(), role: ownerUser.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
                nonOwnerToken = jsonwebtoken_1.default.sign({ sub: nonOwnerUser._id.toString(), role: nonOwnerUser.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
                quizForm = await (0, helper_integration_1.createTestForm)(ownerUser._id, {
                    title: "Batch Scoring Test Quiz",
                    type: Form_model_1.TypeForm.Quiz,
                    totalscore: 50,
                    setting: { returnscore: Form_model_1.returnscore.manual },
                });
                testQuestion = await Content_model_1.default.create(mockdata_1.MockContentFactory.createTextContent({
                    formId: quizForm._id,
                    score: 20,
                    require: true,
                }));
                resp1 = await Response_model_1.default.create({
                    formId: quizForm._id,
                    userId: ownerUser._id,
                    respondentEmail: "student1@test.com",
                    responseset: [
                        {
                            question: testQuestion._id,
                            response: "Answer 1",
                            score: 0,
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                    ],
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
                });
                resp2 = await Response_model_1.default.create({
                    formId: quizForm._id,
                    userId: ownerUser._id,
                    respondentEmail: "student2@test.com",
                    responseset: [
                        {
                            question: testQuestion._id,
                            response: "Answer 2",
                            score: 0,
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                    ],
                    totalScore: 0,
                    completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
                });
            });
            it("returns 401 when unauthenticated", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .send({ updates: [{ responseId: resp1._id.toString(), score: 25 }] });
                expect(res.status).toBe(401);
            });
            it("returns 400 when updates array is missing or empty", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                    .send({ updates: [] });
                expect(res.status).toBe(400);
            });
            it("returns 400 when an update item is missing responseId or score", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                    .send({ updates: [{ responseId: resp1._id.toString() }] });
                expect(res.status).toBe(400);
            });
            it("returns 403 when user is not an owner or editor of the form", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${nonOwnerToken}`])
                    .send({
                    updates: [
                        { responseId: resp1._id.toString(), score: 25 },
                    ],
                });
                expect(res.status).toBe(403);
            });
            it("successfully updates overall scores for multiple responses in batch", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                    .send({
                    updates: [
                        { responseId: resp1._id.toString(), score: 30 },
                        { responseId: resp2._id.toString(), score: 45 },
                    ],
                });
                expect(res.status).toBe(200);
                expect(res.body.data.successful).toBe(2);
                const updated1 = await Response_model_1.default.findById(resp1._id).lean();
                const updated2 = await Response_model_1.default.findById(resp2._id).lean();
                expect(updated1?.totalScore).toBe(30);
                expect(updated2?.totalScore).toBe(45);
            });
            it("successfully updates question scores for multiple responses in batch", async () => {
                const res = await (0, supertest_1.default)(app_1.default)
                    .put(`${baseURL}/batch-update-scores`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                    .send({
                    updates: [
                        {
                            responseId: resp1._id.toString(),
                            scores: [{ questionId: testQuestion._id.toString(), score: 18, comment: "Well done" }],
                        },
                        {
                            responseId: resp2._id.toString(),
                            scores: [{ questionId: testQuestion._id.toString(), score: 12, comment: "Needs work" }],
                        },
                    ],
                });
                expect(res.status).toBe(200);
                expect(res.body.data.successful).toBe(2);
                const updated1 = await Response_model_1.default.findById(resp1._id).lean();
                expect(updated1?.totalScore).toBe(18);
                expect(updated1?.responseset[0].score).toBe(18);
                expect(updated1?.responseset[0].comment).toBe("Well done");
            });
        });
        describe("Batch Return Response & Score Visibility for Manual Forms", () => {
            let ownerUser;
            let respondentUser;
            let ownerToken;
            let respondentToken;
            let manualQuizForm;
            let formQuestion;
            let responseDoc;
            beforeEach(async () => {
                ownerUser = await (0, helper_integration_1.createTestUser)({
                    email: `manual_owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
                });
                respondentUser = await (0, helper_integration_1.createTestUser)({
                    email: `manual_resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`,
                });
                ownerToken = jsonwebtoken_1.default.sign({ sub: ownerUser._id.toString(), role: ownerUser.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
                respondentToken = jsonwebtoken_1.default.sign({ sub: respondentUser._id.toString(), role: respondentUser.role }, helper_integration_1.testEnv.JWT_SECRET, { expiresIn: "1h" });
                manualQuizForm = await (0, helper_integration_1.createTestForm)(ownerUser._id, {
                    title: "Manual Scoring Exam",
                    type: Form_model_1.TypeForm.Quiz,
                    totalscore: 100,
                    setting: { returnscore: Form_model_1.returnscore.manual },
                });
                formQuestion = await Content_model_1.default.create(mockdata_1.MockContentFactory.createTextContent({
                    formId: manualQuizForm._id,
                    score: 100,
                    require: true,
                }));
                responseDoc = await Response_model_1.default.create({
                    formId: manualQuizForm._id,
                    userId: respondentUser._id,
                    respondentEmail: respondentUser.email,
                    responseset: [
                        {
                            question: formQuestion._id,
                            response: "Detailed essay text",
                            score: 85,
                            scoringMethod: Response_model_1.ScoringMethod.MANUAL,
                        },
                    ],
                    totalScore: 85,
                    completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
                    isReturned: false,
                });
            });
            it("hides score on submission and GetFilledForm when score has not been returned yet", async () => {
                // 1. Respondent checks filled form via GET /v0/api/response/filled-form/:formId
                const res = await (0, supertest_1.default)(app_1.default)
                    .get(`${baseURL}/filled-form/${manualQuizForm._id}`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${respondentToken}`]);
                expect(res.status).toBe(200);
                // Respondent cannot see totalScore yet
                expect(res.body.data.response.totalScore).toBeUndefined();
                expect(res.body.data.response.isScoreReleased).toBe(false);
                // Question scores in responseset should also be masked
                expect(res.body.data.response.responseset[0].score).toBeUndefined();
            });
            it("allows form owner to batch return responses and reveals scores to respondents afterwards", async () => {
                // 1. Form owner returns response in batch via POST /v0/api/response/return
                const returnRes = await (0, supertest_1.default)(app_1.default)
                    .post(`${baseURL}/return`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${ownerToken}`])
                    .send({
                    responseId: [responseDoc._id.toString()],
                    html: "<p>Grades released</p>",
                    feedback: "Great job on your essay!",
                });
                expect(returnRes.status).toBe(200);
                // Verify MongoDB was updated
                const updatedResponse = await Response_model_1.default.findById(responseDoc._id).lean();
                expect(updatedResponse?.isReturned).toBe(true);
                expect(updatedResponse?.completionStatus).toBe("completed");
                // 2. Respondent checks filled form again
                const respondentCheck = await (0, supertest_1.default)(app_1.default)
                    .get(`${baseURL}/filled-form/${manualQuizForm._id}`)
                    .set("Cookie", [`${helper_integration_1.testEnv.ACCESS_TOKEN_COOKIE}=${respondentToken}`]);
                expect(respondentCheck.status).toBe(200);
                // Respondent can now see their score
                expect(respondentCheck.body.data.response.totalScore).toBe(85);
                expect(respondentCheck.body.data.response.isScoreReleased).toBe(true);
                expect(respondentCheck.body.data.response.responseset[0].score).toBe(85);
            });
        });
    });
});
