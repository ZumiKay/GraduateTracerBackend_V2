"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projections = void 0;
exports.isValidObjectIdString = isValidObjectIdString;
exports.hasFormAccess = hasFormAccess;
exports.isPrimaryOwner = isPrimaryOwner;
exports.verifyRole = verifyRole;
exports.validateAccess = validateAccess;
exports.validateFormRequest = validateFormRequest;
const Form_model_1 = require("../model/Form.model");
// Helper function to validate ObjectId format
function isValidObjectIdString(id) {
    return (typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id));
}
function hasFormAccess(form, userId) {
    var _a, _b;
    try {
        const userIdStr = userId.toString();
        const HaveAccessID = new Set();
        (_a = form.editors) === null || _a === void 0 ? void 0 : _a.forEach((i) => HaveAccessID.add(i._id.toString()));
        (_b = form.owners) === null || _b === void 0 ? void 0 : _b.forEach((i) => HaveAccessID.add(i._id.toString()));
        form.user.equals(userId) && HaveAccessID.add(userId.toString());
        return HaveAccessID.has(userIdStr);
    }
    catch (error) {
        console.error("Error in hasFormAccess:", error);
        return false;
    }
}
function isPrimaryOwner(form, userId) {
    try {
        const userIdStr = userId.toString();
        let formUserId;
        if (form.user && typeof form.user === "object" && form.user._id) {
            formUserId = form.user._id.toString();
        }
        else if (form.user) {
            formUserId = form.user.toString();
        }
        else {
            return false;
        }
        return formUserId === userIdStr;
    }
    catch (error) {
        console.error("Error in isPrimaryOwner:", error);
        return false;
    }
}
function verifyRole(role, form, userId) {
    var _a, _b, _c, _d;
    const user_id = userId.toString();
    return role === Form_model_1.CollaboratorType.editor
        ? (_b = (_a = form.editors) === null || _a === void 0 ? void 0 : _a.some((i) => i.toString() === user_id)) !== null && _b !== void 0 ? _b : false
        : (_d = (_c = form.owners) === null || _c === void 0 ? void 0 : _c.some((i) => i.toString() === user_id)) !== null && _d !== void 0 ? _d : false;
}
// Centralized access validation helper
function validateAccess(form, userId) {
    const userIdStr = userId === null || userId === void 0 ? void 0 : userId.toString();
    const isCreator = isPrimaryOwner(form, userIdStr);
    const isOwner = verifyRole(Form_model_1.CollaboratorType.owner, form, userId);
    const isEditor = verifyRole(Form_model_1.CollaboratorType.editor, form, userId);
    const hasAccess = isCreator || isOwner || isEditor;
    return { hasAccess, isCreator, isOwner, isEditor };
}
// Optimized projections for different use cases
exports.projections = {
    basic: "title type createdAt updatedAt user owners",
    detail: "title type createdAt updatedAt totalpage setting contentIds user owners editors",
    minimal: "_id title type user owners editors",
    total: "totalpage totalscore contentIds user owners editors",
    setting: "_id title type setting user owners editors",
};
// Common validation logic
function validateFormRequest(formId, userId) {
    if (!formId) {
        return { isValid: false, error: "Form ID is required" };
    }
    if (!isValidObjectIdString(formId)) {
        return { isValid: false, error: "Invalid form ID format" };
    }
    if (userId && !isValidObjectIdString(userId)) {
        return { isValid: false, error: "Invalid user ID format" };
    }
    return { isValid: true };
}
