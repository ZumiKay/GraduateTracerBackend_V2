"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const Form_model_1 = require("./Form.model");
//Sub Doc
const ResponseSetSchema = new mongoose_1.Schema({
    questionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Content",
        required: true,
        index: true, // Indexing `questionId` for faster lookups
    },
    response: {
        type: mongoose_1.Schema.Types.Mixed, // Allows flexible response types
        required: true,
    },
    score: {
        type: Number,
        required: false,
    },
    isManuallyScored: {
        type: Boolean,
        default: false,
    },
});
const GuestSchema = new mongoose_1.Schema({
    email: {
        required: false,
        type: String,
    },
    name: {
        type: String,
        required: false,
    },
});
// Main schema for form responses
const ResponseSchema = new mongoose_1.Schema({
    formId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Form",
        required: true,
        index: true, // Indexing `formId` for faster retrieval by form
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: false,
        index: true, // Indexing `userId` for faster retrieval by user
    },
    guest: {
        type: GuestSchema,
        required: false,
    },
    responseset: {
        type: [ResponseSetSchema],
        validate: {
            validator: (responses) => responses.length > 0,
            message: "Responseset must contain at least one response.",
        },
        required: true,
    },
    returnscore: {
        type: String,
        enum: Form_model_1.returnscore,
        required: false,
    },
    totalScore: {
        type: Number,
        default: 0,
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    submittedAt: {
        type: Date,
        required: false,
    },
    isAutoScored: {
        type: Boolean,
        default: false,
    },
    completionStatus: {
        type: String,
        enum: ["completed", "partial", "abandoned"],
        default: "partial",
    },
    respondentEmail: {
        type: String,
        required: false,
    },
    respondentName: {
        type: String,
        required: false,
    },
}, { timestamps: true });
// Compound index for queries involving both `userId` and `formId`
ResponseSchema.index({ userId: 1, formId: 1 });
ResponseSchema.index({ createdAt: 1 });
ResponseSchema.index({ submittedAt: 1 });
ResponseSchema.index({ totalScore: 1 });
// Pre-save middleware to calculate total score
ResponseSchema.pre("save", function (next) {
    if (this.responseset && this.responseset.length > 0) {
        this.totalScore = this.responseset.reduce((total, response) => {
            return total + (response.score || 0);
        }, 0);
    }
    next();
});
const FormResponse = (0, mongoose_1.model)("Response", ResponseSchema);
exports.default = FormResponse;
