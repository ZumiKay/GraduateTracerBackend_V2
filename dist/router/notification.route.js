"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const notification_controller_1 = require("../controller/utils/notification.controller");
const router = (0, express_1.Router)();
const notificationController = new notification_controller_1.NotificationController();
// SSE endpoint for real-time notifications (must be before other routes)
router.get("/stream", User_middleware_1.default.VerifyToken, notificationController.SubscribeToNotifications);
// Get user notifications
router.get("/", User_middleware_1.default.VerifyToken, notificationController.GetNotifications);
// Mark notification as read
router.put("/:notificationId/read", User_middleware_1.default.VerifyToken, notificationController.MarkAsRead);
// Mark all notifications as read
router.put("/mark-all-read", User_middleware_1.default.VerifyToken, notificationController.MarkAllAsRead);
// Delete notification
router.delete("/:notificationId", User_middleware_1.default.VerifyToken, notificationController.DeleteNotification);
// Get notification settings
router.get("/settings", User_middleware_1.default.VerifyToken, notificationController.GetNotificationSettings);
// Update notification settings
router.put("/settings", User_middleware_1.default.VerifyToken, notificationController.UpdateNotificationSettings);
exports.default = router;
