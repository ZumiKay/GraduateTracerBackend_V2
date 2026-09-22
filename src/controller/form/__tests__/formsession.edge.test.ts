import { Response } from "express";
import FormsessionService from "../formsession.controller";
import Formsession from "../../../model/Formsession.model";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";

jest.mock("../../../model/Formsession.model");
jest.mock("../../../model/Form.model");

describe("Formsession Edge Case & Replay Protection Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockClearCookie: jest.Mock;
  let mockCookie: jest.Mock;

  const validCode = "removal_code_123456";
  const validSessionId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESPONDENT_TOKEN_JWT_SECRET = "test_respondent_jwt_secret_key";
    process.env.ACCESS_RESPONDENT_COOKIE = "access_resp_cookie";
    process.env.RESPONDENT_COOKIE = "refresh_resp_cookie";

    mockJson = jest.fn();
    mockClearCookie = jest.fn();
    mockCookie = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRes = {
      status: mockStatus,
      json: mockJson,
      clearCookie: mockClearCookie,
      cookie: mockCookie,
    };
  });

  describe("ReplaceSession", () => {
    test("returns 500 if critical environment variables are missing", async () => {
      delete (process.env as any).RESPONDENT_TOKEN_JWT_SECRET;
      mockReq = { params: { code: validCode } };

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ error: "MISSING_ENV_VARIABLES" }),
      );
    });

    test("returns 404 if code param is missing", async () => {
      mockReq = { params: {} };

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 403 when verifying a code that does not exist (?verify=1)", async () => {
      mockReq = {
        params: { code: "non-existent-code" },
        query: { verify: "1" },
      };

      (Formsession.countDocuments as jest.Mock).mockResolvedValue(0);

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("returns 200 when verifying a code that exists (?verify=1)", async () => {
      mockReq = {
        params: { code: validCode },
        query: { verify: "1" },
      };

      (Formsession.countDocuments as jest.Mock).mockResolvedValue(1);

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    test("returns 404 if removal code is invalid", async () => {
      mockReq = {
        params: { code: "consumed-code" },
        query: {},
      };

      (Formsession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid code" }),
      );
    });

    test("returns 404 if the form is closed (acceptResponses = false)", async () => {
      mockReq = {
        params: { code: validCode },
        query: {},
      };

      const mockSession = {
        _id: validSessionId,
        form: { setting: { acceptResponses: false } },
      };

      (Formsession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockSession),
            }),
          }),
        }),
      });

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Form is closed" }),
      );
    });

    test("consumes removal code with ?skiplogin=1, deletes session, and clears cookies", async () => {
      mockReq = {
        params: { code: validCode },
        query: { skiplogin: "1" },
      };

      const mockSession = {
        _id: validSessionId,
        form: { setting: { acceptResponses: true } },
      };

      (Formsession.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockSession),
            }),
          }),
        }),
      });

      (Formsession.deleteOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue({ acknowledged: true }),
      });

      await FormsessionService.ReplaceSession(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(Formsession.deleteOne).toHaveBeenCalledWith({
        _id: validSessionId,
      });
      expect(mockClearCookie).toHaveBeenCalledWith(
        "refresh_resp_cookie",
        expect.any(Object),
      );
      expect(mockClearCookie).toHaveBeenCalledWith(
        "access_resp_cookie",
        expect.any(Object),
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Session Terminated" }),
      );
    });
  });

  describe("SignOut", () => {
    test("clears cookies and removes formsession from database", async () => {
      mockReq = {
        formsession: {
          sub: validSessionId,
        },
      };

      (Formsession.deleteOne as jest.Mock).mockResolvedValue({
        acknowledged: true,
      });

      await FormsessionService.SignOut(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(Formsession.deleteOne).toHaveBeenCalledWith({
        session_id: validSessionId,
      });
      expect(mockClearCookie).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Logged Out" }),
      );
    });
  });
});
