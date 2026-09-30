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
const user_controller_1 = require("../user.controller");
const User_model_1 = __importStar(require("../../../model/User.model"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
jest.mock("../../../model/User.model");
jest.mock("../../../utilities/email");
jest.mock("bcrypt");
describe("User Controller Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    beforeEach(() => {
        jest.clearAllMocks();
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
        };
    });
    describe("GetUserProfile", () => {
        test("returns 403 if user is not authenticated in request", async () => {
            mockReq = { user: undefined };
            await (0, user_controller_1.GetUserProfile)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("returns 404 if user does not exist in database", async () => {
            const userId = new mongoose_1.Types.ObjectId().toString();
            mockReq = { user: { sub: userId, role: User_model_1.ROLE.USER } };
            const selectMock = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            User_model_1.default.findById.mockReturnValue({ select: selectMock });
            await (0, user_controller_1.GetUserProfile)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ code: 404, message: "Can't find user" }));
        });
        test("returns 200 with user profile on success", async () => {
            const userId = new mongoose_1.Types.ObjectId().toString();
            const mockProfile = {
                _id: userId,
                email: "user@example.com",
                name: "Test User",
                role: User_model_1.ROLE.USER,
            };
            mockReq = { user: { sub: userId, role: User_model_1.ROLE.USER } };
            const selectMock = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockProfile),
            });
            User_model_1.default.findById.mockReturnValue({ select: selectMock });
            await (0, user_controller_1.GetUserProfile)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({ data: mockProfile });
        });
    });
    describe("RegisterUser", () => {
        test("returns 400 if user with same name or email already exists", async () => {
            mockReq = {
                body: {
                    email: "existing@example.com",
                    name: "ExistingName",
                    password: "password123",
                },
            };
            User_model_1.default.findOne.mockResolvedValue({ _id: "some-id" });
            await (0, user_controller_1.RegisterUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                code: 400,
                message: "Username or email already exist",
            }));
        });
        test("returns 201 when user is registered successfully", async () => {
            mockReq = {
                body: {
                    email: "new@example.com",
                    name: "NewName",
                    password: "Password123!",
                },
            };
            User_model_1.default.findOne.mockResolvedValue(null);
            bcrypt_1.default.genSaltSync.mockReturnValue("salt");
            bcrypt_1.default.hashSync.mockReturnValue("hashedPassword");
            User_model_1.default.create.mockResolvedValue({});
            await (0, user_controller_1.RegisterUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ code: 201, message: "User registered" }));
        });
    });
    describe("EditUser", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, body: { _id: "123", edittype: "name" } };
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 403 when user attempts to edit another user profile (IDOR protection)", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: { _id: "victim-user-id", edittype: "name", name: "HackedName" },
            };
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("returns 400 if missing _id or edittype", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: { _id: "user-id-1" },
            };
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("edits name successfully when username is not taken", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: { _id: "user-id-1", edittype: "name", name: "NewName" },
            };
            User_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            User_model_1.default.updateOne.mockResolvedValue({ acknowledged: true });
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(User_model_1.default.updateOne).toHaveBeenCalledWith({ _id: "user-id-1" }, { name: "NewName" });
        });
        test("returns 400 when attempting to change name to one that is already taken", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: { _id: "user-id-1", edittype: "name", name: "TakenName" },
            };
            User_model_1.default.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: "other-user" }),
            });
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: "Username already exist" }));
        });
        test("edits password successfully when old password matches", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: {
                    _id: "user-id-1",
                    edittype: "password",
                    password: "oldPassword",
                    newpassword: "newPassword123",
                },
            };
            User_model_1.default.findById.mockResolvedValue({
                _id: "user-id-1",
                password: "hashedOldPassword",
            });
            bcrypt_1.default.compareSync.mockReturnValue(true);
            bcrypt_1.default.genSaltSync.mockReturnValue("salt");
            bcrypt_1.default.hashSync.mockReturnValue("newHashedPassword");
            User_model_1.default.findByIdAndUpdate.mockResolvedValue({});
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(User_model_1.default.findByIdAndUpdate).toHaveBeenCalledWith("user-id-1", {
                password: "newHashedPassword",
            });
        });
        test("returns 400 when old password is incorrect", async () => {
            mockReq = {
                user: { sub: "user-id-1", role: User_model_1.ROLE.USER },
                body: {
                    _id: "user-id-1",
                    edittype: "password",
                    password: "wrongPassword",
                    newpassword: "newPassword123",
                },
            };
            User_model_1.default.findById.mockResolvedValue({
                _id: "user-id-1",
                password: "hashedOldPassword",
            });
            bcrypt_1.default.compareSync.mockReturnValue(false);
            await (0, user_controller_1.EditUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
    });
    describe("DeleteUser", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq = { user: undefined, body: { id: "user-1" } };
            await (0, user_controller_1.DeleteUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 400 if user ID is missing", async () => {
            mockReq = { user: { sub: "user-1", role: User_model_1.ROLE.USER }, body: {} };
            await (0, user_controller_1.DeleteUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
        });
        test("returns 403 when attempting to delete another user (IDOR prevention)", async () => {
            mockReq = {
                user: { sub: "user-1", role: User_model_1.ROLE.USER },
                body: { id: "victim-user-2" },
            };
            await (0, user_controller_1.DeleteUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                message: "Access denied: cannot delete other users",
            }));
            expect(User_model_1.default.findByIdAndDelete).not.toHaveBeenCalled();
        });
        test("allows user to delete their own account", async () => {
            mockReq = {
                user: { sub: "user-1", role: User_model_1.ROLE.USER },
                body: { id: "user-1" },
            };
            User_model_1.default.findByIdAndDelete.mockResolvedValue({
                _id: "user-1",
            });
            await (0, user_controller_1.DeleteUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(User_model_1.default.findByIdAndDelete).toHaveBeenCalledWith("user-1");
        });
        test("allows admin to delete another user account", async () => {
            mockReq = {
                user: { sub: "admin-1", role: User_model_1.ROLE.ADMIN },
                body: { id: "target-user-2" },
            };
            User_model_1.default.findByIdAndDelete.mockResolvedValue({
                _id: "target-user-2",
            });
            await (0, user_controller_1.DeleteUser)(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(User_model_1.default.findByIdAndDelete).toHaveBeenCalledWith("target-user-2");
        });
    });
});
