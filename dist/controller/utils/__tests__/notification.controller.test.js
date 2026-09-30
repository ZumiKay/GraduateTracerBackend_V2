"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const notification_controller_1 = require("../notification.controller");
const Notification_model_1 = __importDefault(require("../../../model/Notification.model"));
const mongoose_1 = require("mongoose");
const User_model_1 = require("../../../model/User.model");
jest.mock("../../../model/Notification.model");
describe("Notification Controller & SSE Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockSetHeader;
    let mockWrite;
    let mockEnd;
    let eventHandlers;
    const validUserId = new mongoose_1.Types.ObjectId().toString();
    const otherUserId = new mongoose_1.Types.ObjectId().toString();
    const validNotificationId = new mongoose_1.Types.ObjectId().toString();
    const validFormId = new mongoose_1.Types.ObjectId().toString();
    let controller;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        controller = new notification_controller_1.NotificationController();
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
            on: jest.fn().mockImplementation((event, handler) => {
                if (!eventHandlers[event])
                    eventHandlers[event] = [];
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
            const client1 = { write: jest.fn() };
            const client2 = { write: jest.fn() };
            notification_controller_1.sseManager.addClient("test-user", client1);
            notification_controller_1.sseManager.addClient("test-user", client2);
            const payload = { type: "test", data: 123 };
            notification_controller_1.sseManager.sendToUser("test-user", payload);
            const expectedMsg = `data: ${JSON.stringify(payload)}\n\n`;
            expect(client1.write).toHaveBeenCalledWith(expectedMsg);
            expect(client2.write).toHaveBeenCalledWith(expectedMsg);
            // Remove one client
            notification_controller_1.sseManager.removeClient("test-user", client1);
            notification_controller_1.sseManager.sendToUser("test-user", { type: "second" });
            expect(client2.write).toHaveBeenCalledTimes(2);
            // Remove last client
            notification_controller_1.sseManager.removeClient("test-user", client2);
            notification_controller_1.sseManager.sendToUser("test-user", { type: "third" });
            expect(client2.write).toHaveBeenCalledTimes(2); // no further calls
        });
        test("handles client write exceptions gracefully without throwing", () => {
            const failingClient = {
                write: jest.fn().mockImplementation(() => {
                    throw new Error("Socket disconnected");
                }),
            };
            notification_controller_1.sseManager.addClient("user-fail", failingClient);
            expect(() => {
                notification_controller_1.sseManager.sendToUser("user-fail", { message: "hello" });
            }).not.toThrow();
            notification_controller_1.sseManager.removeClient("user-fail", failingClient);
        });
        test("sends message to multiple users", () => {
            const clientA = { write: jest.fn() };
            const clientB = { write: jest.fn() };
            notification_controller_1.sseManager.addClient("user-A", clientA);
            notification_controller_1.sseManager.addClient("user-B", clientB);
            notification_controller_1.sseManager.sendToMultipleUsers(["user-A", "user-B"], { update: true });
            expect(clientA.write).toHaveBeenCalledWith(expect.stringContaining('"update":true'));
            expect(clientB.write).toHaveBeenCalledWith(expect.stringContaining('"update":true'));
            notification_controller_1.sseManager.removeClient("user-A", clientA);
            notification_controller_1.sseManager.removeClient("user-B", clientB);
        });
    });
    describe("SubscribeToNotifications (SSE Endpoint)", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq.user = undefined;
            await controller.SubscribeToNotifications(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("sets SSE headers, emits connected event, and manages connection lifecycle", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            await controller.SubscribeToNotifications(mockReq, mockRes);
            expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
            expect(mockSetHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
            expect(mockSetHeader).toHaveBeenCalledWith("Connection", "keep-alive");
            expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('"type":"connected"'));
            // Verify heartbeat runs on timer
            jest.advanceTimersByTime(30000);
            expect(mockWrite).toHaveBeenCalledWith(":heartbeat\n\n");
            // Verify client disconnect cleanup
            expect(eventHandlers["close"]).toBeDefined();
            eventHandlers["close"].forEach((h) => h());
            expect(mockEnd).toHaveBeenCalled();
        });
    });
    describe("CreateNotification", () => {
        test("creates notification record successfully", async () => {
            const mockCreated = {
                _id: new mongoose_1.Types.ObjectId(),
                title: "New Alert",
                isRead: false,
            };
            Notification_model_1.default.create.mockResolvedValue(mockCreated);
            const result = await notification_controller_1.NotificationController.CreateNotification({
                userId: validUserId,
                type: "alert",
                title: "New Alert",
                message: "This is a test notification",
                priority: "medium",
            });
            expect(Notification_model_1.default.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: expect.any(mongoose_1.Types.ObjectId),
                type: "alert",
                title: "New Alert",
                isRead: false,
            }));
            expect(result).toBe(mockCreated);
        });
    });
    describe("GetNotifications", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq.user = undefined;
            mockReq.query = {};
            await controller.GetNotifications(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 403 when querying another user's notifications without admin role (IDOR prevention)", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.query = { userId: otherUserId };
            await controller.GetNotifications(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("returns 200 with notifications, pagination, and counts", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.query = { page: "1", limit: "10", unreadOnly: "true" };
            const mockNotifications = [
                { _id: "notif-1", title: "Test 1", isRead: false },
            ];
            Notification_model_1.default.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    skip: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(mockNotifications),
                        }),
                    }),
                }),
            });
            Notification_model_1.default.countDocuments
                .mockResolvedValueOnce(1) // total count for query
                .mockResolvedValueOnce(1); // unread count
            await controller.GetNotifications(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    notifications: mockNotifications,
                    unreadCount: 1,
                    totalCount: 1,
                    currentPage: 1,
                    totalPages: 1,
                }),
            }));
        });
    });
    describe("MarkAsRead", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq.user = undefined;
            mockReq.params = { notificationId: validNotificationId };
            await controller.MarkAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 404 if notification not found", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue(null);
            await controller.MarkAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 403 when trying to mark another user's notification as read (IDOR prevention)", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue({
                _id: validNotificationId,
                userId: new mongoose_1.Types.ObjectId(otherUserId),
            });
            await controller.MarkAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(Notification_model_1.default.findByIdAndUpdate).not.toHaveBeenCalled();
        });
        test("marks notification as read successfully", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue({
                _id: validNotificationId,
                userId: new mongoose_1.Types.ObjectId(validUserId),
            });
            Notification_model_1.default.findByIdAndUpdate.mockResolvedValue({});
            await controller.MarkAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(Notification_model_1.default.findByIdAndUpdate).toHaveBeenCalledWith(validNotificationId, expect.objectContaining({ isRead: true, readAt: expect.any(Date) }));
        });
    });
    describe("MarkAllAsRead", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq.user = undefined;
            mockReq.body = {};
            await controller.MarkAllAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 403 if target userId in body does not match authenticated user (IDOR prevention)", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.body = { userId: otherUserId };
            await controller.MarkAllAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });
        test("marks all notifications as read for current user", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.body = { userId: validUserId };
            Notification_model_1.default.updateMany.mockResolvedValue({
                modifiedCount: 3,
            });
            await controller.MarkAllAsRead(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(Notification_model_1.default.updateMany).toHaveBeenCalledWith({ userId: new mongoose_1.Types.ObjectId(validUserId), isRead: false }, expect.objectContaining({ isRead: true, readAt: expect.any(Date) }));
        });
    });
    describe("DeleteNotification", () => {
        test("returns 401 if unauthenticated", async () => {
            mockReq.user = undefined;
            mockReq.params = { notificationId: validNotificationId };
            await controller.DeleteNotification(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(401);
        });
        test("returns 404 if notification not found", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue(null);
            await controller.DeleteNotification(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
        });
        test("returns 403 when trying to delete another user's notification (IDOR prevention)", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue({
                _id: validNotificationId,
                userId: new mongoose_1.Types.ObjectId(otherUserId),
            });
            await controller.DeleteNotification(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(403);
            expect(Notification_model_1.default.findByIdAndDelete).not.toHaveBeenCalled();
        });
        test("deletes notification successfully when user is owner", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.params = { notificationId: validNotificationId };
            Notification_model_1.default.findById.mockResolvedValue({
                _id: validNotificationId,
                userId: new mongoose_1.Types.ObjectId(validUserId),
            });
            Notification_model_1.default.findByIdAndDelete.mockResolvedValue({});
            await controller.DeleteNotification(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(Notification_model_1.default.findByIdAndDelete).toHaveBeenCalledWith(validNotificationId);
        });
    });
    describe("Notification Settings", () => {
        test("returns 200 with notification settings", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            await controller.GetNotificationSettings(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    emailNotifications: true,
                    pushNotifications: true,
                }),
            }));
        });
        test("updates notification settings and returns 200", async () => {
            mockReq.user = { sub: validUserId, role: User_model_1.ROLE.USER };
            mockReq.body = { settings: { emailNotifications: false } };
            await controller.UpdateNotificationSettings(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(200);
        });
    });
    describe("Form Event Dispatchers", () => {
        const FormModel = require("../../../model/Form.model").default;
        jest.mock("../../../model/Form.model");
        test("NotifyNewResponse dispatches notifications to form creator, co-owners, and editors", async () => {
            const creatorId = new mongoose_1.Types.ObjectId().toString();
            const coOwnerId = new mongoose_1.Types.ObjectId().toString();
            const editorId = new mongoose_1.Types.ObjectId().toString();
            const mockForm = {
                _id: validFormId,
                title: "Student Survey",
                user: new mongoose_1.Types.ObjectId(creatorId),
                owners: [{ _id: new mongoose_1.Types.ObjectId(coOwnerId) }],
                editors: [{ _id: new mongoose_1.Types.ObjectId(editorId) }],
            };
            FormModel.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockForm),
            });
            Notification_model_1.default.create.mockResolvedValue({
                _id: new mongoose_1.Types.ObjectId(),
                title: "New Form Response",
            });
            const responseObjectId = new mongoose_1.Types.ObjectId().toString();
            const notifications = await notification_controller_1.NotificationController.NotifyNewResponse(validFormId, responseObjectId, { name: "Jane Doe", email: "jane@test.com", score: 90 });
            expect(notifications).toBeDefined();
            expect(Notification_model_1.default.create).toHaveBeenCalledTimes(3);
        });
        test("NotifyFormMilestone creates milestone notifications", async () => {
            const creatorId = new mongoose_1.Types.ObjectId().toString();
            const mockForm = {
                _id: validFormId,
                title: "Graduate Survey",
                user: new mongoose_1.Types.ObjectId(creatorId),
                owners: [],
                editors: [],
            };
            FormModel.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockForm),
            });
            Notification_model_1.default.create.mockResolvedValue({
                _id: new mongoose_1.Types.ObjectId(),
            });
            const notifications = await notification_controller_1.NotificationController.NotifyFormMilestone(validFormId, { type: "responses", count: 100, threshold: 100 });
            expect(notifications).toBeDefined();
            expect(Notification_model_1.default.create).toHaveBeenCalledWith(expect.objectContaining({
                type: "achievement",
                title: "Form Milestone Achieved",
            }));
        });
        test("NotifyFormReminder suppresses duplicate reminders for incomplete forms", async () => {
            const creatorId = new mongoose_1.Types.ObjectId().toString();
            const mockForm = {
                _id: validFormId,
                title: "Draft Survey",
                user: new mongoose_1.Types.ObjectId(creatorId),
                owners: [],
                editors: [],
            };
            FormModel.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockForm),
            });
            Notification_model_1.default.findOne.mockResolvedValue({
                _id: "existing-reminder",
            });
            const result = await notification_controller_1.NotificationController.NotifyFormReminder(validFormId, "incompleteForm");
            expect(result).toEqual([]);
            expect(Notification_model_1.default.create).not.toHaveBeenCalled();
        });
    });
});
