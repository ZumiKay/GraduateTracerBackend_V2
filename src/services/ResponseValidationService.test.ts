import { Response } from "express";
import { Types } from "mongoose";
import { ResponseValidationService } from "./ResponseValidationService";
import { CustomRequest, UserToken } from "../types/customType";
import { ReturnCode } from "../utilities/helper";
import Form from "../model/Form.model";
import FormResponse from "../model/Response.model";
import { hasFormAccess } from "../utilities/formHelpers";
import { ROLE } from "../model/User.model";

jest.mock("../model/Form.model");
jest.mock("../model/Response.model", () => {
  const actual = jest.requireActual("../model/Response.model");
  return {
    __esModule: true,
    ...actual,
    default: {
      findById: jest.fn(),
    },
  };
});
jest.mock("../utilities/formHelpers", () => {
  const actual = jest.requireActual("../utilities/formHelpers");
  return {
    __esModule: true,
    ...actual,
    hasFormAccess: jest.fn(),
  };
});

describe("ResponseValidationService", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  const validObjectId = new Types.ObjectId().toString();
  const validUserId = new Types.ObjectId().toString();

  const sampleUser: UserToken = {
    sub: validUserId,
    role: ROLE.USER,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: sampleUser,
      query: {},
      params: {},
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("validateRequest", () => {
    describe("Authentication / Token checks", () => {
      test("returns 404 and isValid=false when user is missing and noToken is not set", () => {
        mockReq.user = undefined;

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(ReturnCode(404));
        expect(result).toStrictEqual({ isValid: false });
      });

      test("proceeds when user is missing but noToken is true", () => {
        mockReq.user = undefined;
        mockReq.query = { formId: validObjectId };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          noToken: true,
        });

        expect(result.isValid).toBe(true);
        expect(result.user).toBeUndefined();
      });
    });

    describe("requireFormId = true (default)", () => {
      test("returns 400 when formId is missing", () => {
        mockReq.query = {};

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          requireFormId: true,
        });

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(ReturnCode(400));
        expect(result).toStrictEqual({ isValid: false });
      });

      test("returns 400 when formId is an invalid ObjectId string", () => {
        mockReq.query = { formId: "invalid-id-123" };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(ReturnCode(400));
        expect(result).toStrictEqual({ isValid: false });
      });

      test("extracts formId from req.query.formId", () => {
        mockReq.query = { formId: validObjectId };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(result.isValid).toBe(true);
        expect(result.formId).toBe(validObjectId);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
      });

      test("extracts formId from req.params.formId", () => {
        mockReq.query = {};
        mockReq.params = { formId: validObjectId };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(result.isValid).toBe(true);
        expect(result.formId).toBe(validObjectId);
      });

      test("extracts formId from req.body.formId", () => {
        mockReq.query = {};
        mockReq.params = {};
        mockReq.body = { formId: validObjectId };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(result.isValid).toBe(true);
        expect(result.formId).toBe(validObjectId);
      });

      test("parses custom page and limit from query params", () => {
        mockReq.query = {
          formId: validObjectId,
          page: "3",
          limit: "25",
          uid: "user-123",
          rid: "resp-456",
        };
        mockReq.body = {
          message: "Test message",
          emails: ["test@example.com"],
        };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
        });

        expect(result).toStrictEqual({
          user: sampleUser,
          formId: validObjectId,
          page: 3,
          limit: 25,
          uid: "user-123",
          rid: "resp-456",
          isValid: true,
          message: "Test message",
          emails: ["test@example.com"],
        });
      });
    });

    describe("requireFormId = false", () => {
      test("returns 400 when requireUserInfo is true but uid is missing", () => {
        mockReq.query = {};

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          requireFormId: false,
          requireUserInfo: true,
        });

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(ReturnCode(400));
        expect(result).toStrictEqual({ isValid: false });
      });

      test("returns 400 when requireUserInfo is true but user is missing", () => {
        mockReq.user = undefined;
        mockReq.query = { uid: "user-123" };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          requireFormId: false,
          requireUserInfo: true,
          noToken: true,
        });

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(ReturnCode(400));
        expect(result).toStrictEqual({ isValid: false });
      });

      test("returns valid when requireUserInfo is true and both uid and user exist", () => {
        mockReq.query = { uid: "user-123", page: "2", limit: "15" };

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          requireFormId: false,
          requireUserInfo: true,
        });

        expect(result).toStrictEqual({
          user: sampleUser,
          page: 2,
          limit: 15,
          isValid: true,
        });
      });

      test("defaults to page 1 and limit 10 when req.query is undefined and requireFormId is false", () => {
        mockReq.query = undefined as unknown as any;

        const result = ResponseValidationService.validateRequest({
          req: mockReq as CustomRequest,
          res: mockRes as Response,
          requireFormId: false,
        });

        expect(result).toStrictEqual({
          user: sampleUser,
          page: 1,
          limit: 10,
          isValid: true,
        });
      });
    });
  });

  describe("validateFormAccess", () => {
    test("returns 404 when form is not found", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await ResponseValidationService.validateFormAccess(
        validObjectId,
        validUserId,
        mockRes as Response,
      );

      expect(Form.findById).toHaveBeenCalledWith(expect.any(Types.ObjectId));
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(404, "Form not found"),
      );
      expect(result).toBeNull();
    });

    test("returns 403 when user does not have access to the form", async () => {
      const mockForm = { _id: validObjectId, title: "Survey" };
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockForm),
      });
      (hasFormAccess as jest.Mock).mockReturnValue(false);

      const result = await ResponseValidationService.validateFormAccess(
        validObjectId,
        validUserId,
        mockRes as Response,
      );

      expect(hasFormAccess).toHaveBeenCalledWith(
        mockForm,
        expect.any(Types.ObjectId),
      );
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(403, "Access denied"),
      );
      expect(result).toBeNull();
    });

    test("returns form when access is granted", async () => {
      const mockForm = { _id: validObjectId, title: "Survey" };
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockForm),
      });
      (hasFormAccess as jest.Mock).mockReturnValue(true);

      const result = await ResponseValidationService.validateFormAccess(
        validObjectId,
        validUserId,
        mockRes as Response,
      );

      expect(result).toBe(mockForm);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("returns 500 when an unexpected database error occurs", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      });
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await ResponseValidationService.validateFormAccess(
        validObjectId,
        validUserId,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(500, "Failed to validate form access"),
      );
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("validateResponseAccess", () => {
    const responseId = new Types.ObjectId().toString();

    test("returns 404 when form response is not found", async () => {
      (FormResponse.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const result = await ResponseValidationService.validateResponseAccess(
        responseId,
        validUserId,
        mockRes as Response,
      );

      expect(FormResponse.findById).toHaveBeenCalledWith(responseId);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(404, "Response not found"),
      );
      expect(result).toBeNull();
    });

    test("returns 404 when associated form is not found", async () => {
      const mockResponse = {
        _id: responseId,
        formId: validObjectId,
      };
      (FormResponse.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResponse),
      });
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await ResponseValidationService.validateResponseAccess(
        responseId,
        validUserId,
        mockRes as Response,
      );

      expect(Form.findById).toHaveBeenCalledWith(validObjectId);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(404, "Form not found"),
      );
      expect(result).toBeNull();
    });

    test("returns 403 when user does not have access to the associated form", async () => {
      const mockResponse = {
        _id: responseId,
        formId: validObjectId,
      };
      const mockForm = { _id: validObjectId, title: "Survey" };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResponse),
      });
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockForm),
      });
      (hasFormAccess as jest.Mock).mockReturnValue(false);

      const result = await ResponseValidationService.validateResponseAccess(
        responseId,
        validUserId,
        mockRes as Response,
      );

      expect(hasFormAccess).toHaveBeenCalledWith(
        mockForm,
        expect.any(Types.ObjectId),
      );
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(403, "Access denied"),
      );
      expect(result).toBeNull();
    });

    test("returns { response, form } when access is granted", async () => {
      const mockResponse = {
        _id: responseId,
        formId: validObjectId,
      };
      const mockForm = { _id: validObjectId, title: "Survey" };

      (FormResponse.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResponse),
      });
      (Form.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockForm),
      });
      (hasFormAccess as jest.Mock).mockReturnValue(true);

      const result = await ResponseValidationService.validateResponseAccess(
        responseId,
        validUserId,
        mockRes as Response,
      );

      expect(result).toStrictEqual({
        response: mockResponse,
        form: mockForm,
      });
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("returns 500 when an unexpected database error occurs", async () => {
      (FormResponse.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error("DB Error")),
      });
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await ResponseValidationService.validateResponseAccess(
        responseId,
        validUserId,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        ReturnCode(500, "Failed to validate response access"),
      );
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });
});
