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
const mongoose_1 = __importDefault(require("mongoose"));
const supertest_1 = __importDefault(require("supertest"));
const User_model_1 = __importDefault(require("../../../model/User.model"));
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const Response_model_1 = __importStar(require("../../../model/Response.model"));
const Usersession_model_1 = __importDefault(require("../../../model/Usersession.model"));
const ResponseQueryService_1 = require("../../../services/ResponseQueryService");
const mockdata_1 = require("../../../utilities/mockdata");
const helper_integration_1 = require("../../form/__tests__/helper.integration");
const app_1 = __importDefault(require("../../../app"));
const helper_1 = require("../../../utilities/helper");
describe("FormResponse Query controller integration test", () => {
    let baseURL = "/v0/api/response";
    let sampleFormOwner = {
        name: "testFormOwner",
        email: "testFormOwner@test.com",
        password: "Owner@12345",
    };
    let testFormOwner;
    let testForm;
    let testQuestions;
    let testResponses;
    beforeAll(async () => {
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(helper_integration_1.testEnv.DATABASE_URL);
        }
        testFormOwner = await (0, helper_integration_1.createTestUser)(sampleFormOwner);
        testForm = await (0, helper_integration_1.createTestForm)(testFormOwner._id);
        const conditionQuestions = mockdata_1.MockContentFactory.createConditionQuestionWithChilds({
            parent: mockdata_1.MockContentFactory.createCheckboxContent({
                formId: testForm._id,
                qIdx: 5,
            }),
            childs: [
                mockdata_1.MockContentFactory.createTextContent({
                    formId: testForm._id,
                    qIdx: 6,
                }),
                mockdata_1.MockContentFactory.createDateContent({
                    formId: testForm._id,
                    qIdx: 7,
                }),
            ],
        });
        const generateTestQuestion = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent({
                formId: testForm._id,
                qIdx: 0,
            }),
            mockdata_1.MockContentFactory.createCheckboxContent({
                formId: testForm._id,
                qIdx: 1,
            }),
            mockdata_1.MockContentFactory.createDateContent({ formId: testForm._id, qIdx: 2 }),
            mockdata_1.MockContentFactory.createRangeDateContent({
                qIdx: 3,
                formId: testForm._id,
            }),
            mockdata_1.MockContentFactory.createDateContent({ qIdx: 4, formId: testForm._id }),
            ...conditionQuestions,
        ];
        testQuestions = (await (0, helper_integration_1.createQuestionsWithFormId)({
            formId: testForm._id,
            replaceQuestion: generateTestQuestion,
        }));
    });
    afterAll(async () => {
        await User_model_1.default.deleteMany({});
        await Form_model_1.default.deleteMany({});
        await Content_model_1.default.deleteMany({});
        await Response_model_1.default.deleteMany({});
        await Usersession_model_1.default.deleteMany({});
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
        }
    });
    /**Test for getResponseList case analysis
     * [x] normal fetch with all require filter options
     * [x] Group response by email
     */
    describe("GetResponses with Filters method", () => {
        let filterOptions;
        beforeEach(() => {
            process.env = helper_integration_1.testEnv;
            //Normal fetch option
            filterOptions = {
                formId: testForm._id.toString(),
                page: 1,
                limit: 10,
            };
        });
        test("200 status should return standard data", async () => {
            const respondent = await (0, helper_integration_1.createTestUser)({
                email: `respondent_${Date.now()}@test.com`,
                password: "pass@12345",
            });
            await (0, helper_integration_1.createResponse)({
                formId: testForm._id.toString(),
                userId: respondent.id,
                respondentEmail: respondent.email,
            });
            //logging in as FormOwner
            const isLoggedInFormOwner = await (0, helper_integration_1.loginNormalUser)(testFormOwner);
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getresponselist`)
                .query(filterOptions)
                .set("Cookie", isLoggedInFormOwner?.cookies);
            expect(superTest.status).toBe(200);
            const data = superTest.body.data || superTest.body;
            expect(data.responses).toBeDefined();
            expect(Array.isArray(data.responses)).toBe(true);
            expect(data.pagination).toBeDefined();
        });
        test("200 status with group=respondentEmail should return grouped responses", async () => {
            const respondent = await (0, helper_integration_1.createTestUser)({
                email: `grouped_${Date.now()}@test.com`,
                password: "pass@12345",
            });
            await (0, helper_integration_1.createResponse)({
                formId: testForm._id.toString(),
                userId: respondent.id,
                respondentEmail: respondent.email,
            });
            await (0, helper_integration_1.createResponse)({
                formId: testForm._id.toString(),
                userId: respondent.id,
                respondentEmail: respondent.email,
            });
            const isLoggedInFormOwner = await (0, helper_integration_1.loginNormalUser)(testFormOwner);
            const res = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getresponselist`)
                .query({
                ...filterOptions,
                group: "respondentEmail",
            })
                .set("Cookie", isLoggedInFormOwner?.cookies);
            expect(res.status).toBe(200);
            const resData = res.body.data || res.body;
            expect(resData.responses).toBeDefined();
            const grouped = resData.responses.find((item) => item.respondentEmail === respondent.email);
            expect(grouped).toBeDefined();
            expect(grouped.responseCount).toBe(2);
        });
    });
    describe("Get Responses By ID method", () => {
        let loggedIn;
        beforeEach(async () => {
            loggedIn = await (0, helper_integration_1.loginNormalUser)({
                email: testFormOwner.email,
                password: testFormOwner.password,
            });
        });
        test("400 status if param is invalid", async () => {
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getresponseById/undefinedId/${testForm.id}`)
                .set("Cookie", loggedIn?.cookies);
            expect(superTest.status).toBe(400);
            expect(superTest.body.message).toBeDefined();
        });
        test("200 status should return correct response data", async () => {
            //prepare data
            const testRespondent = await (0, helper_integration_1.createTestUser)({
                email: `testRespondent_${Date.now()}@example.com`,
                name: "testRespondent",
                password: "pass@12345",
            });
            const testResponse = await (0, helper_integration_1.createResponse)({
                formId: testForm._id.toString(),
                userId: testRespondent._id.toString(),
                respondentEmail: testRespondent.email,
                questions: testQuestions,
            });
            const contents = (await Content_model_1.default.find({ formId: testForm._id })
                .select("-rangedate -date -rangenumber")
                .sort({ qIdx: 1 })
                .lean());
            const expectResult = {
                _id: testResponse?._id,
                formId: testResponse?.formId,
                respondentEmail: testResponse?.respondentEmail,
                respondentType: Response_model_1.RespondentType.user,
                isCompleted: true,
                completionStatus: Response_model_1.ResponseCompletionStatus.submitted,
                createdAt: testResponse?.createdAt,
                totalScore: testResponse?.totalScore,
                submittedAt: (0, helper_1.formatDateToDDMMYYYY)(testResponse?.submittedAt),
                responseCount: 1,
                isScoreable: true,
                responseset: ResponseQueryService_1.ResponseQueryService.ResponsesetProcessQuestion((0, helper_1.AddQuestionNumbering)({
                    questions: contents,
                }), testResponse?.responseset),
            };
            const superTest = await (0, supertest_1.default)(app_1.default)
                .get(`${baseURL}/getresponseById/${expectResult._id.toString()}/${testForm._id.toString()}`)
                .set("Cookie", loggedIn?.cookies);
            expect(superTest.status).toBe(200);
            const data = superTest.body.data || superTest.body;
            expect(data).toBeDefined();
            expect(data._id.toString()).toBe(expectResult._id.toString());
            expect(data.formId.toString()).toBe(testForm._id.toString());
            expect(data.respondentEmail).toBe(testRespondent.email);
            expect(data.responseCount).toBe(1);
            expect(data.isScoreable).toBe(true);
            expect(data.responseset).toBeDefined();
            expect(data.responseset.length).toBe(testQuestions.length);
        });
    });
});
