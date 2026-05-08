"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetFormDetails = exports.GetFilledForm = exports.ValidateFormBeforeAction = exports.GetFilterForm = exports.DeletePendingCollaborator = exports.ResendPendingInvitation = exports.CancelOwnershipTransfer = exports.ConfirmOwnershipTransfer = exports.ChangePrimaryOwner = exports.RemoveSelfFromForm = exports.GetFormCollaborators = exports.ManageFormCollaborator = void 0;
exports.CreateForm = CreateForm;
exports.EditForm = EditForm;
exports.DeleteForm = DeleteForm;
exports.PageHandler = PageHandler;
exports.GetAllForm = GetAllForm;
const helper_1 = require("../../utilities/helper");
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importDefault(require("../../model/Content.model"));
const formHelpers_1 = require("../../utilities/formHelpers");
var form_collaborator_controller_1 = require("./form.collaborator.controller");
Object.defineProperty(exports, "ManageFormCollaborator", { enumerable: true, get: function () { return form_collaborator_controller_1.ManageFormCollaborator; } });
Object.defineProperty(exports, "GetFormCollaborators", { enumerable: true, get: function () { return form_collaborator_controller_1.GetFormCollaborators; } });
Object.defineProperty(exports, "RemoveSelfFromForm", { enumerable: true, get: function () { return form_collaborator_controller_1.RemoveSelfFromForm; } });
Object.defineProperty(exports, "ChangePrimaryOwner", { enumerable: true, get: function () { return form_collaborator_controller_1.ChangePrimaryOwner; } });
Object.defineProperty(exports, "ConfirmOwnershipTransfer", { enumerable: true, get: function () { return form_collaborator_controller_1.ConfirmOwnershipTransfer; } });
Object.defineProperty(exports, "CancelOwnershipTransfer", { enumerable: true, get: function () { return form_collaborator_controller_1.CancelOwnershipTransfer; } });
Object.defineProperty(exports, "ResendPendingInvitation", { enumerable: true, get: function () { return form_collaborator_controller_1.ResendPendingInvitation; } });
Object.defineProperty(exports, "DeletePendingCollaborator", { enumerable: true, get: function () { return form_collaborator_controller_1.DeletePendingCollaborator; } });
var form_query_controller_1 = require("./form.query.controller");
Object.defineProperty(exports, "GetFilterForm", { enumerable: true, get: function () { return form_query_controller_1.GetFilterForm; } });
Object.defineProperty(exports, "ValidateFormBeforeAction", { enumerable: true, get: function () { return form_query_controller_1.ValidateFormBeforeAction; } });
var form_response_controller_1 = require("./form.response.controller");
Object.defineProperty(exports, "GetFilledForm", { enumerable: true, get: function () { return form_response_controller_1.GetFilledForm; } });
Object.defineProperty(exports, "GetFormDetails", { enumerable: true, get: function () { return form_response_controller_1.GetFormDetails; } });
async function CreateForm(req, res) {
    const formdata = req.body;
    const user = req.user;
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
    try {
        const createdForm = await Form_model_1.default.create({
            ...formdata,
            user: new mongoose_1.Types.ObjectId(user.sub),
        });
        return res.status(201).json({
            ...(0, helper_1.ReturnCode)(201, "Form Created"),
            data: { ...formdata, _id: createdForm._id },
        });
    }
    catch (error) {
        console.error("Create Form Error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to create form"));
    }
}
async function EditForm(req, res) {
    const { _id, setting, ...updateData } = req.body.data;
    const user = req.user;
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
    const validation = (0, formHelpers_1.validateFormRequest)(_id?.toString() || "");
    if (!validation.isValid)
        return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
    try {
        const form = await Form_model_1.default.findById(_id);
        if (!form)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(user.sub)))
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        const updateQuery = { ...updateData };
        if (setting) {
            Object.keys(setting).forEach((key) => {
                updateQuery[`setting.${key}`] = setting[key];
            });
        }
        await Form_model_1.default.findByIdAndUpdate(_id, { $set: updateQuery }, { new: true });
        return res.status(200).json((0, helper_1.ReturnCode)(200, "Form Updated"));
    }
    catch (error) {
        console.error("Edit Form Error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update form"));
    }
}
async function DeleteForm(req, res) {
    const { ids } = req.body;
    const user = req.user;
    if (!user)
        return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
    if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json((0, helper_1.ReturnCode)(400, "No IDs provided"));
    try {
        const forms = await Form_model_1.default.find({ _id: { $in: ids } });
        // Verify if form access
        for (const form of forms) {
            if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(user.sub)))
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Access denied to one or more forms"));
        }
        //Delete Process
        await Form_model_1.default.deleteMany({
            _id: { $in: ids.map((id) => new mongoose_1.Types.ObjectId(id)) },
        });
        return res.status(200).json((0, helper_1.ReturnCode)(200, "Forms deleted successfully"));
    }
    catch (error) {
        console.error("Delete Form Error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete forms"));
    }
}
async function PageHandler(req, res) {
    const { ty, formId, deletepage } = req.body;
    const user = req.user;
    if (!user) {
        return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
    }
    const validation = (0, formHelpers_1.validateFormRequest)(formId);
    if (!validation.isValid) {
        return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
    }
    if (!ty) {
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing operation type"));
    }
    if (ty === "delete" && (deletepage === undefined || isNaN(deletepage))) {
        return res
            .status(400)
            .json((0, helper_1.ReturnCode)(400, "Valid page number required for delete"));
    }
    try {
        const form = await Form_model_1.default.findById(formId);
        if (!form) {
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        }
        if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(user.sub))) {
            return res
                .status(403)
                .json((0, helper_1.ReturnCode)(403, "You have no access for this"));
        }
        if (ty === "add") {
            await Form_model_1.default.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
        }
        else if (ty === "delete") {
            const toBeDeleteContent = await Content_model_1.default.find({ page: deletepage })
                .select("_id")
                .lean();
            await Form_model_1.default.updateOne({ _id: formId }, {
                $inc: { totalpage: -1 },
                $pull: { contentIds: { $in: toBeDeleteContent.map((i) => i._id) } },
            });
            await Content_model_1.default.deleteMany({ page: deletepage });
        }
        return res
            .status(200)
            .json((0, helper_1.ReturnCode)(200, "Operation completed successfully"));
    }
    catch (error) {
        console.error("Page Handler Error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Operation failed"));
    }
}
async function GetAllForm(req, res) {
    const { limit = "5", page = "1" } = req.query;
    const p = Number(page);
    const lt = Number(limit);
    try {
        const allForm = await Form_model_1.default.find()
            .skip((p - 1) * lt)
            .limit(lt);
        return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: allForm });
    }
    catch (error) {
        console.error("Get All Form Error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
