import { Router } from "express";
import NotificationController from "../controller/notification.controller";
import UserMiddleware from "../middleware/User.middleware";

const router = Router();

// Get user notifications
router.get(
  "/",
  UserMiddleware.VerifyToken as never,
  NotificationController.GetNotifications
);

// Mark notification as read
router.put(
  "/:notificationId/read",
  UserMiddleware.VerifyToken as never,
  NotificationController.MarkAsRead
);

// Mark all notifications as read
router.put(
  "/mark-all-read",
  UserMiddleware.VerifyToken as never,
  NotificationController.MarkAllAsRead
);

// Delete notification
router.delete(
  "/:notificationId",
  UserMiddleware.VerifyToken as never,
  NotificationController.DeleteNotification
);

// Get notification settings
router.get(
  "/settings",
  UserMiddleware.VerifyToken as never,
  NotificationController.GetNotificationSettings
);

// Update notification settings
router.put(
  "/settings",
  UserMiddleware.VerifyToken as never,
  NotificationController.UpdateNotificationSettings
);

export default router;
