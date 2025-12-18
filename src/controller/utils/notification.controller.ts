import { Response } from "express";
import { RootFilterQuery, Types } from "mongoose";
import { generateOperationId } from "../../utilities/MongoErrorHandler";
import Notification from "../../model/Notification.model";
import { CustomRequest } from "../../types/customType";
import { ReturnCode } from "../../utilities/helper";

export interface NotificationData {
  userId: string;
  type: "response" | "reminder" | "alert" | "achievement";
  title: string;
  message: string;
  formId?: string;
  formTitle?: string;
  responseId?: string;
  respondentName?: string;
  respondentEmail?: string;
  priority: "low" | "medium" | "high";
  actionUrl?: string;
  metadata?: {
    responseCount?: number;
    score?: number;
    completionRate?: number;
  };
}

// SSE Client Manager
class SSEConnectionManager {
  private clients: Map<string, Response[]> = new Map();

  addClient(userId: string, res: Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)?.push(res);
    console.log(
      `[SSE] Client added for user ${userId}. Total: ${
        this.clients.get(userId)?.length
      }`
    );
  }

  removeClient(userId: string, res: Response) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const filteredClients = userClients.filter((client) => client !== res);
      if (filteredClients.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filteredClients);
      }
      console.log(`[SSE] Client removed for user ${userId}`);
    }
  }

  sendToUser(userId: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.length > 0) {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach((client) => {
        try {
          client.write(message);
          console.log(`[SSE] Notification sent to user ${userId}`);
        } catch (error) {
          console.error(`[SSE] Error sending to user ${userId}:`, error);
        }
      });
    }
  }

  sendToMultipleUsers(userIds: string[], data: any) {
    userIds.forEach((userId) => this.sendToUser(userId, data));
  }
}

// Global SSE manager instance
export const sseManager = new SSEConnectionManager();

export class NotificationController {
  // Create a new notification
  public static async CreateNotification(data: NotificationData) {
    const operationId = generateOperationId("create_notification");

    try {
      const notification = await Notification.create({
        ...data,
        userId: new Types.ObjectId(data.userId),
        formId: data.formId ? new Types.ObjectId(data.formId) : undefined,
        responseId: data.responseId
          ? new Types.ObjectId(data.responseId)
          : undefined,
        isRead: false,
        createdAt: new Date(),
      });

      return notification;
    } catch (error) {
      console.error(`[${operationId}] Create Notification Error:`, error);
      throw error;
    }
  }

  // Get notifications for a user
  public GetNotifications = async (req: CustomRequest, res: Response) => {
    const { userId } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    try {
      if (!userId) {
        res.status(400).json(ReturnCode(400, "User ID is required"));
        return;
      }

      const query: RootFilterQuery<NotificationData> = {
        userId: new Types.ObjectId(userId as string),
      };
      if (unreadOnly) {
        query.isRead = false;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const totalCount = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        userId: new Types.ObjectId(userId as string),
        isRead: false,
      });

      res.status(200).json({
        ...ReturnCode(200),
        data: {
          notifications,
          unreadCount,
          totalCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      console.error("Get Notifications Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to retrieve notifications"));
    }
  };

  // Mark notification as read
  public MarkAsRead = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const { notificationId } = req.params;
    const user = req.user;

    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        res.status(404).json(ReturnCode(404, "Notification not found"));
        return;
      }

      await Notification.findByIdAndUpdate(notificationId, {
        isRead: true,
        readAt: new Date(),
      });

