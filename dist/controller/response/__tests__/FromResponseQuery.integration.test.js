"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mockdata_1 = require("../../../utilities/mockdata");
const helper_integration_1 = require("../../form/__tests__/helper.integration");
const app_1 = __importDefault(require("../../../app"));
describe("FormResponse Query controller integration test", () => {
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
        testFormOwner = await (0, helper_integration_1.createTestUser)(sampleFormOwner);
        testForm = await (0, helper_integration_1.createTestForm)(testFormOwner._id);
        const generateTestQuestion = [
            mockdata_1.MockContentFactory.createMultipleChoiceContent(),
            mockdata_1.MockContentFactory.createCheckboxContent(),
            mockdata_1.MockContentFactory.createDateContent(),
            mockdata_1.MockContentFactory.createRangeDateContent(),
            mockdata_1.MockContentFactory.createDateContent(),
        ];
        testQuestions = (await (0, helper_integration_1.createQuestionsWithFormId)({
            formId: testForm._id,
            replaceQuestion: generateTestQuestion,
        }));
    });
    /**Test for getResponseList case analysis
     * [] normal fetch with all require filter options
     * [] Group response by email
     *
     */
    describe("GetResponses with Filters method", () => {
        let filterOptions;
        let baseURL = "/v0/api/response";
        beforeEach(async () => {
            //Normal fetch option
            filterOptions = {
                formId: testForm.id,
                page: 1,
                limit: 10,
            };
        });
        test("200 status should return standard data", async () => {
            const respondent = await (0, helper_integration_1.createTestUser)({
                email: "testRespondent@test.com",
            });
            const testresponse = await (0, helper_integration_1.createResponse)({
                formId: testForm.id,
                userId: respondent.id,
                respondentEmail: respondent.email,
            });
            //logging in as FormOwner
            const superTest = await (0, supertest_1.default)(app_1.default).get(`${baseURL}/getresponselist`);
        });
    });
});
