"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const FormSchema = new mongoose_1.Schema({
    form: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Form",
        required: true,
    },
    session_id: {
        type: mongoose_1.Schema.Types.String,
        required: true,
        unique: true,
    },
    expiredAt: {
        type: mongoose_1.Schema.Types.Date,
        required: true,
    },
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },
});
FormSchema.index({ form: 1 });
FormSchema.index({ expiredAt: 1 });
const Formsession = (0, mongoose_1.model)("Formsession", FormSchema);
exports.default = Formsession;
