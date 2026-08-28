"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const form_query_controller_1 = require("../form.query.controller");
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../model/Form.model");
jest.mock("../../../model/Content.model");
jest.mock("../../../model/User.model");
jest.mock("../../../model/Response.model");
describe("GetFilterForm Controller", () => {
    const userId = new mongoose_1.Types.ObjectId();
    let mockReq;
    let mockRes;
    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            user: {
                sub: userId.toString(),
                role: User_model_1.ROLE.ADMIN,
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
        await (0, form_query_controller_1.GetFilterForm)(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthenticated" }));
    });
});
