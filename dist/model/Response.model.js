"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringMethod = exports.completionStatus = exports.RespondentType = void 0;
const mongoose_1 = require("mongoose");
var RespondentType;
(function (RespondentType) {
    RespondentType["user"] = "USER";
    RespondentType["guest"] = "GUEST";
})(RespondentType || (exports.RespondentType = RespondentType = {}));
var completionStatus;
(function (completionStatus) {
    completionStatus["completed"] = "completed";
    completionStatus["partial"] = "partial";
    completionStatus["abandoned"] = "abandoned";
    completionStatus["idle"] = "idle";
})(completionStatus || (exports.completionStatus = completionStatus = {}));
var ScoringMethod;
(function (ScoringMethod) {
    ScoringMethod["AUTO"] = "auto";
    ScoringMethod["MANUAL"] = "manual";
    ScoringMethod["NONE"] = "none";
})(ScoringMethod || (exports.ScoringMethod = ScoringMethod = {}));
//Sub Doc
const ResponseSetSchema = new mongoose_1.Schema({
    question: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Content",
        required: true,
        index: true,
    },
    response: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    score: {
        type: Number,
        required: false,
    },
    scoringMethod: {
        type: String,
        enum: ScoringMethod,
        default: ScoringMethod.NONE,
    },
});
// Main schema for form responses
const ResponseSchema = new mongoose_1.Schema({
    formId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Form",
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: false,
        index: true,
    },
    responseset: {
        type: [ResponseSetSchema],
        validate: {
            validator: (responses) => responses.length > 0,
            message: "Responseset must contain at least one response.",
        },
        required: true,
    },
    totalScore: {
        type: Number,
        default: 0,
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    completionStatus: {
        type: String,
        enum: completionStatus,
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
    respondentType: {
        type: String,
        enum: RespondentType,
        required: false,
        default: null,
    },
    // Browser fingerprinting fields for anonymous tracking
    respondentFingerprint: {
        type: String,
        required: false,
        index: true,
    },
    respondentIP: {
        type: String,
        required: false,
        index: true,
    },
    submittedAt: {
        type: Date,
        required: false,
    },
}, { timestamps: true });
ResponseSchema.index({ userId: 1, formId: 1 });
ResponseSchema.index({ createdAt: 1 });
ResponseSchema.index({ submittedAt: 1 });
ResponseSchema.index({ totalScore: 1 });
// Fingerprinting indexes for duplicate detection
ResponseSchema.index({ formId: 1, respondentFingerprint: 1 });
ResponseSchema.index({ formId: 1, respondentIP: 1 });
ResponseSchema.index({ formId: 1, respondentEmail: 1 });
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
