"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = __importDefault(require("../controller/notification.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const router = (0, express_1.Router)();
// Get user notifications
router.get("/", User_middleware_1.default.VerifyToken, notification_controller_1.default.GetNotifications);
// Mark notification as read
router.put("/:notificationId/read", User_middleware_1.default.VerifyToken, notification_controller_1.default.MarkAsRead);
// Mark all notifications as read
router.put("/mark-all-read", User_middleware_1.default.VerifyToken, notification_controller_1.default.MarkAllAsRead);
// Delete notification
router.delete("/:notificationId", User_middleware_1.default.VerifyToken, notification_controller_1.default.DeleteNotification);
// Get notification settings
router.get("/settings", User_middleware_1.default.VerifyToken, notification_controller_1.default.GetNotificationSettings);
// Update notification settings
router.put("/settings", User_middleware_1.default.VerifyToken, notification_controller_1.default.UpdateNotificationSettings);
exports.default = router;
