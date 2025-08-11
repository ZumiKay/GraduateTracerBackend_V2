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
exports.AddFormOwner = AddFormOwner;
exports.RemoveFormOwner = RemoveFormOwner;
exports.GetFormOwners = GetFormOwners;
exports.RemoveSelfFromForm = RemoveSelfFromForm;
exports.CreateForm = CreateForm;
exports.PageHandler = PageHandler;
exports.EditForm = EditForm;
exports.DeleteForm = DeleteForm;
exports.GetAllForm = GetAllForm;
exports.GetFilterForm = GetFilterForm;
exports.ValidateFormBeforeAction = ValidateFormBeforeAction;
const helper_1 = require("../utilities/helper");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
// Helper function to validate ObjectId format
function isValidObjectIdString(id) {
    return (typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id));
}
function hasFormAccess(form, userId) {
    try {
        const userIdStr = userId.toString();
        // Check if user is the primary owner
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
        if (formUserId === userIdStr) {
            return true;
        }
        // Check if user is a collaborator
        if (form.owners && form.owners.length > 0) {
            const isCollaborator = form.owners.some((owner) => {
                let ownerId;
                if (owner && typeof owner === "object" && owner._id) {
                    ownerId = owner._id.toString();
                }
                else if (owner) {
                    ownerId = owner.toString();
                }
                else {
                    return false;
                }
                const matches = ownerId === userIdStr;
                return matches;
            });
            if (isCollaborator) {
                return true;
            }
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
// Helper function to validate form access and return access info
function validateFormAccess(form, userId) {
    const hasAccess = hasFormAccess(form, userId);
    const isOwner = isPrimaryOwner(form, userId);
    const isCollaborator = hasAccess && !isOwner;
    return {
        hasAccess,
        isOwner,
        isCollaborator,
    };
}
function AddFormOwner(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, userEmail } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId || !userEmail) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Form ID and user email are required"));
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
            if (!isPrimaryOwner(form, currentUser.id.toString())) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only the form creator can add owners"));
            }
            const User = require("../model/User.model").default;
            const userToAdd = yield User.findOne({ email: userEmail });
            if (!userToAdd) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "User not found"));
            }
            if (hasFormAccess(form, userToAdd._id.toString())) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "User already has access to this form"));
            }
            const updatedForm = yield Form_model_1.default.findByIdAndUpdate(formId, { $addToSet: { owners: userToAdd._id } }, { new: true }).populate("owners", "email");
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Owner added successfully")), { data: {
                    form: {
                        _id: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm._id,
                        title: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.title,
                        owners: updatedForm === null || updatedForm === void 0 ? void 0 : updatedForm.owners,
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
            if (form.user.equals(new mongoose_1.Types.ObjectId(userId))) {
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
function GetFormOwners(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
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
                .populate("owners", "email");
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!hasFormAccess(form, currentUser.id.toString())) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const primaryOwner = {
                _id: form.user._id,
                name: ((_a = form.user.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                email: form.user.email,
                role: "creator",
                isPrimary: true,
            };
            const additionalOwners = (form.owners || []).map((owner) => {
                var _a;
                return ({
                    _id: owner._id,
                    name: ((_a = owner.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                    email: owner.email,
                    role: "collaborator",
                    isPrimary: false,
                });
            });
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form owners retrieved successfully")), { data: {
                    primaryOwner,
                    additionalOwners,
                    totalOwners: additionalOwners.length + 1,
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
            if (!hasFormAccess(form, currentUser.id.toString())) {
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
            if (!hasFormAccess(form, user.id.toString())) {
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
            if (!hasFormAccess(form, user.id.toString())) {
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
            const updatedForm = yield Form_model_1.default.findByIdAndUpdate(_id, { $set: updateQuery }, // Apply update query
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
                if (!hasFormAccess(form, userIdString)) {
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
            const lt = Number(limit);
            // Early validation for query parameter
            if ([
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
            ].includes(ty) &&
                !q) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query"));
            }
            // Cache commonly used projections
            const basicProjection = "title type createdAt updatedAt";
            switch (ty) {
                case "detail":
                case "solution":
                case "response": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    let query;
                    if (q &&
                        typeof q === "string" &&
                        q.length === 24 &&
                        /^[0-9a-fA-F]{24}$/.test(q)) {
                        query = { _id: q };
                    }
                    else if (q && typeof q === "string") {
                        query = { title: q };
                    }
                    else {
                        return res
                            .status(400)
                            .json((0, helper_1.ReturnCode)(400, "Invalid query parameter"));
                    }
                    const detailForm = yield Form_model_1.default.findOne(query)
                        .select(`${basicProjection} totalpage setting contentIds user owners`)
                        .populate({ path: "user", select: "email" })
                        .lean();
                    if (!detailForm) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "No Form Found"));
                    }
                    // Validate form access and get ownership flags
                    const { hasAccess, isOwner, isCollaborator } = validateFormAccess(detailForm, user.id.toString());
                    if (!hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    const resultContent = yield Content_model_1.default.find({
                        $and: [
                            {
                                _id: { $in: detailForm.contentIds },
                            },
                            { page: p },
                        ],
                    })
                        .select(`_id idx title type text multiple checkbox rangedate rangenumber date require page conditional parentcontent ${ty === "solution" ? "answer score hasAnswer isValidated" : ""}`)
                        .lean()
                        .sort({ idx: 1 });
                    // Add validation summary for solution tab
                    let validationSummary = null;
                    if (ty === "solution") {
                        try {
                            validationSummary = yield SolutionValidationService_1.default.validateForm(q);
                        }
                        catch (error) {
                            console.error("Validation error:", error);
                        }
                    }
                    // Add access information to the response
                    const responseData = Object.assign(Object.assign({}, detailForm), { contents: resultContent.map((content) => {
                            var _a;
                            return (Object.assign(Object.assign({}, content), { parentcontent: ((_a = content.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) === content._id.toString()
                                    ? undefined
                                    : content.parentcontent }));
                        }) || [], contentIds: undefined, validationSummary, isOwner: isOwner, isCollaborator: isCollaborator });
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: responseData }));
                }
                case "total": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    // Validate that q is a valid ObjectId before using findById
                    if (!q || !isValidObjectIdString(q)) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                    }
                    const formdata = yield Form_model_1.default.findById(q)
                        .select("totalpage totalscore contentIds user owners")
                        .populate({ path: "user", select: "email" })
                        .lean();
                    if (!formdata) {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                    }
                    // Validate form access and get access info
                    const { hasAccess, isOwner, isCollaborator } = validateFormAccess(formdata, user.id.toString());
                    if (!hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    // Calculate actual total score from ALL questions in the form (not per page)
                    // This query gets ALL content/questions for the entire form across all pages
                    const allContents = yield Content_model_1.default.find({ formId: formdata._id })
                        .select("type score")
                        .lean();
                    // Calculate total score excluding Text questions (which are display-only)
                    const actualTotalScore = allContents
                        .filter((content) => content.type !== Content_model_1.QuestionType.Text)
                        .reduce((sum, content) => sum + (content.score || 0), 0);
                    // Get total count of actual questions (all content, not just contentIds)
                    const totalQuestionCount = allContents.length;
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                            totalpage: (_a = formdata === null || formdata === void 0 ? void 0 : formdata.totalpage) !== null && _a !== void 0 ? _a : 0,
                            totalscore: actualTotalScore,
                            totalquestion: totalQuestionCount,
                            isOwner,
                            isCollaborator,
                        } }));
                }
                case "setting": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    // Validate that q is a valid ObjectId before using findById
                    if (!q || !isValidObjectIdString(q)) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
                    }
                    const form = yield Form_model_1.default.findById(q)
                        .select("_id title type setting user owners")
                        .populate({ path: "user", select: "email" })
                        .lean();
                    if (!form) {
                        return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                    }
                    // Validate form access and get ownership flags
                    const { hasAccess, isOwner, isCollaborator } = validateFormAccess(form, user.id.toString());
                    if (!hasAccess) {
                        return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                    }
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                            _id: form._id,
                            title: form.title,
                            type: form.type,
                            setting: form.setting,
                            isOwner: isOwner,
                            isCollaborator: isCollaborator,
                        } }));
                }
                case "user": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    // Build the query for user forms
                    const userQuery = {
                        $or: [{ user: user.id }, { owners: user.id }],
                    };
                    // Get total count for pagination
                    const totalCount = yield Form_model_1.default.countDocuments(userQuery);
                    // Find forms where user is either the primary owner or a collaborator
                    const userForms = yield Form_model_1.default.find(userQuery)
                        .skip((p - 1) * lt)
                        .limit(lt)
                        .select(basicProjection)
                        .populate({ path: "responses", select: "_id" })
                        .populate({ path: "user", select: "email" })
                        .lean();
                    const formattedForms = userForms.map((form) => (Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt
                            ? (0, helper_1.FormatToGeneralDate)(form.updatedAt)
                            : undefined, createdAt: form.createdAt
                            ? (0, helper_1.FormatToGeneralDate)(form.createdAt)
                            : undefined, isOwner: form.user._id.toString() === user.id.toString(), isCollaborator: form.owners &&
                            form.owners.some((owner) => owner.toString() === user.id.toString()) })));
                    // Calculate pagination metadata
                    const totalPages = Math.ceil(totalCount / lt);
                    const hasNextPage = p < totalPages;
                    const hasPrevPage = p > 1;
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formattedForms, pagination: {
                            currentPage: p,
                            totalPages,
                            totalCount,
                            limit: lt,
                            hasNextPage,
                            hasPrevPage,
                        } }));
                }
                default: {
                    // Handle search, type, createddate, modifieddate cases
                    const user = req.user;
                    const conditions = {
                        search: { title: { $regex: q, $options: "i" } },
                        type: { type: q },
                        createddate: { createdAt: new Date(q) },
                        modifieddate: { updatedAt: new Date(q) },
                    }[ty] || {};
                    // Get total count for pagination
                    const totalCount = yield Form_model_1.default.countDocuments(conditions);
                    const forms = yield Form_model_1.default.find(conditions)
                        .skip((p - 1) * lt)
                        .limit(lt)
                        .select(basicProjection)
                        .populate({ path: "user", select: "email" })
                        .lean();
                    // Add access information to each form if user is authenticated
                    const formattedForms = forms.map((form) => {
                        if (!user) {
                            return Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt, createdAt: form.createdAt, isOwner: false, isCollaborator: false });
                        }
                        const { isOwner, isCollaborator } = validateFormAccess(form, user.id.toString());
                        return Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt, createdAt: form.createdAt, isOwner,
                            isCollaborator });
                    });
                    // Calculate pagination metadata
                    const totalPages = Math.ceil(totalCount / lt);
                    const hasNextPage = p < totalPages;
                    const hasPrevPage = p > 1;
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formattedForms, pagination: {
                            currentPage: p,
                            totalPages,
                            totalCount,
                            limit: lt,
                            hasNextPage,
                            hasPrevPage,
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
        // Validate that formId is a valid ObjectId
        if (!isValidObjectIdString(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID format"));
        }
        try {
            // Check if user has access to this form
            const form = yield Form_model_1.default.findById(formId)
                .select("user owners")
                .populate({ path: "user", select: "email" })
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!hasFormAccess(form, user.id.toString())) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
            const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
            // Different validation requirements based on action
            let canProceed = true;
            let warnings = [];
            switch (action) {
                case "save":
                    // Allow saving even with missing answers/scores, just provide warnings
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
