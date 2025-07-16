"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE = void 0;
const mongoose_1 = require("mongoose");
var ROLE;
(function (ROLE) {
    ROLE["ADMIN"] = "ADMIN";
    ROLE["USER"] = "USER";
})(ROLE || (exports.ROLE = ROLE = {}));
const UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ROLE,
        default: ROLE.USER,
        required: true,
    },
    code: {
        type: String,
        default: null,
    },
});
const User = (0, mongoose_1.model)("User", UserSchema);
exports.default = User;
