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
        required: true,
    },
    expireAt: {
        type: mongoose_1.Schema.Types.Date,
        required: true,
    },
}, { timestamps: true });
UsersessionSchema.index({ session_id: 1 });
UsersessionSchema.index({ user: 1 });
const Usersession = (0, mongoose_1.model)("Usersession", UsersessionSchema);
exports.default = Usersession;