      res.status(200).json(ReturnCode(200, "Notification marked as read"));
    } catch (error) {
      console.error("Mark As Read Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to mark notification as read"));
    }
  };

  // Mark all notifications as read
  public MarkAllAsRead = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const { userId } = req.body;
    const user = req.user;

    try {
      if (!userId || userId !== user?.id?.toString()) {
        res.status(403).json(ReturnCode(403, "Unauthorized"));
        return;
      }

      await Notification.updateMany(
        { userId: new Types.ObjectId(userId), isRead: false },
        { isRead: true, readAt: new Date() }
      );

      res.status(200).json(ReturnCode(200, "All notifications marked as read"));
    } catch (error) {
      console.error("Mark All As Read Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to mark all notifications as read"));
    }
  };

  // Delete notification
  public DeleteNotification = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const { notificationId } = req.params;
    const user = req.user;

    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        res.status(404).json(ReturnCode(404, "Notification not found"));
        return;
      }

      await Notification.findByIdAndDelete(notificationId);

      res.status(200).json(ReturnCode(200, "Notification deleted"));
    } catch (error) {
      console.error("Delete Notification Error:", error);
      res.status(500).json(ReturnCode(500, "Failed to delete notification"));
    }
  };

  // Get notification settings
  public GetNotificationSettings = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const user = req.user;

    try {
      const settings = {
        emailNotifications: true,
        pushNotifications: true,
        responseNotifications: true,
        reminderNotifications: true,
        achievementNotifications: true,
        emailFrequency: "immediate", // 'immediate', 'daily', 'weekly'
      };

      res.status(200).json({ ...ReturnCode(200), data: settings });
    } catch (error) {
      console.error("Get Notification Settings Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve notification settings"));
    }
  };

  // Update notification settings
  public UpdateNotificationSettings = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const { settings } = req.body;
    const user = req.user;

    try {
      // For now, we'll just return success
      res.status(200).json(ReturnCode(200, "Notification settings updated"));
    } catch (error) {
      console.error("Update Notification Settings Error:", error);
      res
        .status(500)
        .json(ReturnCode(500, "Failed to update notification settings"));
    }
  };

  // SSE endpoint for real-time notifications
  public SubscribeToNotifications = async (
    req: CustomRequest,
    res: Response
  ): Promise<void> => {
    const user = req.user;

    if (!user || !user.sub) {
      res.status(401).json(ReturnCode(401, "Unauthorized"));
      return;
    }

    const userId = user.sub.toString();

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx

    // Send initial connection message
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        message: "Connected to notification stream",
      })}\n\n`
    );

    // Add client to SSE manager
    sseManager.addClient(userId, res);

    // Handle client disconnect
    req.on("close", () => {
      sseManager.removeClient(userId, res);
      res.end();
    });

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    req.on("close", () => {
      clearInterval(heartbeatInterval);
    });
  };

  // Helper method to get all recipients (user, owners, editors) for notifications
  private static async getAllFormRecipients(form: any): Promise<string[]> {
    const recipients: string[] = [];

    // Add primary user/creator
    if (form.user) {
      const userId =
        typeof form.user === "object"
          ? form.user._id.toString()
          : form.user.toString();
      recipients.push(userId);
    }

    // Add additional owners
    if (form.owners && Array.isArray(form.owners)) {
      form.owners.forEach((owner: any) => {
        const ownerId =
          typeof owner === "object" ? owner._id.toString() : owner.toString();
        if (!recipients.includes(ownerId)) {
          recipients.push(ownerId);
        }
      });
    }

    // Add editors
    if (form.editors && Array.isArray(form.editors)) {
      form.editors.forEach((editor: any) => {
        const editorId =
          typeof editor === "object"
            ? editor._id.toString()
            : editor.toString();
        if (!recipients.includes(editorId)) {
          recipients.push(editorId);
        }
      });
    }

    return recipients;
  }

  // Create notification for new response
  public static async NotifyNewResponse(
    formId: string,
    responseId: string,
    respondentData: {
      name?: string;
      email?: string;
      score?: number;
    }
  ) {
    try {
      const Form = require("../../model/Form.model").default;
      const form = await Form.findById(formId).populate("user");

      if (!form) return;

      // Get all recipients (user, owners, editors)
      const recipients = await NotificationController.getAllFormRecipients(
        form
      );

      // Create notifications for all recipients
      const notifications = await Promise.all(
        recipients.map((recipientId) =>
          NotificationController.CreateNotification({
            userId: recipientId,
            type: "response",
            title: "New Form Response",
            message: `${
              respondentData.name || "Someone"
            } has submitted a response to your form "${form.title}"`,
            formId,
            formTitle: form.title,
            responseId,
            respondentName: respondentData.name,
            respondentEmail: respondentData.email,
            priority: "medium",
            actionUrl: `/forms/${formId}/responses/${responseId}`,
            metadata: {
              score: respondentData.score,
              responseCount: 1,
            },
          })
        )
      );

      // Send real-time notifications via SSE to all recipients
      if (notifications.length > 0) {
        const notificationData = {
          type: "new_response",
          notification: notifications[0], // Send first notification as reference
          timestamp: new Date().toISOString(),
        };
        sseManager.sendToMultipleUsers(recipients, notificationData);
      }

      return notifications;
    } catch (error) {
      console.error("Notify New Response Error:", error);
    }
  }

  // Create notification for form milestones
  public static async NotifyFormMilestone(
    formId: string,
    milestone: {
      type: "responses" | "views" | "completion";
      count: number;
      threshold: number;
    }
  ) {
    try {
      const Form = require("../../model/Form.model").default;
      const form = await Form.findById(formId).populate("user");

      if (!form) return;

      const milestoneMessages = {
        responses: `Your form "${form.title}" has reached ${milestone.count} responses!`,
        views: `Your form "${form.title}" has been viewed ${milestone.count} times!`,
        completion: `Your form "${form.title}" has achieved ${milestone.count}% completion rate!`,
      };

      // Get all recipients (user, owners, editors)
      const recipients = await NotificationController.getAllFormRecipients(
        form
      );

      // Create notifications for all recipients
      const notifications = await Promise.all(
        recipients.map((recipientId) =>
          NotificationController.CreateNotification({
            userId: recipientId,
            type: "achievement",
            title: "Form Milestone Achieved",
            message: milestoneMessages[milestone.type],
            formId,
            formTitle: form.title,
            priority: "low",
            actionUrl: `/forms/${formId}/analytics`,
            metadata: {
              responseCount:
                milestone.type === "responses" ? milestone.count : undefined,
              completionRate:
                milestone.type === "completion" ? milestone.count : undefined,
            },
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error("Notify Form Milestone Error:", error);
    }
  }

  // Create notification for form reminders
  public static async NotifyFormReminder(
    formId: string,
    reminderType:
      | "deadline"
      | "inactive"
      | "review"
      | "unscoredResponses"
      | "missingQuizConfig"
      | "incompleteForm"
  ) {
    try {
      const Form = require("../../model/Form.model").default;
      const form = await Form.findById(formId).populate("user");

      if (!form) return;

      const reminderMessages = {
        deadline: `Your form "${form.title}" is approaching its deadline. Make sure to review responses soon.`,
        inactive: `Your form "${form.title}" hasn't received responses in a while. Consider sharing it again.`,
        review: `Don't forget to review and score the responses for your form "${form.title}".`,
        unscoredResponses: `You have responses waiting to be scored for your form "${form.title}". Review and score them to provide feedback.`,
        missingQuizConfig: `Your quiz "${form.title}" is missing scores or solutions. Complete the configuration to enable auto-grading.`,
        incompleteForm: `Your form "${form.title}" setup is incomplete. Complete it to start collecting responses.`,
      };

      // Get all recipients (user, owners, editors)
      const recipients = await NotificationController.getAllFormRecipients(
        form
      );

      // For incomplete form reminders, check if notification was already sent
      if (reminderType === "incompleteForm") {
        const existingReminder = await Notification.findOne({
          formId: new Types.ObjectId(formId),
          type: "reminder",
          message: reminderMessages.incompleteForm,
        });

        if (existingReminder) {
          console.log(
            `[NotifyFormReminder] Incomplete form reminder already sent for form ${formId}`
          );
          return [];
        }
      }

      // Set priority based on reminder type
      let priority: "low" | "medium" | "high" = "medium";
      if (reminderType === "deadline" || reminderType === "incompleteForm") {
        priority = "high";
      } else if (
        reminderType === "unscoredResponses" ||
        reminderType === "missingQuizConfig"
      ) {
        priority = "medium";
      } else {
        priority = "low";
      }

      // Set action URL based on reminder type
      let actionUrl = `/forms/${formId}`;
      if (reminderType === "unscoredResponses" || reminderType === "review") {
        actionUrl = `/forms/${formId}/responses`;
      } else if (reminderType === "missingQuizConfig") {
        actionUrl = `/forms/${formId}/edit`;
      } else if (reminderType === "incompleteForm") {
        actionUrl = `/forms/${formId}/setup`;
      }

      // Create notifications for all recipients
      const notifications = await Promise.all(
        recipients.map((recipientId) =>
          NotificationController.CreateNotification({
            userId: recipientId,
            type: "reminder",
            title: "Form Reminder",
            message: reminderMessages[reminderType],
            formId,
            formTitle: form.title,
            priority,
            actionUrl,
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error("Notify Form Reminder Error:", error);
    }
  }
}
