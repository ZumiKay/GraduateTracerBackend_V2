import { Response } from "express";
import { GetFilterForm, GetFilterTypeEnum } from "../form.query.controller";
import { CustomRequest } from "../../../types/customType";
import Form from "../../../model/Form.model";
import { Types } from "mongoose";

import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Form.model");
jest.mock("../../../model/Content.model");
jest.mock("../../../model/User.model");
jest.mock("../../../model/Response.model");

describe("GetFilterForm Controller", () => {
  const userId = new Types.ObjectId();
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: {
        sub: userId.toString(),
        role: ROLE.ADMIN,
      },
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test("returns 401 if user is not authenticated", async () => {
    mockReq.user = undefined;

    await GetFilterForm(mockReq as CustomRequest, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unauthenticated" }),
    );
  });
});
