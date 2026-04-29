"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = exports.sseManager = void 0;
const mongoose_1 = require("mongoose");
const MongoErrorHandler_1 = require("../../utilities/MongoErrorHandler");
const Notification_model_1 = __importDefault(require("../../model/Notification.model"));
const helper_1 = require("../../utilities/helper");
// SSE Client Manager
class SSEConnectionManager {
    constructor() {
        this.clients = new Map();
    }
    addClient(userId, res) {
        var _a, _b;
        if (!this.clients.has(userId)) {
            this.clients.set(userId, []);
        }
        (_a = this.clients.get(userId)) === null || _a === void 0 ? void 0 : _a.push(res);
        console.log(`[SSE] Client added for user ${userId}. Total: ${(_b = this.clients.get(userId)) === null || _b === void 0 ? void 0 : _b.length}`);
    }
    removeClient(userId, res) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            const filteredClients = userClients.filter((client) => client !== res);
            if (filteredClients.length === 0) {
                this.clients.delete(userId);
            }
            else {
                this.clients.set(userId, filteredClients);
            }
            console.log(`[SSE] Client removed for user ${userId}`);
        }
    }
    sendToUser(userId, data) {
        const userClients = this.clients.get(userId);
        if (userClients && userClients.length > 0) {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            userClients.forEach((client) => {
                try {
                    client.write(message);
                    console.log(`[SSE] Notification sent to user ${userId}`);
                }
                catch (error) {
                    console.error(`[SSE] Error sending to user ${userId}:`, error);
                }
            });
        }
    }
    sendToMultipleUsers(userIds, data) {
        userIds.forEach((userId) => this.sendToUser(userId, data));
    }
}
// Global SSE manager instance
exports.sseManager = new SSEConnectionManager();
class NotificationController {
    constructor() {
        // Get notifications for a user
        this.GetNotifications = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.query;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const unreadOnly = req.query.unreadOnly === "true";
            try {
                if (!userId) {
                    res.status(400).json((0, helper_1.ReturnCode)(400, "User ID is required"));
                    return;
                }
                const query = {
                    userId: new mongoose_1.Types.ObjectId(userId),
                };
                if (unreadOnly) {
                    query.isRead = false;
                }
                const notifications = yield Notification_model_1.default.find(query)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .lean();
                const totalCount = yield Notification_model_1.default.countDocuments(query);
                const unreadCount = yield Notification_model_1.default.countDocuments({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    isRead: false,
                });
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                        notifications,
                        unreadCount,
                        totalCount,
                        currentPage: page,
                        totalPages: Math.ceil(totalCount / limit),
                    } }));
            }
            catch (error) {
                console.error("Get Notifications Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to retrieve notifications"));
            }
        });
        // Mark notification as read
        this.MarkAsRead = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { notificationId } = req.params;
            const user = req.user;
            try {
                const notification = yield Notification_model_1.default.findById(notificationId);
                if (!notification) {
                    res.status(404).json((0, helper_1.ReturnCode)(404, "Notification not found"));
                    return;
                }
                yield Notification_model_1.default.findByIdAndUpdate(notificationId, {
                    isRead: true,
                    readAt: new Date(),
                });
                res.status(200).json((0, helper_1.ReturnCode)(200, "Notification marked as read"));
            }
            catch (error) {
                console.error("Mark As Read Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to mark notification as read"));
            }
        });
        // Mark all notifications as read
        this.MarkAllAsRead = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { userId } = req.body;
            const user = req.user;
            try {
                if (!userId || userId !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
                    return;
                }
                yield Notification_model_1.default.updateMany({ userId: new mongoose_1.Types.ObjectId(userId), isRead: false }, { isRead: true, readAt: new Date() });
                res.status(200).json((0, helper_1.ReturnCode)(200, "All notifications marked as read"));
            }
            catch (error) {
                console.error("Mark All As Read Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to mark all notifications as read"));
            }
        });
        // Delete notification
        this.DeleteNotification = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { notificationId } = req.params;
            const user = req.user;
            try {
                const notification = yield Notification_model_1.default.findById(notificationId);
                if (!notification) {
                    res.status(404).json((0, helper_1.ReturnCode)(404, "Notification not found"));
                    return;
                }
                yield Notification_model_1.default.findByIdAndDelete(notificationId);
                res.status(200).json((0, helper_1.ReturnCode)(200, "Notification deleted"));
            }
            catch (error) {
                console.error("Delete Notification Error:", error);
                res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete notification"));
            }
        });
        // Get notification settings
        this.GetNotificationSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
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
                res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: settings }));
            }
            catch (error) {
                console.error("Get Notification Settings Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to retrieve notification settings"));
            }
        });
        // Update notification settings
        this.UpdateNotificationSettings = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { settings } = req.body;
            const user = req.user;
            try {
                // For now, we'll just return success
                res.status(200).json((0, helper_1.ReturnCode)(200, "Notification settings updated"));
            }
            catch (error) {
                console.error("Update Notification Settings Error:", error);
                res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to update notification settings"));
            }
        });
        // SSE endpoint for real-time notifications
        this.SubscribeToNotifications = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            if (!user || !user.sub) {
                res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
                return;
            }
            const userId = user.sub.toString();
            // Set headers for SSE
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx
            // Send initial connection message
            res.write(`data: ${JSON.stringify({
                type: "connected",
                message: "Connected to notification stream",
            })}\n\n`);
            // Add client to SSE manager
            exports.sseManager.addClient(userId, res);
            // Handle client disconnect
            req.on("close", () => {
                exports.sseManager.removeClient(userId, res);
                res.end();
            });
            // Send heartbeat every 30 seconds to keep connection alive
            const heartbeatInterval = setInterval(() => {
                try {
                    res.write(`:heartbeat\n\n`);
                }
                catch (error) {
                    clearInterval(heartbeatInterval);
                }
            }, 30000);
            req.on("close", () => {
                clearInterval(heartbeatInterval);
            });
        });
    }
    // Create a new notification
    static CreateNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const operationId = (0, MongoErrorHandler_1.generateOperationId)("create_notification");
            try {
                const notification = yield Notification_model_1.default.create(Object.assign(Object.assign({}, data), { userId: new mongoose_1.Types.ObjectId(data.userId), formId: data.formId ? new mongoose_1.Types.ObjectId(data.formId) : undefined, responseId: data.responseId
                        ? new mongoose_1.Types.ObjectId(data.responseId)
                        : undefined, isRead: false, createdAt: new Date() }));
                return notification;
            }
            catch (error) {
                console.error(`[${operationId}] Create Notification Error:`, error);
                throw error;
            }
        });
    }
    // Helper method to get all recipients (user, owners, editors) for notifications
    static getAllFormRecipients(form) {
        return __awaiter(this, void 0, void 0, function* () {
            const recipients = [];
            // Add primary user/creator
            if (form.user) {
                const userId = typeof form.user === "object"
                    ? form.user._id.toString()
                    : form.user.toString();
                recipients.push(userId);
            }
            // Add additional owners
            if (form.owners && Array.isArray(form.owners)) {
                form.owners.forEach((owner) => {
                    const ownerId = typeof owner === "object" ? owner._id.toString() : owner.toString();
                    if (!recipients.includes(ownerId)) {
                        recipients.push(ownerId);
                    }
                });
            }
            // Add editors
            if (form.editors && Array.isArray(form.editors)) {
                form.editors.forEach((editor) => {
                    const editorId = typeof editor === "object"
                        ? editor._id.toString()
                        : editor.toString();
                    if (!recipients.includes(editorId)) {
                        recipients.push(editorId);
                    }
                });
            }
            return recipients;
        });
    }
    // Create notification for new response
    static NotifyNewResponse(formId, responseId, respondentData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Form = require("../../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form)
                    return;
                // Get all recipients (user, owners, editors)
                const recipients = yield NotificationController.getAllFormRecipients(form);
                // Create notifications for all recipients
                const notifications = yield Promise.all(recipients.map((recipientId) => NotificationController.CreateNotification({
                    userId: recipientId,
                    type: "response",
                    title: "New Form Response",
                    message: `${respondentData.name || "Someone"} has submitted a response to your form "${form.title}"`,
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
                })));
                // Send real-time notifications via SSE to all recipients
                if (notifications.length > 0) {
                    const notificationData = {
                        type: "new_response",
                        notification: notifications[0], // Send first notification as reference
                        timestamp: new Date().toISOString(),
                    };
                    exports.sseManager.sendToMultipleUsers(recipients, notificationData);
                }
                return notifications;
            }
            catch (error) {
                console.error("Notify New Response Error:", error);
            }
        });
    }
    // Create notification for form milestones
    static NotifyFormMilestone(formId, milestone) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Form = require("../../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form)
                    return;
                const milestoneMessages = {
                    responses: `Your form "${form.title}" has reached ${milestone.count} responses!`,
                    views: `Your form "${form.title}" has been viewed ${milestone.count} times!`,
                    completion: `Your form "${form.title}" has achieved ${milestone.count}% completion rate!`,
                };
                // Get all recipients (user, owners, editors)
                const recipients = yield NotificationController.getAllFormRecipients(form);
                // Create notifications for all recipients
                const notifications = yield Promise.all(recipients.map((recipientId) => NotificationController.CreateNotification({
                    userId: recipientId,
                    type: "achievement",
                    title: "Form Milestone Achieved",
                    message: milestoneMessages[milestone.type],
                    formId,
                    formTitle: form.title,
                    priority: "low",
                    actionUrl: `/forms/${formId}/analytics`,
                    metadata: {
                        responseCount: milestone.type === "responses" ? milestone.count : undefined,
                        completionRate: milestone.type === "completion" ? milestone.count : undefined,
                    },
                })));
                return notifications;
            }
            catch (error) {
                console.error("Notify Form Milestone Error:", error);
            }
        });
    }
    // Create notification for form reminders
    static NotifyFormReminder(formId, reminderType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Form = require("../../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form)
                    return;
                const reminderMessages = {
                    deadline: `Your form "${form.title}" is approaching its deadline. Make sure to review responses soon.`,
                    inactive: `Your form "${form.title}" hasn't received responses in a while. Consider sharing it again.`,
                    review: `Don't forget to review and score the responses for your form "${form.title}".`,
                    unscoredResponses: `You have responses waiting to be scored for your form "${form.title}". Review and score them to provide feedback.`,
                    missingQuizConfig: `Your quiz "${form.title}" is missing scores or solutions. Complete the configuration to enable auto-grading.`,
                    incompleteForm: `Your form "${form.title}" setup is incomplete. Complete it to start collecting responses.`,
                };
                // Get all recipients (user, owners, editors)
                const recipients = yield NotificationController.getAllFormRecipients(form);
                // For incomplete form reminders, check if notification was already sent
                if (reminderType === "incompleteForm") {
                    const existingReminder = yield Notification_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        type: "reminder",
                        message: reminderMessages.incompleteForm,
                    });
                    if (existingReminder) {
                        console.log(`[NotifyFormReminder] Incomplete form reminder already sent for form ${formId}`);
                        return [];
                    }
                }
                // Set priority based on reminder type
                let priority = "medium";
                if (reminderType === "deadline" || reminderType === "incompleteForm") {
                    priority = "high";
                }
                else if (reminderType === "unscoredResponses" ||
                    reminderType === "missingQuizConfig") {
                    priority = "medium";
                }
                else {
                    priority = "low";
                }
                // Set action URL based on reminder type
                let actionUrl = `/forms/${formId}`;
                if (reminderType === "unscoredResponses" || reminderType === "review") {
                    actionUrl = `/forms/${formId}/responses`;
                }
                else if (reminderType === "missingQuizConfig") {
                    actionUrl = `/forms/${formId}/edit`;
                }
                else if (reminderType === "incompleteForm") {
                    actionUrl = `/forms/${formId}/setup`;
                }
                // Create notifications for all recipients
                const notifications = yield Promise.all(recipients.map((recipientId) => NotificationController.CreateNotification({
                    userId: recipientId,
                    type: "reminder",
                    title: "Form Reminder",
                    message: reminderMessages[reminderType],
                    formId,
                    formTitle: form.title,
                    priority,
                    actionUrl,
                })));
                return notifications;
            }
            catch (error) {
                console.error("Notify Form Reminder Error:", error);
            }
        });
    }
}
exports.NotificationController = NotificationController;
