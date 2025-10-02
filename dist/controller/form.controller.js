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
exports.GetFilledForm = exports.ManageFormCollaborator = void 0;
exports.GetFormCollaborators = GetFormCollaborators;
exports.RemoveSelfFromForm = RemoveSelfFromForm;
exports.ChangePrimaryOwner = ChangePrimaryOwner;
exports.CreateForm = CreateForm;
exports.EditForm = EditForm;
exports.DeleteForm = DeleteForm;
exports.PageHandler = PageHandler;
exports.GetAllForm = GetAllForm;
exports.GetFilterForm = GetFilterForm;
exports.ValidateFormBeforeAction = ValidateFormBeforeAction;
const helper_1 = require("../utilities/helper");
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
const Form_model_1 = __importStar(require("../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importStar(require("../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
const User_model_1 = __importDefault(require("../model/User.model"));
const formHelpers_1 = require("../utilities/formHelpers");
const Response_model_1 = __importDefault(require("../model/Response.model"));
const ManageFormCollaborator = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const operationId = MongoErrorHandler_1.MongoErrorHandler.generateOperationId("manage_collaborator");
    try {
        const { formId, email, role, action } = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!email || (action === "remove" ? false : !role) || !action || !formId)
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing required fields"));
        if (!(0, formHelpers_1.isValidObjectIdString)(formId))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        if (action === "add" && !["owner", "editor"].includes(role))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid role"));
        if (!["add", "remove"].includes(action))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid action"));
        const form = yield Form_model_1.default.findById(formId)
            .populate("user", "email _id")
            .exec();
        if (!form)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const { isCreator, isOwner } = (0, formHelpers_1.validateAccess)(form, user.id);
        if (action === "remove" || role !== Form_model_1.CollaboratorType.editor
            ? !isCreator
            : !(isCreator || isOwner))
            return res
                .status(403)
                .json((0, helper_1.ReturnCode)(403, "Only form owner can manage collaborators"));
        const targetUser = yield User_model_1.default.findOne({ email }).exec();
        if (!targetUser)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "User not found"));
        if (targetUser._id.toString() === user.id.toString())
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Cannot modify your own permissions"));
        const collaboratorId = targetUser._id;
        const currentField = role === Form_model_1.CollaboratorType.editor
            ? "editors"
            : role === Form_model_1.CollaboratorType.owner
                ? "owners"
                : undefined;
        const currentList = (currentField &&
            form[currentField]) ||
            [];
        if (currentField) {
            if (action === "add") {
                if (currentList.some((id) => id.toString() === collaboratorId.toString())) {
                    return res
                        .status(400)
                        .json((0, helper_1.ReturnCode)(400, `User is already a ${role}`));
                }
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $addToSet: { [currentField]: collaboratorId },
                });
            }
            else {
                if (!currentList.some((id) => id.toString() === collaboratorId.toString())) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, `User is not a ${role}`));
                }
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $pull: { [currentField]: collaboratorId },
                });
            }
        }
        const actionText = action === "add" ? "added as" : "removed from";
        return res
            .status(200)
            .json((0, helper_1.ReturnCode)(200, `User successfully ${actionText} ${role}`));
    }
    catch (error) {
        console.error(`[${operationId}] Error managing form collaborator:`, error);
        const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
            operationId,
            customMessage: "Failed to manage form collaborator",
        });
        if (!mongoErrorHandled.handled) {
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    }
});
exports.ManageFormCollaborator = ManageFormCollaborator;
function GetFormCollaborators(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const { formId } = req.params;
        const currentUser = req.user;
        if (!currentUser)
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        const validation = (0, formHelpers_1.validateFormRequest)(formId);
        if (!validation.isValid)
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        try {
            const form = yield Form_model_1.default.findById(formId)
                .populate("user owners editors", "email")
                .lean();
            if (!form)
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            console.log(form.user);
            console.log(currentUser);
            if (!form.user._id.equals(currentUser.id) &&
                !(0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.owner, form, currentUser.id))
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            const formCreator = form.user;
            const primaryOwner = {
                _id: formCreator._id.toString(),
                name: ((_a = formCreator.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                email: formCreator.email,
                role: Form_model_1.CollaboratorType.creator,
                isPrimary: true,
            };
            const allOwners = form.owners &&
                ((_b = form.owners) === null || _b === void 0 ? void 0 : _b.map((i) => {
                    var _a;
                    return ({
                        _id: i._id,
                        email: i.email,
                        name: ((_a = i.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                        role: Form_model_1.CollaboratorType.owner,
                    });
                }));
            const allEditors = form.editors &&
                ((_c = form.editors) === null || _c === void 0 ? void 0 : _c.map((i) => {
                    var _a;
                    return ({
                        _id: i._id,
                        email: i.email,
                        name: ((_a = i.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                        role: Form_model_1.CollaboratorType.editor,
                    });
                }));
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form collaborators retrieved successfully")), { data: {
                    primaryOwner,
                    allOwners,
                    allEditors,
                    totalCollaborators: ((_d = allOwners === null || allOwners === void 0 ? void 0 : allOwners.length) !== null && _d !== void 0 ? _d : 0) + ((_e = allEditors === null || allEditors === void 0 ? void 0 : allEditors.length) !== null && _e !== void 0 ? _e : 0),
                } }));
        }
        catch (error) {
            console.error("Get Form Collaborators Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to retrieve collaborators"));
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
        const validation = (0, formHelpers_1.validateFormRequest)(formId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        try {
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if ((0, formHelpers_1.isPrimaryOwner)(form, currentUser.id.toString())) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Primary owner cannot remove themselves. Transfer ownership first."));
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, currentUser.id)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "You don't have access to this form"));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $pull: { owners: currentUser.id, editors: currentUser.id },
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
        const { formId, userId } = req.body;
        const currentUser = req.user;
        if (!currentUser)
            return res.status(403).json((0, helper_1.ReturnCode)(403));
        const validation = (0, formHelpers_1.validateFormRequest)(formId, userId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        try {
            const form = (yield Form_model_1.default.findById(formId).lean());
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!(0, formHelpers_1.isPrimaryOwner)(form, currentUser.id.toString())) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only primary owner can transfer ownership"));
            }
            yield Form_model_1.default.updateOne({ _id: formId }, { user: new mongoose_1.Types.ObjectId(userId) });
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Transfer completed"));
        }
        catch (error) {
            console.error("Transfer Owner Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function CreateForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const formdata = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        try {
            const existingForm = yield Form_model_1.default.findOne({
                $and: [{ title: formdata.title }, { user: user.id }],
            });
            if (existingForm)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form already exists"));
            const createdForm = yield Form_model_1.default.create(Object.assign(Object.assign({}, formdata), { user: user.id }));
            return res.status(201).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(201, "Form Created")), { data: Object.assign(Object.assign({}, formdata), { _id: createdForm._id }) }));
        }
        catch (error) {
            console.error("Create Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to create form"));
        }
    });
}
function EditForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const _a = req.body.data, { _id, setting } = _a, updateData = __rest(_a, ["_id", "setting"]);
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        const validation = (0, formHelpers_1.validateFormRequest)((_id === null || _id === void 0 ? void 0 : _id.toString()) || "");
        if (!validation.isValid)
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        try {
            const form = yield Form_model_1.default.findById(_id);
            if (!form)
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            if (!(0, formHelpers_1.hasFormAccess)(form, user.id))
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            const updateQuery = Object.assign({}, updateData);
            if (setting) {
                Object.keys(setting).forEach((key) => {
                    updateQuery[`setting.${key}`] = setting[key];
                });
            }
            yield Form_model_1.default.findByIdAndUpdate(_id, { $set: updateQuery }, { new: true });
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Form Updated"));
        }
        catch (error) {
            console.error("Edit Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to update form"));
        }
    });
}
function DeleteForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { ids } = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        if (!Array.isArray(ids) || ids.length === 0)
            return res.status(400).json((0, helper_1.ReturnCode)(400, "No IDs provided"));
        try {
            const forms = yield Form_model_1.default.find({ _id: { $in: ids } });
            const userIdString = user.id.toString();
            for (const form of forms) {
                if (!(0, formHelpers_1.hasFormAccess)(form, user.id))
                    return res
                        .status(403)
                        .json((0, helper_1.ReturnCode)(403, "Access denied to one or more forms"));
            }
            let deletedCount = 0;
            let removedCount = 0;
            for (const form of forms) {
                if ((0, formHelpers_1.isPrimaryOwner)(form, userIdString)) {
                    yield Form_model_1.default.deleteOne({ _id: form._id });
                    deletedCount++;
                }
                else {
                    yield Form_model_1.default.findByIdAndUpdate(form._id, {
                        $pull: { owners: user.id, editors: user.id },
                    });
                    removedCount++;
                }
            }
            const message = deletedCount > 0 && removedCount > 0
                ? `${deletedCount} forms deleted, removed from ${removedCount} forms`
                : deletedCount > 0
                    ? `${deletedCount} forms deleted successfully`
                    : `Removed from ${removedCount} forms successfully`;
            return res.status(200).json((0, helper_1.ReturnCode)(200, message));
        }
        catch (error) {
            console.error("Delete Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to delete forms"));
        }
    });
}
function PageHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { ty, formId, deletepage } = req.body;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        //Validate request body
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
            const form = yield Form_model_1.default.findById(formId);
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, user.id)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "You have no access for this"));
            }
            if (ty === "add") {
                yield Form_model_1.default.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
            }
            else if (ty === "delete") {
                const toBeDeleteContent = yield Content_model_1.default.find({ page: deletepage })
                    .select("_id")
                    .lean();
                yield Form_model_1.default.updateOne({ _id: formId }, {
                    $inc: { totalpage: -1 },
                    $pull: { contentIds: { $in: toBeDeleteContent.map((i) => i._id) } },
                });
                yield Content_model_1.default.deleteMany({ page: deletepage });
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, "Operation completed successfully"));
        }
        catch (error) {
            console.error("Page Handler Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Operation failed"));
        }
    });
}
function GetAllForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { limit = "5", page = "1" } = req.query;
        const p = Number(page);
        const lt = Number(limit);
        try {
            const allForm = yield Form_model_1.default.find()
                .skip((p - 1) * lt)
                .limit(lt);
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: allForm }));
        }
        catch (error) {
            console.error("Get All Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function GetFilterForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { ty, q, page = "1", limit = "5", tab, created, updated, } = req.query;
            if (!ty || !tab || !Object.values(Form_model_1.DashboardTabType).includes(tab)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid type or query"));
            }
            const p = Number(page);
            const lt = Math.min(Number(limit), 50);
            const createdAt = created && Number(created);
            const updatedAt = updated && Number(updated);
            const requiresQuery = [
                "detail",
                "solution",
                "setting",
                "search",
                "type",
                "preview",
                "total",
                "response",
                "user",
            ];
            if (requiresQuery.includes(ty) && !q) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query"));
            }
            const user = req.user;
            // Handle different query types with optimized logic
            switch (ty) {
                case "detail":
                case "solution":
                case "response":
                    return yield handleDetailQuery(res, ty, q, p, user, Number(page !== null && page !== void 0 ? page : "1"));
                case "total":
                    return yield handleTotalQuery(res, q, user);
                case "setting":
                    return yield handleSettingQuery(res, q, user);
                case "user":
                    if (!user) {
                        return res
                            .status(401)
                            .json((0, helper_1.ReturnCode)(401, "Authentication required"));
                    }
                    //validate filterquery
                    if (!updated ||
                        !created ||
                        !isNaN(updated) ||
                        !isNaN(created) ||
                        Math.abs(created) !== 1 ||
                        Math.abs(updated) !== 1) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400));
                    }
                    const userTab = tab || Form_model_1.DashboardTabType.myform;
                    return yield handleUserQuery({
                        p,
                        lt,
                        userId: user.id,
                        tab: userTab,
                        res,
                        filter: {
                            query: q,
                            sort: {
                                createdAt,
                                updatedAt,
                            },
                        },
                    });
                default:
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
        }
        catch (error) {
            console.error("Error in GetFilterForm:", error instanceof Error ? error.message : error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
// Helper functions for GetFilterForm
function handleDetailQuery(res, ty, q, p, user, page) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        const query = (0, formHelpers_1.isValidObjectIdString)(q) ? { _id: q } : { title: q };
        const detailForm = yield Form_model_1.default.findOne(query)
            .select(formHelpers_1.projections.detail)
            .populate({ path: "user", select: "email", options: { lean: true } })
            .lean()
            .exec();
        if (!detailForm)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "No Form Found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(detailForm, user.id);
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        const contentProjection = ty === "solution"
            ? "_id qIdx title type text multiple checkbox selection rangedate rangenumber date require page conditional parentcontent answer score hasAnswer isValidated"
            : "_id qIdx title type text multiple checkbox selection rangedate rangenumber date require page conditional parentcontent";
        let validationSummary = null;
        if (ty === "solution") {
            try {
                validationSummary = yield SolutionValidationService_1.default.validateForm(q);
            }
            catch (error) {
                console.error("Validation error:", error);
            }
        }
        const resultContent = yield Content_model_1.default.find({
            _id: { $in: detailForm.contentIds },
            page: p,
        })
            .select(contentProjection)
            .lean()
            .exec();
        // Get last qIdx from previous page if current page > 1
        let lastQIdxFromPrevPage = null;
        if (page && page > 1) {
            const prevPageContent = yield Content_model_1.default.find({
                _id: { $in: detailForm.contentIds },
                page: page - 1,
            })
                .select("qIdx")
                .sort({ qIdx: -1 })
                .limit(1)
                .lean()
                .exec();
            lastQIdxFromPrevPage = ((_a = prevPageContent[0]) === null || _a === void 0 ? void 0 : _a.qIdx) || null;
        }
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign(Object.assign(Object.assign({}, detailForm), { contents: (0, helper_1.groupContentByParent)(resultContent), contentIds: undefined, validationSummary }), accessInfo), (page &&
                page > 1 && {
                lastqIdx: lastQIdxFromPrevPage,
            })) }));
    });
}
function handleTotalQuery(res, q, user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!(0, formHelpers_1.isValidObjectIdString)(q))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        const formdata = yield Form_model_1.default.findById(q)
            .select(formHelpers_1.projections.total)
            .populate({ path: "user", select: "email", options: { lean: true } })
            .lean()
            .exec();
        if (!formdata)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(formdata, user.id);
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
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
                                        { $not: { $ifNull: ["$parentcontent", false] } },
                                    ],
                                },
                                { $ifNull: ["$score", 0] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]);
        const stats = contentStats[0] || { totalQuestions: 0, totalScore: 0 };
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ totalpage: (_a = formdata.totalpage) !== null && _a !== void 0 ? _a : 0, totalscore: stats.totalScore, totalquestion: stats.totalQuestions }, accessInfo) }));
    });
}
function handleSettingQuery(res, q, user) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!(0, formHelpers_1.isValidObjectIdString)(q))
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        const form = yield Form_model_1.default.findById(q)
            .select(formHelpers_1.projections.setting)
            .populate({ path: "user", select: "email", options: { lean: true } })
            .lean()
            .exec();
        if (!form)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const accessInfo = (0, formHelpers_1.validateAccess)(form, user.id);
        if (!accessInfo.hasAccess)
            return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign({ _id: form._id, title: form.title, type: form.type, setting: form.setting }, accessInfo) }));
    });
}
function handleUserQuery(_a) {
    return __awaiter(this, arguments, void 0, function* ({ p, userId, tab, res, lt, filter, }) {
        var _b;
        try {
            // Validate input parameters
            if (!userId || !tab || p < 1 || lt < 1) {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            const baseQuery = yield buildBaseQuery(tab, userId);
            const filterQuery = buildFilterQuery(filter);
            const finalQuery = Object.assign(Object.assign({}, baseQuery), filterQuery);
            const sortOptions = buildSortOptions(filter);
            //Flag Filled Form
            const filledFormIds = [];
            if (tab === Form_model_1.DashboardTabType.filledform) {
                const user = yield User_model_1.default.findById(userId).select("email").lean();
                const filledForms = yield Response_model_1.default.find({
                    userId: userId,
                    respondentEmail: user === null || user === void 0 ? void 0 : user.email,
                })
                    .select("formId")
                    .lean();
                filledFormIds.push(...filledForms.map((i) => i.formId));
            }
            const [results] = yield Form_model_1.default.aggregate([
                { $match: finalQuery },
                {
                    $facet: {
                        totalCount: [{ $count: "count" }],
                        data: [
                            { $sort: sortOptions },
                            { $skip: (p - 1) * lt },
                            { $limit: lt },
                            {
                                $project: {
                                    _id: 1,
                                    title: 1,
                                    type: 1,
                                    totalScore: 1,
                                    createdAt: 1,
                                    updatedAt: 1,
                                },
                            },
                        ],
                    },
                },
            ]).exec();
            const totalCount = ((_b = results.totalCount[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
            const userForms = results.data.map((form) => (Object.assign(Object.assign({}, form), { isFilled: filledFormIds.includes(form._id) })));
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                    userForms,
                    totalCount,
                } }));
        }
        catch (error) {
            console.error("Error in handleUserQuery:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    });
}
// Helper function to build base query based on tab type
function buildBaseQuery(tab, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (tab) {
            case Form_model_1.DashboardTabType.all:
                return {
                    $or: [
                        { user: userId },
                        { editors: { $in: [userId] } },
                        { owners: { $in: [userId] } },
                    ],
                };
            case Form_model_1.DashboardTabType.myform:
                return {
                    $or: [{ user: userId }, { owners: { $in: [userId] } }],
                };
            case Form_model_1.DashboardTabType.otherform:
                return {
                    editors: { $in: [userId] },
                    user: { $ne: userId }, // Exclude forms owned by the user
                };
            case Form_model_1.DashboardTabType.filledform:
                // Optimized: Use aggregation to get form IDs directly
                const filledFormIds = yield Response_model_1.default.distinct("formId", { userId });
                return {
                    _id: { $in: filledFormIds },
                };
            default:
                throw new Error(`Invalid tab type: ${tab}`);
        }
    });
}
// Helper function to build filter query
function buildFilterQuery(filter) {
    const filterQuery = {};
    if (filter === null || filter === void 0 ? void 0 : filter.query) {
        const searchQuery = filter.query.trim();
        if (searchQuery) {
            filterQuery.title = { $regex: searchQuery, $options: "i" };
        }
    }
    if (filter === null || filter === void 0 ? void 0 : filter.type) {
        filterQuery.type = filter.type;
    }
    return filterQuery;
}
// Helper function to build sort options
function buildSortOptions(filter) {
    var _a, _b;
    const sortOptions = {};
    if ((_a = filter === null || filter === void 0 ? void 0 : filter.sort) === null || _a === void 0 ? void 0 : _a.createdAt) {
        sortOptions.createdAt = filter.sort.createdAt;
    }
    if ((_b = filter === null || filter === void 0 ? void 0 : filter.sort) === null || _b === void 0 ? void 0 : _b.updatedAt) {
        sortOptions.updatedAt = filter.sort.updatedAt;
    }
    if (Object.keys(sortOptions).length === 0) {
        sortOptions.updatedAt = -1;
    }
    return sortOptions;
}
function ValidateFormBeforeAction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, action } = req.query;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        const validation = (0, formHelpers_1.validateFormRequest)(formId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        try {
            const form = yield Form_model_1.default.findById(formId)
                .select("user owners editors")
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, user.id)) {
                return res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
            }
            const [validationSummary, errors] = yield Promise.all([
                SolutionValidationService_1.default.validateForm(formId),
                SolutionValidationService_1.default.getFormValidationErrors(formId),
            ]);
            const canProceed = action === "send_form" ? errors.length === 0 : true;
            const warnings = action === "send_form" ? [] : errors;
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors: action === "send_form" ? errors : [], warnings,
                    canProceed,
                    action, hasAccess: formHelpers_1.hasFormAccess, isOwner: (0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.owner, form, user.id), isEditor: (0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.editor, form, user.id) }) }));
        }
        catch (error) {
            console.error("Validate Form Before Action Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
        }
    });
}
const GetFilledForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { formId, responseId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!(0, formHelpers_1.isValidObjectIdString)(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        }
        const formObjectId = new mongoose_1.Types.ObjectId(formId);
        const userObjectId = new mongoose_1.Types.ObjectId(user.id);
        const form = yield Form_model_1.default.findById(formObjectId).lean();
        if (!form) {
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        }
        const responseQuery = {
            formId: formObjectId,
            userId: userObjectId,
        };
        if (responseId && (0, formHelpers_1.isValidObjectIdString)(responseId)) {
            responseQuery._id = new mongoose_1.Types.ObjectId(responseId);
        }
        //Get User Response
        const userResponses = yield Response_model_1.default.find({
            $and: [
                { formId: responseQuery.formId },
                { userId: responseQuery.userId },
            ],
        })
            .populate({
            path: "responseset.question",
            select: "-hasAnswer -isValidated -page -require",
        })
            .sort({ submittedAt: -1 }) // get in descending order
            .lean();
        if (userResponses.length === 0) {
            return res
                .status(404)
                .json((0, helper_1.ReturnCode)(404, "No responses found for this form"));
        }
        //Data mutation
        let currentResponse = userResponses[0];
        if (responseId && (0, formHelpers_1.isValidObjectIdString)(responseId)) {
            const specificResponse = userResponses.find((resp) => resp._id.toString() === responseId);
            if (specificResponse) {
                currentResponse = specificResponse;
            }
        }
        const formatResponseData = (response) => (Object.assign(Object.assign({}, response), { submittedAt: response.submittedAt
                ? (0, helper_1.FormatToGeneralDate)(response.submittedAt)
                : undefined, updatedAt: response.updatedAt
                ? (0, helper_1.FormatToGeneralDate)(response.updatedAt)
                : undefined }));
        const responseData = {
            response: formatResponseData(currentResponse),
            //All user response
            userResponses: userResponses.map((i) => i._id),
        };
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Filled form data retrieved successfully")), { data: responseData }));
    }
    catch (error) {
        console.error("Get Filled Form Error:", error);
        return res
            .status(500)
            .json((0, helper_1.ReturnCode)(500, "Failed to retrieve filled form data"));
    }
});
exports.GetFilledForm = GetFilledForm;
