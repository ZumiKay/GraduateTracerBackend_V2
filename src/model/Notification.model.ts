import { Schema, model, Types } from "mongoose";

export interface NotificationType {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  type: "response" | "reminder" | "alert" | "achievement";
  title: string;
  message: string;
  formId?: Types.ObjectId;
  formTitle?: string;
  responseId?: Types.ObjectId;
  respondentName?: string;
  respondentEmail?: string;
  isRead: boolean;
  readAt?: Date;
  priority: "low" | "medium" | "high";
  actionUrl?: string;
  metadata?: {
    responseCount?: number;
    score?: number;
    completionRate?: number;
  };
  createdAt: Date;
  updatedAt?: Date;
}

const NotificationSchema = new Schema<NotificationType>(
  {
    userId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: "Form",
      index: true,
    },
    formTitle: {
      type: String,
      maxlength: 200,
    },
    responseId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        
        ret.id = ret._id;
        delete ret?._id;
        delete ret?.__v;
        return ret;
      },
    },
  }
);

// Indexes for better performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });

// Cleanup old notifications (older than 90 days)
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

const Notification = model<NotificationType>(
  "Notification",
  NotificationSchema
);

export default Notification;
