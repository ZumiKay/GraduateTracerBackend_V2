import { Response } from "express";
import {
  CreateForm,
  EditForm,
  DeleteForm,
  PageHandler,
} from "../form.controller";
import Form from "../../../model/Form.model";
import Content from "../../../model/Content.model";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Form.model");
jest.mock("../../../model/Content.model");

describe("Form Controller Unit Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const primaryOwnerId = new Types.ObjectId().toString();
  const editorId = new Types.ObjectId().toString();
  const formId = new Types.ObjectId().toString();

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

      await CreateForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("creates form and returns 201 on success", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { title: "Test Form", totalpage: 1 },
      };

      const createdId = new Types.ObjectId();
      (Form.create as jest.Mock).mockResolvedValue({ _id: createdId });

      await CreateForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          message: "Form Created",
          data: expect.objectContaining({ _id: createdId, title: "Test Form" }),
        }),
      );
    });
  });

  describe("EditForm", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = {
        user: undefined,
        body: { data: { _id: formId, title: "Updated" } },
      };

      await EditForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 404 if form not found", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { data: { _id: formId, title: "Updated" } },
      };

      (Form.findById as jest.Mock).mockResolvedValue(null);

      await EditForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 403 if user lacks access to form", async () => {
      const unrelatedUserId = new Types.ObjectId().toString();
      mockReq = {
        user: { sub: unrelatedUserId, role: ROLE.USER },
        body: { data: { _id: formId, title: "Updated" } },
      };

      const mockForm = {
        _id: formId,
        user: new Types.ObjectId(primaryOwnerId),
        owners: [],
        editors: [],
      };
      (Form.findById as jest.Mock).mockResolvedValue(mockForm);

      await EditForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("updates form and returns 200 on success", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
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
        user: new Types.ObjectId(primaryOwnerId),
        owners: [],
        editors: [],
      };
      (Form.findById as jest.Mock).mockResolvedValue(mockForm);
      (Form.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await EditForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ code: 200, message: "Form Updated" }),
      );
    });
  });

  describe("DeleteForm (Privilege Escalation Prevention)", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined, body: { ids: [formId] } };

      await DeleteForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 400 if no IDs provided", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { ids: [] },
      };

      await DeleteForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("returns 403 when an editor attempts to delete the form (privilege escalation check)", async () => {
      mockReq = {
        user: { sub: editorId, role: ROLE.USER },
        body: { ids: [formId] },
      };

      const mockForm = {
        _id: formId,
        user: new Types.ObjectId(primaryOwnerId), // Primary owner is different
        editors: [{ _id: new Types.ObjectId(editorId) }], // Current user is only editor
        owners: [],
      };
      (Form.find as jest.Mock).mockResolvedValue([mockForm]);

      await DeleteForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access denied: only primary owner can delete forms",
        }),
      );
      expect(Form.deleteMany).not.toHaveBeenCalled();
    });

    test("allows primary owner to delete their form", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { ids: [formId] },
      };

      const mockForm = {
        _id: formId,
        user: new Types.ObjectId(primaryOwnerId),
        owners: [],
        editors: [],
      };
      (Form.find as jest.Mock).mockResolvedValue([mockForm]);
      (Form.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      await DeleteForm(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(Form.deleteMany).toHaveBeenCalled();
    });
  });

  describe("PageHandler (Scoping & Cross-form Data Integrity)", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq = { user: undefined, body: { ty: "add", formId } };

      await PageHandler(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 400 if missing operation type", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { formId },
      };

      await PageHandler(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    test("adds page by incrementing totalpage", async () => {
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { ty: "add", formId },
      };

      const mockForm = {
        _id: formId,
        user: new Types.ObjectId(primaryOwnerId),
        totalpage: 1,
      };
      (Form.findById as jest.Mock).mockResolvedValue(mockForm);
      (Form.updateOne as jest.Mock).mockResolvedValue({});

      await PageHandler(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(Form.updateOne).toHaveBeenCalledWith(
        { _id: formId },
        { $inc: { totalpage: 1 } },
      );
    });

    test("deletes page scoped strictly to the target formId and shifts subsequent pages", async () => {
      const deletePageNum = 2;
      mockReq = {
        user: { sub: primaryOwnerId, role: ROLE.USER },
        body: { ty: "delete", formId, deletepage: deletePageNum },
      };

      const mockForm = {
        _id: formId,
        user: new Types.ObjectId(primaryOwnerId),
        totalpage: 3,
      };
      const mockQuestions = [
        { _id: new Types.ObjectId("65a000000000000000000001") },
        { _id: new Types.ObjectId("65a000000000000000000002") },
      ];

      (Form.findById as jest.Mock).mockResolvedValue(mockForm);
      (Content.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockQuestions),
        }),
      });
      (Form.updateOne as jest.Mock).mockResolvedValue({});
      (Content.deleteMany as jest.Mock).mockResolvedValue({});
      (Content.updateMany as jest.Mock).mockResolvedValue({});

      await PageHandler(mockReq as CustomRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);

      // Verify Content.find was scoped to formId and page
      expect(Content.find).toHaveBeenCalledWith({
        formId: new Types.ObjectId(formId),
        page: deletePageNum,
      });

      // Verify Content.deleteMany was scoped to formId and page
      expect(Content.deleteMany).toHaveBeenCalledWith({
        formId: new Types.ObjectId(formId),
        page: deletePageNum,
      });

      // Verify remaining pages > 2 are shifted down
      expect(Content.updateMany).toHaveBeenCalledWith(
        {
          formId: new Types.ObjectId(formId),
          page: { $gt: deletePageNum },
        },
        {
          $inc: { page: -1 },
        },
      );
    });
  });
});
