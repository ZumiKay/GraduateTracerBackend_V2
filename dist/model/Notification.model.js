"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["response", "reminder", "alert", "achievement"],
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        maxlength: 200,
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    formId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Form",
        index: true,
    },
    formTitle: {
        type: String,
        maxlength: 200,
    },
    responseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "FormResponse",
    },
    respondentName: {
        type: String,
        maxlength: 100,
    },
    respondentEmail: {
        type: String,
        maxlength: 255,
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    readAt: {
        type: Date,
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
        index: true,
    },
    actionUrl: {
        type: String,
        maxlength: 500,
    },
    metadata: {
        responseCount: {
            type: Number,
            min: 0,
        },
        score: {
            type: Number,
            min: 0,
        },
        completionRate: {
            type: Number,
            min: 0,
            max: 100,
        },
    },
}, {
    timestamps: true,
    toJSON: {
        transform: (_, ret) => {
            ret.id = ret._id;
            ret === null || ret === void 0 ? true : delete ret._id;
            ret === null || ret === void 0 ? true : delete ret.__v;
            return ret;
        },
    },
});
// Indexes for better performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });
// Cleanup old notifications (older than 90 days)
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
const Notification = (0, mongoose_1.model)("Notification", NotificationSchema);
exports.default = Notification;
