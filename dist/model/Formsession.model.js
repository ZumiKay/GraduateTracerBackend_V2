"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const FormSessionSchema = new mongoose_1.Schema({
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
    access_id: {
        type: mongoose_1.Schema.Types.String,
        unique: true,
        required: false,
    },
    expiredAt: {
        type: mongoose_1.Schema.Types.Date,
        required: true,
    },
    respondentEmail: {
        type: mongoose_1.Schema.Types.String,
    },
    respondentName: {
        type: mongoose_1.Schema.Types.String,
        required: false,
    },
    isGuest: {
        type: mongoose_1.Schema.Types.Boolean,
        required: false,
        default: false,
    },
    removeCode: {
        type: mongoose_1.Schema.Types.String,
        default: null,
        required: false,
    },
});
FormSessionSchema.index({ form: 1 });
//Auto delete when expiredAt is expire
FormSessionSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });
const Formsession = (0, mongoose_1.model)("Formsession", FormSessionSchema);
exports.default = Formsession;
