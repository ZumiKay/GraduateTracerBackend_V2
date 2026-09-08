import { Response } from "express";
import { NotificationController, sseManager } from "../notification.controller";
import Notification from "../../../model/Notification.model";
import { CustomRequest } from "../../../types/customType";
import { Types } from "mongoose";
import { ROLE } from "../../../model/User.model";

jest.mock("../../../model/Notification.model");

describe("Notification Controller & SSE Unit Tests", () => {
  let mockReq: Partial<CustomRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockWrite: jest.Mock;
  let mockEnd: jest.Mock;
  let eventHandlers: { [key: string]: Function[] };

  const validUserId = new Types.ObjectId().toString();
  const otherUserId = new Types.ObjectId().toString();
  const validNotificationId = new Types.ObjectId().toString();
  const validFormId = new Types.ObjectId().toString();
  let controller: NotificationController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    controller = new NotificationController();
    eventHandlers = {};

    mockJson = jest.fn();
    mockSetHeader = jest.fn();
    mockWrite = jest.fn();
    mockEnd = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
      write: mockWrite,
      end: mockEnd,
    };

    mockReq = {
      on: jest.fn().mockImplementation((event: string, handler: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
        return mockReq;
      }),
    };
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe("SSEConnectionManager", () => {
    test("adds, sends, and removes clients accurately", () => {
      const client1 = { write: jest.fn() } as unknown as Response;
      const client2 = { write: jest.fn() } as unknown as Response;

      sseManager.addClient("test-user", client1);
      sseManager.addClient("test-user", client2);

      const payload = { type: "test", data: 123 };
      sseManager.sendToUser("test-user", payload);

      const expectedMsg = `data: ${JSON.stringify(payload)}\n\n`;
      expect(client1.write).toHaveBeenCalledWith(expectedMsg);
      expect(client2.write).toHaveBeenCalledWith(expectedMsg);

      // Remove one client
      sseManager.removeClient("test-user", client1);
      sseManager.sendToUser("test-user", { type: "second" });
      expect(client2.write).toHaveBeenCalledTimes(2);

      // Remove last client
      sseManager.removeClient("test-user", client2);
      sseManager.sendToUser("test-user", { type: "third" });
      expect(client2.write).toHaveBeenCalledTimes(2); // no further calls
    });

    test("handles client write exceptions gracefully without throwing", () => {
      const failingClient = {
        write: jest.fn().mockImplementation(() => {
          throw new Error("Socket disconnected");
        }),
      } as unknown as Response;

      sseManager.addClient("user-fail", failingClient);
      expect(() => {
        sseManager.sendToUser("user-fail", { message: "hello" });
      }).not.toThrow();

      sseManager.removeClient("user-fail", failingClient);
    });

    test("sends message to multiple users", () => {
      const clientA = { write: jest.fn() } as unknown as Response;
      const clientB = { write: jest.fn() } as unknown as Response;

      sseManager.addClient("user-A", clientA);
      sseManager.addClient("user-B", clientB);

      sseManager.sendToMultipleUsers(["user-A", "user-B"], { update: true });

      expect(clientA.write).toHaveBeenCalledWith(
        expect.stringContaining('"update":true'),
      );
      expect(clientB.write).toHaveBeenCalledWith(
        expect.stringContaining('"update":true'),
      );

      sseManager.removeClient("user-A", clientA);
      sseManager.removeClient("user-B", clientB);
    });
  });

  describe("SubscribeToNotifications (SSE Endpoint)", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq.user = undefined;

      await controller.SubscribeToNotifications(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("sets SSE headers, emits connected event, and manages connection lifecycle", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };

      await controller.SubscribeToNotifications(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockSetHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
      expect(mockSetHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(mockSetHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"'),
      );

      // Verify heartbeat runs on timer
      jest.advanceTimersByTime(30000);
      expect(mockWrite).toHaveBeenCalledWith(":heartbeat\n\n");

      // Verify client disconnect cleanup
      expect(eventHandlers["close"]).toBeDefined();
      eventHandlers["close"].forEach((h: Function) => h());
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe("CreateNotification", () => {
    test("creates notification record successfully", async () => {
      const mockCreated = {
        _id: new Types.ObjectId(),
        title: "New Alert",
        isRead: false,
      };
      (Notification.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await NotificationController.CreateNotification({
        userId: validUserId,
        type: "alert",
        title: "New Alert",
        message: "This is a test notification",
        priority: "medium",
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          type: "alert",
          title: "New Alert",
          isRead: false,
        }),
      );
      expect(result).toBe(mockCreated);
    });
  });

  describe("GetNotifications", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq.user = undefined;
      mockReq.query = {};

      await controller.GetNotifications(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 403 when querying another user's notifications without admin role (IDOR prevention)", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.query = { userId: otherUserId };

      await controller.GetNotifications(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("returns 200 with notifications, pagination, and counts", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.query = { page: "1", limit: "10", unreadOnly: "true" };

      const mockNotifications = [
        { _id: "notif-1", title: "Test 1", isRead: false },
      ];

      (Notification.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockNotifications),
            }),
          }),
        }),
      });
      (Notification.countDocuments as jest.Mock)
        .mockResolvedValueOnce(1) // total count for query
        .mockResolvedValueOnce(1); // unread count

      await controller.GetNotifications(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notifications: mockNotifications,
            unreadCount: 1,
            totalCount: 1,
            currentPage: 1,
            totalPages: 1,
          }),
        }),
      );
    });
  });

  describe("MarkAsRead", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { notificationId: validNotificationId };

      await controller.MarkAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 404 if notification not found", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue(null);

      await controller.MarkAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 403 when trying to mark another user's notification as read (IDOR prevention)", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue({
        _id: validNotificationId,
        userId: new Types.ObjectId(otherUserId),
      });

      await controller.MarkAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(Notification.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("marks notification as read successfully", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue({
        _id: validNotificationId,
        userId: new Types.ObjectId(validUserId),
      });
      (Notification.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await controller.MarkAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
        validNotificationId,
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
    });
  });

  describe("MarkAllAsRead", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq.user = undefined;
      mockReq.body = {};

      await controller.MarkAllAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 403 if target userId in body does not match authenticated user (IDOR prevention)", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.body = { userId: otherUserId };

      await controller.MarkAllAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    test("marks all notifications as read for current user", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.body = { userId: validUserId };

      (Notification.updateMany as jest.Mock).mockResolvedValue({
        modifiedCount: 3,
      });

      await controller.MarkAllAsRead(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { userId: new Types.ObjectId(validUserId), isRead: false },
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
    });
  });

  describe("DeleteNotification", () => {
    test("returns 401 if unauthenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { notificationId: validNotificationId };

      await controller.DeleteNotification(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    test("returns 404 if notification not found", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue(null);

      await controller.DeleteNotification(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    test("returns 403 when trying to delete another user's notification (IDOR prevention)", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue({
        _id: validNotificationId,
        userId: new Types.ObjectId(otherUserId),
      });

      await controller.DeleteNotification(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(Notification.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("deletes notification successfully when user is owner", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.params = { notificationId: validNotificationId };

      (Notification.findById as jest.Mock).mockResolvedValue({
        _id: validNotificationId,
        userId: new Types.ObjectId(validUserId),
      });
      (Notification.findByIdAndDelete as jest.Mock).mockResolvedValue({});

      await controller.DeleteNotification(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(Notification.findByIdAndDelete).toHaveBeenCalledWith(
        validNotificationId,
      );
    });
  });

  describe("Notification Settings", () => {
    test("returns 200 with notification settings", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };

      await controller.GetNotificationSettings(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailNotifications: true,
            pushNotifications: true,
          }),
        }),
      );
    });

    test("updates notification settings and returns 200", async () => {
      mockReq.user = { sub: validUserId, role: ROLE.USER };
      mockReq.body = { settings: { emailNotifications: false } };

      await controller.UpdateNotificationSettings(
        mockReq as CustomRequest,
        mockRes as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
    });
  });

  describe("Form Event Dispatchers", () => {
    const FormModel = require("../../../model/Form.model").default;
    jest.mock("../../../model/Form.model");

    test("NotifyNewResponse dispatches notifications to form creator, co-owners, and editors", async () => {
      const creatorId = new Types.ObjectId().toString();
      const coOwnerId = new Types.ObjectId().toString();
      const editorId = new Types.ObjectId().toString();

      const mockForm = {
        _id: validFormId,
        title: "Student Survey",
        user: new Types.ObjectId(creatorId),
        owners: [{ _id: new Types.ObjectId(coOwnerId) }],
        editors: [{ _id: new Types.ObjectId(editorId) }],
      };

      (FormModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockForm),
      });
      (Notification.create as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(),
        title: "New Form Response",
      });

      const responseObjectId = new Types.ObjectId().toString();
      const notifications = await NotificationController.NotifyNewResponse(
        validFormId,
        responseObjectId,
        { name: "Jane Doe", email: "jane@test.com", score: 90 },
      );

      expect(notifications).toBeDefined();
      expect(Notification.create).toHaveBeenCalledTimes(3);
    });

    test("NotifyFormMilestone creates milestone notifications", async () => {
      const creatorId = new Types.ObjectId().toString();
      const mockForm = {
        _id: validFormId,
        title: "Graduate Survey",
        user: new Types.ObjectId(creatorId),
        owners: [],
        editors: [],
      };

      (FormModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockForm),
      });
      (Notification.create as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(),
      });

      const notifications = await NotificationController.NotifyFormMilestone(
        validFormId,
        { type: "responses", count: 100, threshold: 100 },
      );

      expect(notifications).toBeDefined();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "achievement",
          title: "Form Milestone Achieved",
        }),
      );
    });

    test("NotifyFormReminder suppresses duplicate reminders for incomplete forms", async () => {
      const creatorId = new Types.ObjectId().toString();
      const mockForm = {
        _id: validFormId,
        title: "Draft Survey",
        user: new Types.ObjectId(creatorId),
        owners: [],
        editors: [],
      };

      (FormModel.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockForm),
      });
      (Notification.findOne as jest.Mock).mockResolvedValue({
        _id: "existing-reminder",
      });

      const result = await NotificationController.NotifyFormReminder(
        validFormId,
        "incompleteForm",
      );

      expect(result).toEqual([]);
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });
});
