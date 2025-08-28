"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasFormAccess = hasFormAccess;
exports.isPrimaryOwner = isPrimaryOwner;
exports.AddFormCollaborator = AddFormCollaborator;
exports.RemoveFormOwner = RemoveFormOwner;
exports.GetFormCollaborators = GetFormCollaborators;
exports.RemoveSelfFromForm = RemoveSelfFromForm;
exports.ChangePrimaryOwner = ChangePrimaryOwner;
exports.CreateForm = CreateForm;
exports.PageHandler = PageHandler;
exports.EditForm = EditForm;
exports.DeleteForm = DeleteForm;
exports.GetAllForm = GetAllForm;
exports.GetFilterForm = GetFilterForm;
exports.ValidateFormBeforeAction = ValidateFormBeforeAction;
const helper_1 = require("../utilities/helper");
const Form_model_1 = __importStar(require("../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
const User_model_1 = __importDefault(require("../model/User.model"));
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
        if (HaveAccessID.has(userIdStr)) {
            return true;
        }
        return false;
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
    var _a, _b;
    const user_id = userId.toString();
    if (role === Form_model_1.CollaboratorType.editor
        ? (_a = form.editors) === null || _a === void 0 ? void 0 : _a.some((i) => i.toString() === user_id)
        : (_b = form.owners) === null || _b === void 0 ? void 0 : _b.some((i) => i.toString() === user_id)) {
        return true;
    }
    return false;
}
function AddFormCollaborator(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, userEmail, role } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        //Validate Payload
        if (!formId ||
            !userEmail ||
            !role ||
            !Object.values(Form_model_1.CollaboratorType).includes(role)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Payload"));
        }
        // Validate formId format
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!verifyRole(Form_model_1.CollaboratorType.owner, form, currentUser.id)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only the form creator can add owners"));
            }
            const userToAdd = yield User_model_1.default.findOne({ email: userEmail }).lean();
            if (!userToAdd) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "User not found"));
            }
            if (verifyRole(role, form, userToAdd._id)) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "User already has access to this form"));
            }
            const updatedForm = yield Form_model_1.default.findByIdAndUpdate(formId, {
                $addToSet: {
                    [role === Form_model_1.CollaboratorType.editor ? "editors" : "owners"]: userToAdd._id,
                },
            }, { new: true }).populate("owners", "email", "editors");
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Owner added successfully")), { data: {
                    form: {
                        _id: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm._id,
                        title: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.title,
                        owners: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.owners,
                        editors: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.editors,
                    },
                    addedUser: {
                        _id: userToAdd._id,
                        name: userToAdd.email.split("@")[0], // Use email prefix as name
                        email: userToAdd.email,
                    },
                } }));
        }
        catch (error) {
            console.error("Add Form Owner Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to add owner"));
        }
    });
}
function RemoveFormOwner(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, userId } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId || !userId) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Form ID and user ID are required"));
        }
        // Validate formId and userId formats
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        if (!isValidObjectIdString(userId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid user ID format"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!isPrimaryOwner(form, currentUser.id.toString())) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only the form creator can remove owners"));
            }
            if (form.user.toString() === userId) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Cannot remove the form creator"));
            }
            const updatedForm = yield Form_model_1.default.findByIdAndUpdate(formId, { $pull: { owners: new mongoose_1.Types.ObjectId(userId) } }, { new: true }).populate("owners", "email");
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Owner removed successfully")), { data: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.owners }));
        }
        catch (error) {
            console.error("Remove Form Owner Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to remove owner"));
        }
    });
}
function GetFormCollaborators(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { formId } = req.params;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
        }
        // Validate formId format
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId)
                .populate("user", "email")
                .populate("owners", "email", "editors");
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!verifyRole(Form_model_1.CollaboratorType.owner, form, currentUser.id)) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const primaryOwner = {
                _id: form.user._id,
                name: ((_a = form.user.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                email: form.user.email,
                role: Form_model_1.CollaboratorType.creator,
                isPrimary: true,
            };
            const allOwners = new Set();
            const allEditors = new Set();
            (_b = form.owners) === null || _b === void 0 ? void 0 : _b.forEach((i) => allOwners.add(i._id.toString()));
            (_c = form.editors) === null || _c === void 0 ? void 0 : _c.forEach((i) => allEditors.add(i._id.toString()));
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form owners retrieved successfully")), { data: {
                    primaryOwner,
                    allOwners,
                    allEditors,
                    totalOwners: allOwners.size + allEditors.size,
                } }));
        }
        catch (error) {
            console.error("Get Form Owners Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to retrieve form owners"));
        }
    });
}
function RemoveSelfFromForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
        }
        // Validate formId format
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (isPrimaryOwner(form, currentUser.id.toString())) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Primary owner cannot remove themselves. Transfer ownership first."));
            }
            if (!hasFormAccess(form, currentUser.id)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "You don't have access to this form"));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $pull: { owners: new mongoose_1.Types.ObjectId(currentUser.id) },
            });
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, "Successfully removed from form"));
        }
        catch (error) {
            console.error("Remove Self From Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to remove from form"));
        }
    });
}
function ChangePrimaryOwner(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { formId, userId } = req.body;
            const currentUser = req.user;
            if (!currentUser)
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            if (!formId || !userId || !isValidObjectIdString(userId))
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            const form = (yield Form_model_1.default.findById(formId).lean());
            if (!isPrimaryOwner(form, currentUser.id.toString())) {
                return res.status(403).json((0, helper_1.ReturnCode)(403));
            }
            //Transfer Primary Owner
            yield Form_model_1.default.updateOne({ _id: formId }, { user: new mongoose_1.Types.ObjectId(userId) });
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Tranfer Completed"));
        }
        catch (error) {
            console.log("Transfer Owner", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function CreateForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const formdata = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(404));
        try {
            //Form Creation
            const isForm = yield Form_model_1.default.findOne({
                $and: [{ title: formdata.title }, { user: user.id }],
            });
            if (isForm)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form already exist"));
            const createdForm = yield Form_model_1.default.create(Object.assign(Object.assign({}, formdata), { user: user.id }));
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(201, "Form Created")), { data: Object.assign(Object.assign({}, formdata), { _id: createdForm._id }) }));
        }
        catch (error) {
            console.log("Create Form", error);
            if (error.name === "Validation Error") {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function PageHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { ty, formId, deletepage, } = req.body;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId || !ty) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Missing required fields: formId or ty"));
        }
        // Validate formId format
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        if (ty === "delete" && (deletepage === undefined || isNaN(deletepage))) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "deletepage is required and must be a valid number for delete operation"));
        }
        try {
            // Check if user has access to edit this form
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!hasFormAccess(form, user.id)) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            if (ty === "add") {
                // Add page: increment totalpage
                yield Form_model_1.default.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
            }
            else if (ty === "delete") {
                // Delete page: fetch content IDs, update form, and delete content
                const toBeDeleteContent = yield Content_model_1.default.find({ page: deletepage })
                    .select("_id")
                    .lean();
                yield Form_model_1.default.updateOne({ _id: formId }, {
                    $inc: { totalpage: -1 },
                    $pull: { contentIds: { $in: toBeDeleteContent.map((i) => i._id) } },
                });
                yield Content_model_1.default.deleteMany({ page: deletepage });
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Success"));
        }
        catch (error) {
            console.error("PageHandler Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function EditForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const _a = req.body.data, { _id, setting } = _a, updateData = __rest(_a, ["_id", "setting"]);
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            // Validate _id
            if (!_id)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Form ID"));
            // Convert _id to string for validation
            const idString = _id.toString();
            // Validate _id format
            if (!isValidObjectIdString(idString)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
            }
            // Check if user has access to edit this form
            const form = yield Form_model_1.default.findById(_id);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!hasFormAccess(form, user.id)) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            // Construct update query dynamically
            const updateQuery = Object.assign({}, updateData);
            if (setting) {
                Object.keys(setting).forEach((key) => {
                    updateQuery[`setting.${key}`] = setting[key]; // Use dot notation
                });
            }
            // Update the form
            yield Form_model_1.default.findByIdAndUpdate(_id, { $set: updateQuery }, // Apply update query
            { new: true, projection: "_id" } // Return `_id` for confirmation
            );
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Form Updated"));
        }
        catch (error) {
            console.error("Edit Form Error:", error.message);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function DeleteForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { ids } = req.body;
            const user = req.user;
            if (!user) {
                return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
            }
            if (!Array.isArray(ids) || ids.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Invalid request: No IDs provided"));
            }
            // Check access for each form
            const forms = yield Form_model_1.default.find({ _id: { $in: ids } });
            const userIdString = user.id.toString();
            for (const form of forms) {
                if (!hasFormAccess(form, user.id)) {
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, "Access denied to one or more forms"));
                }
            }
            // For primary owners, delete the form completely
            // For collaborators, remove them from the form
            let deletedCount = 0;
            let removedCount = 0;
            for (const form of forms) {
                if (isPrimaryOwner(form, userIdString)) {
                    // Primary owner - delete form
                    yield Form_model_1.default.deleteOne({ _id: form._id });
                    deletedCount++;
                }
                else {
                    // Collaborator - remove from form
                    yield Form_model_1.default.findByIdAndUpdate(form._id, {
                        $pull: { owners: user.id },
                    });
                    removedCount++;
                }
            }
            let message = "";
            if (deletedCount > 0 && removedCount > 0) {
                message = `${deletedCount} forms deleted, removed from ${removedCount} forms`;
            }
            else if (deletedCount > 0) {
                message = `${deletedCount} forms deleted successfully`;
            }
            else if (removedCount > 0) {
                message = `Removed from ${removedCount} forms successfully`;
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, message));
        }
        catch (error) {
            console.error("Delete Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function GetAllForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { limit = "5", page = "1" } = req.query;
            const p = Number(page);
            const lt = Number(limit);
            const allForm = yield Form_model_1.default.find()
                .skip((p - 1) * lt)
                .limit(lt);
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: allForm }));
        }
        catch (error) {
            console.log("Get All Form", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function GetFilterForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const { ty, q, page = "1", limit = "5", } = req.query;
            if (!ty) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid type or query"));
            }
            const p = Number(page);
            const lt = Math.min(Number(limit), 50); // Limit max results to prevent performance issues
            // Early validation for query parameter
            const requiresQuery = [
                "detail",
                "solution",
                "setting",
                "search",
                "type",
                "createddate",
                "modifieddate",
                "preview",
                "total",
                "response",
            ];
            if (requiresQuery.includes(ty) && !q) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query"));
            }
            // Optimized projections for different use cases
            const projections = {
                basic: "title type createdAt updatedAt user owners",
                detail: "title type createdAt updatedAt totalpage setting contentIds user owners editors",
                minimal: "_id title type user owners editors",
                total: "totalpage totalscore contentIds user owners editors",
                setting: "_id title type setting user owners editors"
            };
            // Helper function for access validation with caching
            const validateAccess = (form, userId) => {
                const userIdStr = userId.toString();
                const isPrimary = isPrimaryOwner(form, userIdStr);
                const isOwner = verifyRole(Form_model_1.CollaboratorType.owner, form, userId);
                const isEditor = verifyRole(Form_model_1.CollaboratorType.editor, form, userId);
                const hasAccess = isPrimary || isOwner || isEditor;
                return { hasAccess, isPrimary, isOwner, isEditor };
            };
            switch (ty) {
                case "detail":
                case "solution":
                case "response": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    // Optimized query building
                    let query;
                    if (q && typeof q === "string" && isValidObjectIdString(q)) {
                        query = { _id: q };
                    }
                    else if (q && typeof q === "string") {
                        query = { title: q };
                    }
                    else {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query parameter"));
                    }
                    // Single optimized query with all required fields
                    const detailForm = yield Form_model_1.default.findOne(query)
                        .select(projections.detail)
                        .populate({ path: "user", select: "email", options: { lean: true } })
                        .lean()
                        .exec();
                    if (!detailForm) {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, "No Form Found"));
                    }
                    // Optimized access validation
                    const accessInfo = validateAccess(detailForm, user.id);
                    if (!accessInfo.hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    // Optimized content query with better indexing
                    const contentQuery = {
                        _id: { $in: detailForm.contentIds },
                        page: p
                    };
                    const contentProjection = ty === "solution"
                        ? "_id qIdx title type text multiple checkbox rangedate rangenumber date require page conditional parentcontent answer score hasAnswer isValidated"
                        : "_id qIdx title type text multiple checkbox rangedate rangenumber date require page conditional parentcontent";
                    const resultContent = yield Content_model_1.default.find(contentQuery)
                        .select(contentProjection)
                        .lean()
                        .exec();
                    // Parallel execution for solution validation if needed
                    let validationSummary = null;
                    if (ty === "solution") {
                        try {
                            // Run validation in background without blocking response
                            validationSummary = yield SolutionValidationService_1.default.validateForm(q);
                        }
                        catch (error) {
                            console.error("Validation error:", error);
                        }
                    }
                    // Optimized response construction
                    const responseData = Object.assign(Object.assign(Object.assign({}, detailForm), { contents: (0, helper_1.groupContentByParent)(resultContent.map((i) => (Object.assign(Object.assign({}, i), { _id: i._id.toString() })))), contentIds: undefined, validationSummary }), accessInfo);
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: responseData }));
                }
                case "total": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    if (!q || !isValidObjectIdString(q)) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                    }
                    // Single optimized query for form data
                    const formdata = yield Form_model_1.default.findById(q)
                        .select(projections.total)
                        .populate({ path: "user", select: "email", options: { lean: true } })
                        .lean()
                        .exec();
                    if (!formdata) {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                    }
                    // Optimized access validation
                    const accessInfo = validateAccess(formdata, user.id);
                    if (!accessInfo.hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    // Optimized aggregation query for content statistics
                    const contentStats = yield Content_model_1.default.aggregate([
                        { $match: { formId: formdata._id } },
                        {
                            $group: {
                                _id: null,
                                totalQuestions: { $sum: 1 },
                                totalScore: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $ne: ["$type", Content_model_1.QuestionType.Text] },
                                                    { $not: { $ifNull: ["$parentcontent", false] } }
                                                ]
                                            },
                                            { $ifNull: ["$score", 0] },
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ]);
                    const stats = contentStats[0] || { totalQuestions: 0, totalScore: 0 };
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ totalpage: (_a = formdata.totalpage) !== null && _a !== void 0 ? _a : 0, totalscore: stats.totalScore, totalquestion: stats.totalQuestions }, accessInfo) }));
                }
                case "setting": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    if (!q || !isValidObjectIdString(q)) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                    }
                    const form = yield Form_model_1.default.findById(q)
                        .select(projections.setting)
                        .populate({ path: "user", select: "email", options: { lean: true } })
                        .lean()
                        .exec();
                    if (!form) {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                    }
                    // Optimized access validation
                    const accessInfo = validateAccess(form, user.id);
                    if (!accessInfo.hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ _id: form._id, title: form.title, type: form.type, setting: form.setting }, accessInfo) }));
                }
                case "user": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    // Optimized user query with compound index support
                    const userQuery = {
                        $or: [{ user: user.id }, { owners: user.id }, { editors: user.id }],
                    };
                    // Use Promise.all for parallel execution of count and find
                    const [totalCount, userForms] = yield Promise.all([
                        Form_model_1.default.countDocuments(userQuery),
                        Form_model_1.default.find(userQuery)
                            .skip((p - 1) * lt)
                            .limit(lt)
                            .select(projections.basic)
                            .populate({ path: "responses", select: "_id", options: { lean: true } })
                            .populate({ path: "user", select: "email", options: { lean: true } })
                            .sort({ updatedAt: -1 }) // Add sorting for consistent results
                            .lean()
                            .exec()
                    ]);
                    // Optimized form formatting with reduced iterations
                    const userIdStr = user.id.toString();
                    const formattedForms = userForms.map((form) => {
                        var _a, _b;
                        const isOwner = form.user._id.toString() === userIdStr;
                        const isCollaborator = ((_a = form.owners) === null || _a === void 0 ? void 0 : _a.some((owner) => owner.toString() === userIdStr)) ||
                            ((_b = form.editors) === null || _b === void 0 ? void 0 : _b.some((editor) => editor.toString() === userIdStr));
                        return Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt ? (0, helper_1.FormatToGeneralDate)(form.updatedAt) : undefined, createdAt: form.createdAt ? (0, helper_1.FormatToGeneralDate)(form.createdAt) : undefined, isOwner,
                            isCollaborator });
                    });
                    // Optimized pagination metadata calculation
                    const totalPages = Math.ceil(totalCount / lt);
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formattedForms, pagination: {
                            currentPage: p,
                            totalPages,
                            totalCount,
                            limit: lt,
                            hasNextPage: p < totalPages,
                            hasPrevPage: p > 1,
                        } }));
                }
                default: {
                    // Handle search, type, createddate, modifieddate cases
                    const user = req.user;
                    // Optimized condition building with proper indexing support
                    let conditions = {};
                    switch (ty) {
                        case "search":
                            conditions = {
                                $or: [
                                    { title: { $regex: q, $options: "i" } },
                                    { description: { $regex: q, $options: "i" } }
                                ]
                            };
                            break;
                        case "type":
                            conditions = { type: q };
                            break;
                        case "createddate":
                            const createdDate = new Date(q);
                            conditions = {
                                createdAt: {
                                    $gte: new Date(createdDate.setHours(0, 0, 0, 0)),
                                    $lt: new Date(createdDate.setHours(23, 59, 59, 999))
                                }
                            };
                            break;
                        case "modifieddate":
                            const modifiedDate = new Date(q);
                            conditions = {
                                updatedAt: {
                                    $gte: new Date(modifiedDate.setHours(0, 0, 0, 0)),
                                    $lt: new Date(modifiedDate.setHours(23, 59, 59, 999))
                                }
                            };
                            break;
                        default:
                            conditions = {};
                    }
                    // Use Promise.all for parallel execution
                    const [totalCount, forms] = yield Promise.all([
                        Form_model_1.default.countDocuments(conditions),
                        Form_model_1.default.find(conditions)
                            .skip((p - 1) * lt)
                            .limit(lt)
                            .select(projections.basic)
                            .populate({ path: "user", select: "email", options: { lean: true } })
                            .sort({ updatedAt: -1 }) // Consistent sorting
                            .lean()
                            .exec()
                    ]);
                    // Optimized form formatting
                    const userIdStr = user === null || user === void 0 ? void 0 : user.id.toString();
                    const formattedForms = forms.map((form) => {
                        if (!user) {
                            return Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt, createdAt: form.createdAt, isPrimaryOwner: false, isOwner: false, isEditor: false });
                        }
                        const accessInfo = validateAccess(form, user.id);
                        return Object.assign(Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt, createdAt: form.createdAt }), accessInfo);
                    });
                    // Optimized pagination metadata
                    const totalPages = Math.ceil(totalCount / lt);
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formattedForms, pagination: {
                            currentPage: p,
                            totalPages,
                            totalCount,
                            limit: lt,
                            hasNextPage: p < totalPages,
                            hasPrevPage: p > 1,
                        } }));
                }
            }
        }
        catch (error) {
            console.error("Error in GetFilterForm:", error instanceof Error ? error.message : error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function ValidateFormBeforeAction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, action } = req.query;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        }
        if (!formId || typeof formId !== "string") {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
        }
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId)
                .select("user owners")
                .populate({ path: "user", select: "email" })
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!hasFormAccess(form, user.id)) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
            const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
            let canProceed = true;
            let warnings = [];
            switch (action) {
                case "save":
                    canProceed = true;
                    warnings = errors;
                    break;
                case "next_page":
                case "switch_tab":
                    // Allow navigation with warnings
                    canProceed = true;
                    warnings = errors;
                    break;
                case "send_form":
                    // Strict validation for sending form
                    canProceed = errors.length === 0;
                    break;
                default:
                    canProceed = errors.length === 0;
            }
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors,
                    warnings,
                    canProceed,
                    action }) }));
        }
        catch (error) {
            console.error("Validate Form Before Action Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
        }
    });
}
