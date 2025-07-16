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
exports.NotificationController = void 0;
const helper_1 = require("../utilities/helper");
const mongoose_1 = require("mongoose");
const Notification_model_1 = __importDefault(require("../model/Notification.model"));
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
                const query = { userId: new mongoose_1.Types.ObjectId(userId) };
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
            var _a;
            const { notificationId } = req.params;
            const user = req.user;
            try {
                const notification = yield Notification_model_1.default.findById(notificationId);
                if (!notification) {
                    res.status(404).json((0, helper_1.ReturnCode)(404, "Notification not found"));
                    return;
                }
                // Verify ownership
                if (notification.userId.toString() !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
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
            var _a;
            const { notificationId } = req.params;
            const user = req.user;
            try {
                const notification = yield Notification_model_1.default.findById(notificationId);
                if (!notification) {
                    res.status(404).json((0, helper_1.ReturnCode)(404, "Notification not found"));
                    return;
                }
                // Verify ownership
                if (notification.userId.toString() !== ((_a = user === null || user === void 0 ? void 0 : user.id) === null || _a === void 0 ? void 0 : _a.toString())) {
                    res.status(403).json((0, helper_1.ReturnCode)(403, "Unauthorized"));
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
                // This would typically come from a user preferences model
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
                // This would typically update a user preferences model
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
    }
    // Create a new notification
    static CreateNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notification = yield Notification_model_1.default.create(Object.assign(Object.assign({}, data), { userId: new mongoose_1.Types.ObjectId(data.userId), formId: data.formId ? new mongoose_1.Types.ObjectId(data.formId) : undefined, responseId: data.responseId
                        ? new mongoose_1.Types.ObjectId(data.responseId)
                        : undefined, isRead: false, createdAt: new Date() }));
                return notification;
            }
            catch (error) {
                console.error("Create Notification Error:", error);
                throw error;
            }
        });
    }
    // Create notification for new response
    static NotifyNewResponse(formId, responseId, respondentData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Form = require("../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form || !form.user)
                    return;
                const notification = yield NotificationController.CreateNotification({
                    userId: form.user._id.toString(),
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
                });
                return notification;
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
                const Form = require("../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form || !form.user)
                    return;
                const milestoneMessages = {
                    responses: `Your form "${form.title}" has reached ${milestone.count} responses!`,
                    views: `Your form "${form.title}" has been viewed ${milestone.count} times!`,
                    completion: `Your form "${form.title}" has achieved ${milestone.count}% completion rate!`,
                };
                const notification = yield NotificationController.CreateNotification({
                    userId: form.user._id.toString(),
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
                });
                return notification;
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
                const Form = require("../model/Form.model").default;
                const form = yield Form.findById(formId).populate("user");
                if (!form || !form.user)
                    return;
                const reminderMessages = {
                    deadline: `Your form "${form.title}" is approaching its deadline. Make sure to review responses soon.`,
                    inactive: `Your form "${form.title}" hasn't received responses in a while. Consider sharing it again.`,
                    review: `Don't forget to review and score the responses for your form "${form.title}".`,
                };
                const notification = yield NotificationController.CreateNotification({
                    userId: form.user._id.toString(),
                    type: "reminder",
                    title: "Form Reminder",
                    message: reminderMessages[reminderType],
                    formId,
                    formTitle: form.title,
                    priority: reminderType === "deadline" ? "high" : "medium",
                    actionUrl: `/forms/${formId}`,
                });
                return notification;
            }
            catch (error) {
                console.error("Notify Form Reminder Error:", error);
            }
        });
    }
}
exports.NotificationController = NotificationController;
exports.default = new NotificationController();
