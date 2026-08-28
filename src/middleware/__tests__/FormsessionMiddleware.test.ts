import { NextFunction, Response } from "express";
import { CustomRequest, RESPONSES, UserToken } from "../../types/customType";
import FormsessionMiddleware from "../Formsession.middleware";
import { ROLE } from "../../model/User.model";
import { Types } from "mongoose";
import Form, { FormType, TypeForm } from "../../model/Form.model";
import { GenerateToken } from "../../utilities/helper";
import Formsession, {
  Formsessiondatatype,
  FormSessionTokenType,
} from "../../model/Formsession.model";
import { generateExpirationDate } from "../../services/__tests__/FormLinkService.test";
import { GetPublicFormDataTyEnum } from "../User.middleware";

jest.mock("../../model/Formsession.model");
jest.mock("../../model/Form.model");

describe("Formsession mideleware test", () => {
  let mockedReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let nextFun: NextFunction;
  let sampleActiveSession: Partial<FormSessionTokenType>;
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      RESPONDENT_TOKEN_JWT_SECRET: "verysecret",
      RESPONDENT_COOKIE: "refreshFormCookie",
      ACCESS_RESPONDENT_COOKIE: "accessFormCookie",
    };

    //Request obj mocks
    nextFun = jest.fn();
    mockedReq = {
      body: {},
      cookies: {},
      params: {
        formId: new Types.ObjectId().toString(),
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("VerifyFormsession method", () => {
    const mockFormReq = ({
      form,
      sampleSession,
    }: {
      form: FormType;
      sampleSession?: Partial<Formsessiondatatype>;
    }) => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(form),
        }),
      });
      sampleSession &&
        (Formsession.findOne as jest.Mock).mockReturnValue({
          lean: jest.fn().mockResolvedValue(sampleSession),
        });
    };
    const sampleForm: Partial<FormType> = {
      _id: mockedReq?.params?.formId as never,
      type: TypeForm.Quiz,
      setting: {
        email: true,
        acceptResponses: true,
      },
    };
    test("status 500 if missing env", async () => {
      process.env = {
        ...originalEnv,
        RESPONDENT_COOKIE: undefined,
        ACCESS_RESPONDENT_COOKIE: undefined,
      } as never;

      await FormsessionMiddleware.VerifyFormsession(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        RESPONSES.missingCookieConfig(),
      );
    });
    test("status 400 if formId is invalid", async () => {
      mockedReq = {
        ...mockedReq,
        params: {
          formId: "invalidFormId",
        },
      };

      await FormsessionMiddleware.VerifyFormsession(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(RESPONSES.invalidFormId());
    });
    test("status 500 with DB Errors", async () => {
      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error("Error DB")),
        }),
      });
      await FormsessionMiddleware.VerifyFormsession(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        RESPONSES.internalServerError(),
      );
    });
    test("return status 401 and delete formsession if the session token is invalid", async () => {
      const sampleExpiredToken = GenerateToken(
        { role: ROLE.USER },
        -1,
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );
      const accessToken = GenerateToken(
        { role: ROLE.USER },
        "1h",
        process.env.RESPONDENT_TOKEN_JWT_SECRET,
      );
      mockedReq = {
        ...mockedReq,
        cookies: {
          [process.env.RESPONDENT_COOKIE]: sampleExpiredToken,
          [process.env.ACCESS_RESPONDENT_COOKIE]: accessToken,
        },
      };

      (Form.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(sampleForm),
        }),
      });
      (Formsession.deleteOne as jest.Mock).mockResolvedValue({});
      await FormsessionMiddleware.VerifyFormsession(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        RESPONSES.invalidSessionToken(),
      );
      expect(Formsession.deleteOne).toHaveBeenCalledWith({
        session_id: sampleExpiredToken,
      });
    });
    describe("Renew Access Token", () => {
      beforeEach(() => {
        //Mock 1hr expire cookie
        mockedReq = {
          ...mockedReq,
          cookies: {
            [process.env.RESPONDENT_COOKIE as string]: GenerateToken(
              { role: ROLE.USER },
              "1h",
              process.env.RESPONDENT_TOKEN_JWT_SECRET,
            ),
            [process.env.ACCESS_RESPONDENT_COOKIE as string]: GenerateToken(
              { role: ROLE.USER },
              -1,
              process.env.RESPONDENT_TOKEN_JWT_SECRET,
            ),
          },
        };
        mockRes = {
          ...mockRes,
          clearCookie: jest.fn().mockReturnThis(),
          cookie: jest.fn(),
        };

        sampleActiveSession = {
          form: sampleForm._id as Types.ObjectId,
          session_id: mockedReq?.cookies?.[
            process.env.RESPONDENT_COOKIE as string
          ] as string,
          access_id:
            mockedReq?.cookies?.[
              process.env.ACCESS_RESPONDENT_COOKIE as string
            ],
          expiredAt: new Date(generateExpirationDate({ hours: 1 })),
          respondentEmail: "test@example.com",
        } as never;
      });

      test("should clear Cookie if invalid session", async () => {
        (Form.findById as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(sampleForm),
          }),
        });
        (Formsession.findOne as jest.Mock).mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        });

        await FormsessionMiddleware.VerifyFormsession(
          mockedReq as never,
          mockRes as never,
          nextFun,
        );

        expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(RESPONSES.sessionNotFound());
      });

      test("shoud return status 500 if the renew token failed", async () => {
        mockFormReq({
          form: sampleForm as never,
          sampleSession: sampleActiveSession as never,
        });

        (Formsession.updateOne as jest.Mock).mockRejectedValue(
          new Error("Error Update AccessToken"),
        );

        await FormsessionMiddleware.VerifyFormsession(
          mockedReq as never,
          mockRes as never,
          nextFun,
        );

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          RESPONSES.tokenRenewalError(),
        );
      });
      test("should renew the token correctly if the accesstoken is expired and called next()", async () => {
        //mock valid session
        const sampleActiveSession: Partial<Formsessiondatatype> = {
          form: sampleForm._id as Types.ObjectId,
          session_id: mockedReq?.cookies?.[
            process.env.RESPONDENT_COOKIE as string
          ] as string,
          access_id:
            mockedReq?.cookies?.[
              process.env.ACCESS_RESPONDENT_COOKIE as string
            ],
          expiredAt: new Date(generateExpirationDate({ hours: 1 })),
          respondentEmail: "test@example.com",
        };

        mockFormReq({
          form: sampleForm as never,
          sampleSession: sampleActiveSession,
        });

        //Mock db req
        (Formsession.updateOne as jest.Mock).mockResolvedValue({});
        (Formsession.exists as jest.Mock).mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        });

        await FormsessionMiddleware.VerifyFormsession(
          mockedReq as never,
          mockRes as never,
          nextFun,
        );

        expect(mockedReq.formsession).toBeDefined();
        expect(mockedReq.formsession?.sub).toBeDefined();
        expect(mockedReq.formsession?.access_token).toBeDefined();
        expect(mockedReq.formsession?.access_payload).toBeDefined();
        expect(mockRes.cookie).toHaveBeenCalled();
        expect(nextFun).toHaveBeenCalled();
      });
    });
  });
  describe("Verify Respondent FormSessionData Method", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedReq = {
        ...mockedReq,
        query: {
          ty: GetPublicFormDataTyEnum.initial,
        },
      };
    });

    test("return status 400 if it formId is invalid", async () => {
      mockedReq = {
        ...mockedReq,
        params: {
          formId: "')'or'')(')",
        },
      };

      await FormsessionMiddleware.VerifyRespondentFormSessionData(
        mockedReq as never,
        mockRes as never,
        nextFun,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(RESPONSES.missingFormId());
    });

    describe("verify for public form getData (ty = 'initial') '", () => {
      test("isLoggedIn undefined call next()", async () => {
        await FormsessionMiddleware.VerifyRespondentFormSessionData(
          mockedReq as never,
          mockRes as never,
          nextFun,
        );
        expect(nextFun).toHaveBeenCalled();
        expect(nextFun).toHaveBeenCalledTimes(1);
      });
    });
  });
});
