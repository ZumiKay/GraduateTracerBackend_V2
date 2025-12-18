import { Router } from "express";
import UserMiddleware from "../middleware/User.middleware";
import { NotificationController } from "../controller/utils/notification.controller";

const router = Router();
const notificationController = new NotificationController();

// SSE endpoint for real-time notifications (must be before other routes)
router.get(
  "/stream",
  UserMiddleware.VerifyToken as never,
  notificationController.SubscribeToNotifications
);

// Get user notifications
router.get(
  "/",
  UserMiddleware.VerifyToken as never,
  notificationController.GetNotifications
);

// Mark notification as read
router.put(
  "/:notificationId/read",
  UserMiddleware.VerifyToken as never,
  notificationController.MarkAsRead
);

// Mark all notifications as read
router.put(
  "/mark-all-read",
  UserMiddleware.VerifyToken as never,
  notificationController.MarkAllAsRead
);

// Delete notification
router.delete(
  "/:notificationId",
  UserMiddleware.VerifyToken as never,
  notificationController.DeleteNotification
);

// Get notification settings
router.get(
  "/settings",
  UserMiddleware.VerifyToken as never,
  notificationController.GetNotificationSettings
);

// Update notification settings
router.put(
  "/settings",
  UserMiddleware.VerifyToken as never,
  notificationController.UpdateNotificationSettings
);

export default router;
