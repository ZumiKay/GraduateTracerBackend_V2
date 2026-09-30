"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const form_controller_1 = require("../form.controller");
const Form_model_1 = __importDefault(require("../../../model/Form.model"));
const Content_model_1 = __importDefault(require("../../../model/Content.model"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../model/Form.model");
jest.mock("../../../model/Content.model");
describe("Form Controller Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    const primaryOwnerId = new mongoose_1.Types.ObjectId().toString();
    const editorId = new mongoose_1.Types.ObjectId().toString();
    const formId = new mongoose_1.Types.ObjectId().toString();
    beforeEach(() => {
        jest.clearAllMocks();
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
        };
    });
    describe("CreateForm", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, body: { title: "New Form" } };
            await (0, form_controller_1.CreateForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("creates form and returns 201 on success", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { title: "Test Form", totalpage: 1 },
            };
            const createdId = new mongoose_1.Types.ObjectId();
            Form_model_1.default.create.mockResolvedValue({ _id: createdId });
            await (0, form_controller_1.CreateForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                code: 201,
                message: "Form Created",
                data: expect.objectContaining({ _id: createdId, title: "Test Form" }),
            }));
        });
    });
    describe("EditForm", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = {
                user: undefined,
                body: { data: { _id: formId, title: "Updated" } },
            };
            await (0, form_controller_1.EditForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 404 if form not found", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { data: { _id: formId, title: "Updated" } },
            };
            Form_model_1.default.findById.mockResolvedValue(null);
            await (0, form_controller_1.EditForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 403 if user lacks access to form", async () => {
            const unrelatedUserId = new mongoose_1.Types.ObjectId().toString();
            mockReq = {
                user: { sub: unrelatedUserId, role: User_model_1.ROLE.USER },
                body: { data: { _id: formId, title: "Updated" } },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId),
                owners: [],
                editors: [],
            };
            Form_model_1.default.findById.mockResolvedValue(mockForm);
            await (0, form_controller_1.EditForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("updates form and returns 200 on success", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: {
                    data: {
                        _id: formId,
                        title: "Updated Title",
                        setting: { submitonce: true },
                    },
                },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId),
                owners: [],
                editors: [],
            };
            Form_model_1.default.findById.mockResolvedValue(mockForm);
            Form_model_1.default.findByIdAndUpdate.mockResolvedValue({});
            await (0, form_controller_1.EditForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ code: 200, message: "Form Updated" }));
        });
    });
    describe("DeleteForm (Privilege Escalation Prevention)", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, body: { ids: [formId] } };
            await (0, form_controller_1.DeleteForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 400 if no IDs provided", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { ids: [] },
            };
            await (0, form_controller_1.DeleteForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("returns 403 when an editor attempts to delete the form (privilege escalation check)", async () => {
            mockReq = {
                user: { sub: editorId, role: User_model_1.ROLE.USER },
                body: { ids: [formId] },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId), // Primary owner is different
                editors: [{ _id: new mongoose_1.Types.ObjectId(editorId) }], // Current user is only editor
                owners: [],
            };
            Form_model_1.default.find.mockResolvedValue([mockForm]);
            await (0, form_controller_1.DeleteForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Access denied: only primary owner can delete forms",
            }));
            expect(Form_model_1.default.deleteMany).not.toHaveBeenCalled();
        });
        test("allows primary owner to delete their form", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { ids: [formId] },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId),
                owners: [],
                editors: [],
            };
            Form_model_1.default.find.mockResolvedValue([mockForm]);
            Form_model_1.default.deleteMany.mockResolvedValue({ deletedCount: 1 });
            await (0, form_controller_1.DeleteForm)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(Form_model_1.default.deleteMany).toHaveBeenCalled();
        });
    });
    describe("PageHandler (Scoping & Cross-form Data Integrity)", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, body: { ty: "add", formId } };
            await (0, form_controller_1.PageHandler)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 400 if missing operation type", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { formId },
            };
            await (0, form_controller_1.PageHandler)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("adds page by incrementing totalpage", async () => {
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { ty: "add", formId },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId),
                totalpage: 1,
            };
            Form_model_1.default.findById.mockResolvedValue(mockForm);
            Form_model_1.default.updateOne.mockResolvedValue({});
            await (0, form_controller_1.PageHandler)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(Form_model_1.default.updateOne).toHaveBeenCalledWith({ _id: formId }, { $inc: { totalpage: 1 } });
        });
        test("deletes page scoped strictly to the target formId and shifts subsequent pages", async () => {
            const deletePageNum = 2;
            mockReq = {
                user: { sub: primaryOwnerId, role: User_model_1.ROLE.USER },
                body: { ty: "delete", formId, deletepage: deletePageNum },
            };
            const mockForm = {
                _id: formId,
                user: new mongoose_1.Types.ObjectId(primaryOwnerId),
                totalpage: 3,
            };
            const mockQuestions = [
                { _id: new mongoose_1.Types.ObjectId("65a000000000000000000001") },
                { _id: new mongoose_1.Types.ObjectId("65a000000000000000000002") },
            ];
            Form_model_1.default.findById.mockResolvedValue(mockForm);
            Content_model_1.default.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockQuestions),
                }),
            });
            Form_model_1.default.updateOne.mockResolvedValue({});
            Content_model_1.default.deleteMany.mockResolvedValue({});
            Content_model_1.default.updateMany.mockResolvedValue({});
            await (0, form_controller_1.PageHandler)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            // Verify Content.find was scoped to formId and page
            expect(Content_model_1.default.find).toHaveBeenCalledWith({
                formId: new mongoose_1.Types.ObjectId(formId),
                page: deletePageNum,
            });
            // Verify Content.deleteMany was scoped to formId and page
            expect(Content_model_1.default.deleteMany).toHaveBeenCalledWith({
                formId: new mongoose_1.Types.ObjectId(formId),
                page: deletePageNum,
            });
            // Verify remaining pages > 2 are shifted down
            expect(Content_model_1.default.updateMany).toHaveBeenCalledWith({
                formId: new mongoose_1.Types.ObjectId(formId),
                page: { $gt: deletePageNum },
            }, {
                $inc: { page: -1 },
            });
        });
    });
});
