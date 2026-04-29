"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UsersessionSchema = new mongoose_1.Schema({
    session_id: {
        type: String,
        unique: true,
        required: true,
    },
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },
    expireAt: {
        type: mongoose_1.Schema.Types.Date,
        required: true,
    },
    respondent: {
        type: mongoose_1.Schema.Types.Boolean,
        required: false,
        default: null,
    },
}, { timestamps: true });
// Indexes for optimized CheckSession queries
UsersessionSchema.index({ session_id: 1, expireAt: 1 }); // Compound index for session lookup
UsersessionSchema.index({ user: 1 }); // Index for user lookups
UsersessionSchema.index({ expireAt: 1 }); // Index for cleanup queries
const Usersession = (0, mongoose_1.model)("Usersession", UsersessionSchema);
exports.default = Usersession;
