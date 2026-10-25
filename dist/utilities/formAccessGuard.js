"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureFormAccess = ensureFormAccess;
const mongoose_1 = require("mongoose");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const helper_1 = require("./helper");
const formHelpers_1 = require("./formHelpers");
/**
 * Only the form's creator, owners and editors.
 */
async function ensureFormAccess(req, res, formId) {
    const user = req.user;
    if (!user?.sub) {
        res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        return false;
    }
    if (typeof formId !== "string" || !(0, formHelpers_1.isValidObjectIdString)(formId)) {
        res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid request payload"));
        return false;
    }
    const form = await Form_model_1.default.findById(formId).select("user owners editors").lean();
    if (!form) {
        res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        return false;
    }
    if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(user.sub))) {
        res.status(403).json((0, helper_1.ReturnCode)(403, "You have no access for this"));
        return false;
    }
    return true;
}
