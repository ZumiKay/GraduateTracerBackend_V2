import { Request, Response } from "express";
import {
  GetUserProfile,
  RegisterUser,
  EditUser,
  DeleteUser,
} from "../user.controller";
import User, { ROLE } from "../../../model/User.model";
import { CustomRequest } from "../../../types/customType";
import bcrypt from "bcrypt";
import { Types } from "mongoose";

jest.mock("../../../model/User.model");
jest.mock("../../../utilities/email");
jest.mock("bcrypt");

describe("User Controller Unit Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

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

      await GetUserProfile(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("returns 404 if user does not exist in database", async () => {
      const userId = new Types.ObjectId().toString();
      mockReq = { user: { sub: userId, role: ROLE.USER } };

      const selectMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (User.findById as jest.Mock).mockReturnValue({ select: selectMock });

      await GetUserProfile(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ code: 404, message: "Can't find user" }),
      );
    });

    test("returns 200 with user profile on success", async () => {
      const userId = new Types.ObjectId().toString();
      const mockProfile = {
        _id: userId,
        email: "user@example.com",
        name: "Test User",
        role: ROLE.USER,
      };

      mockReq = { user: { sub: userId, role: ROLE.USER } };
      const selectMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile),
      });
      (User.findById as jest.Mock).mockReturnValue({ select: selectMock });

      await GetUserProfile(mockReq as CustomRequest, mockRes as Response);

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

      (User.findOne as jest.Mock).mockResolvedValue({ _id: "some-id" });

      await RegisterUser(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: "Username or email already exist",
        }),
      );
    });

    test("returns 201 when user is registered successfully", async () => {
      mockReq = {
        body: {
          email: "new@example.com",
          name: "NewName",
          password: "Password123!",
        },
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.genSaltSync as jest.Mock).mockReturnValue("salt");
      (bcrypt.hashSync as jest.Mock).mockReturnValue("hashedPassword");
      (User.create as jest.Mock).mockResolvedValue({});

      await RegisterUser(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ code: 201, message: "User registered" }),
      );
    });
  });

  describe("EditUser", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined, body: { _id: "123", edittype: "name" } };

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 403 when user attempts to edit another user profile (IDOR protection)", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: { _id: "victim-user-id", edittype: "name", name: "HackedName" },
      };

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("returns 400 if missing _id or edittype", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: { _id: "user-id-1" },
      };

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("edits name successfully when username is not taken", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: { _id: "user-id-1", edittype: "name", name: "NewName" },
      };

      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      (User.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: "user-id-1" },
        { name: "NewName" },
      );
    });

    test("returns 400 when attempting to change name to one that is already taken", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: { _id: "user-id-1", edittype: "name", name: "TakenName" },
      };

      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "other-user" }),
      });

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Username already exist" }),
      );
    });

    test("edits password successfully when old password matches", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: {
          _id: "user-id-1",
          edittype: "password",
          password: "oldPassword",
          newpassword: "newPassword123",
        },
      };

      (User.findById as jest.Mock).mockResolvedValue({
        _id: "user-id-1",
        password: "hashedOldPassword",
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);
      (bcrypt.genSaltSync as jest.Mock).mockReturnValue("salt");
      (bcrypt.hashSync as jest.Mock).mockReturnValue("newHashedPassword");
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("user-id-1", {
        password: "newHashedPassword",
      });
    });

    test("returns 400 when old password is incorrect", async () => {
      mockReq = {
        user: { sub: "user-id-1", role: ROLE.USER },
        body: {
          _id: "user-id-1",
          edittype: "password",
          password: "wrongPassword",
          newpassword: "newPassword123",
        },
      };

      (User.findById as jest.Mock).mockResolvedValue({
        _id: "user-id-1",
        password: "hashedOldPassword",
      });
      (bcrypt.compareSync as jest.Mock).mockReturnValue(false);

      await EditUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });
  });

  describe("DeleteUser", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined, body: { id: "user-1" } };

      await DeleteUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 400 if user ID is missing", async () => {
      mockReq = { user: { sub: "user-1", role: ROLE.USER }, body: {} };

      await DeleteUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("returns 403 when attempting to delete another user (IDOR prevention)", async () => {
      mockReq = {
        user: { sub: "user-1", role: ROLE.USER },
        body: { id: "victim-user-2" },
      };

      await DeleteUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access denied: cannot delete other users",
        }),
      );
      expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("allows user to delete their own account", async () => {
      mockReq = {
        user: { sub: "user-1", role: ROLE.USER },
        body: { id: "user-1" },
      };

      (User.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: "user-1",
      });

      await DeleteUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(User.findByIdAndDelete).toHaveBeenCalledWith("user-1");
    });

    test("allows admin to delete another user account", async () => {
      mockReq = {
        user: { sub: "admin-1", role: ROLE.ADMIN },
        body: { id: "target-user-2" },
      };

      (User.findByIdAndDelete as jest.Mock).mockResolvedValue({
        _id: "target-user-2",
      });

      await DeleteUser(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(User.findByIdAndDelete).toHaveBeenCalledWith("target-user-2");
    });
  });
});
