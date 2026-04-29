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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageFormCollaborator = void 0;
exports.ConfirmAddCollaborator = ConfirmAddCollaborator;
exports.GetFormCollaborators = GetFormCollaborators;
exports.RemoveSelfFromForm = RemoveSelfFromForm;
exports.ChangePrimaryOwner = ChangePrimaryOwner;
exports.ConfirmOwnershipTransfer = ConfirmOwnershipTransfer;
exports.CancelOwnershipTransfer = CancelOwnershipTransfer;
exports.ResendPendingInvitation = ResendPendingInvitation;
exports.DeletePendingCollaborator = DeletePendingCollaborator;
const helper_1 = require("../../utilities/helper");
const MongoErrorHandler_1 = require("../../utilities/MongoErrorHandler");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const User_model_1 = __importDefault(require("../../model/User.model"));
const formHelpers_1 = require("../../utilities/formHelpers");
const FormLinkService_1 = __importDefault(require("../../services/FormLinkService"));
const EmailService_1 = __importDefault(require("../../services/EmailService"));
const CollarboratorEmail_1 = require("../../utilities/EmailTemplate/CollarboratorEmail");
const ManageFormCollaborator = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    //debug ID
    const operationId = MongoErrorHandler_1.MongoErrorHandler.generateOperationId("manage_collaborator");
    try {
        const { formId, email, role, action } = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(401));
        if (!email || (action === "remove" ? false : !role) || !action || !formId)
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing required fields"));
        if ((action === "add" &&
            ![Form_model_1.CollaboratorType.owner, Form_model_1.CollaboratorType.editor].includes(role)) ||
            !["add", "remove"].includes(action) ||
            !(0, formHelpers_1.isValidObjectIdString)(formId) ||
            !email ||
            (action === "remove" ? false : !role) ||
            !action ||
            !formId)
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        const form = yield Form_model_1.default.findById(formId)
            .populate("user", "email _id")
            .lean();
        if (!form)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        const { isCreator, isOwner } = (0, formHelpers_1.validateAccess)(form, new mongoose_1.Types.ObjectId(user.sub));
        if (action === "remove" || role !== Form_model_1.CollaboratorType.editor
            ? !isCreator
            : !(isCreator || isOwner))
            return res
                .status(403)
                .json((0, helper_1.ReturnCode)(403, "Only form owner can manage collaborators"));
        const targetUser = yield User_model_1.default.findOne({ email }).exec();
        if (!targetUser)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "User not found"));
        if (targetUser._id.toString() === user.sub)
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
                // Check if there's already a pending invite for this user
                const existingPendingInvite = (_a = form.pendingCollarborators) === null || _a === void 0 ? void 0 : _a.find((pc) => pc.user.toString() === collaboratorId.toString());
                //Generate Unique Code
                const FormService = new FormLinkService_1.default();
                let isUnique = false;
                let inviteCode = FormService.generateInviteCode();
                while (!isUnique) {
                    if (!form.pendingCollarborators) {
                        isUnique = true;
                        break;
                    }
                    const isCode = form.pendingCollarborators.some((c) => c.code == inviteCode);
                    if (isCode) {
                        inviteCode = FormService.generateInviteCode();
                    }
                    else
                        isUnique = true;
                }
                //Generate invite link with expiration (24 hours)
                const expiresInHours = 24;
                const generatedInviteLink = FormService.generateInviteLink({
                    inviteCode,
                    formId,
                    role,
                }, `/collaborator/confirm`, expiresInHours);
                //Calculate expiration timestamp
                const expireIn = Date.now() + expiresInHours * 60 * 60 * 1000;
                // Replace existing pending invite or add new one
                if (existingPendingInvite) {
                    // Update existing pending collaborator with new code and expiration
                    yield Form_model_1.default.findOneAndUpdate({ _id: formId, "pendingCollarborators.user": collaboratorId }, {
                        $set: {
                            "pendingCollarborators.$.code": inviteCode,
                            "pendingCollarborators.$.expireIn": expireIn,
                        },
                    });
                }
                else {
                    // Add new pending collaborator
                    yield Form_model_1.default.findByIdAndUpdate(formId, {
                        $addToSet: {
                            pendingCollarborators: {
                                _id: new mongoose_1.Types.ObjectId(),
                                code: inviteCode,
                                expireIn,
                                user: collaboratorId,
                            },
                        },
                    });
                }
                //Get inviter's email for the email content
                const inviter = yield User_model_1.default.findById(user.sub).lean();
                const inviterEmail = (inviter === null || inviter === void 0 ? void 0 : inviter.email) || "A form owner";
                //Send invite email
                const emailService = new EmailService_1.default();
                const emailSent = yield emailService.sendEmail({
                    to: [email],
                    subject: `Invitation to Collaborate on Form: ${form.title}`,
                    html: (0, CollarboratorEmail_1.generateCollaboratorInviteEmail)({
                        inviterEmail,
                        formTitle: form.title,
                        role,
                        inviteUrl: generatedInviteLink.url,
                        expiresInHours,
                    }),
                });
                if (!emailSent) {
                    //Rollback pending collaborator if email fails
                    yield Form_model_1.default.findByIdAndUpdate(formId, {
                        $pull: {
                            pendingCollarborators: { code: inviteCode },
                        },
                    });
                    return res
                        .status(500)
                        .json((0, helper_1.ReturnCode)(500, "Failed to send invitation email"));
                }
                return res
                    .status(200)
                    .json((0, helper_1.ReturnCode)(200, `Invitation sent to ${email}`));
            }
            else {
                if (!currentList.some((id) => id.toString() === collaboratorId.toString())) {
                    return res.status(400).json((0, helper_1.ReturnCode)(400, `User is not a ${role}`));
                }
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $pull: { [currentField]: collaboratorId },
                });
                return res
                    .status(200)
                    .json((0, helper_1.ReturnCode)(200, `User successfully removed from ${role}`));
            }
        }
        return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid role specified"));
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
//User confirmation for collaborator
function ConfirmAddCollaborator(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { invite } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!invite) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing invite code"));
        }
        try {
            //Decrypt and validate the invite link
            const formLinkService = new FormLinkService_1.default();
            const validation = formLinkService.validateInviteLink(invite);
            if (!validation.valid || !validation.data) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, validation.error || "Invalid invite link"));
            }
            const { inviteCode, formId, role } = validation.data;
            //Validate required fields from decrypted data
            if (!inviteCode || !formId || !role) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid invite data"));
            }
            if (!(0, formHelpers_1.isValidObjectIdString)(formId)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
            }
            //Find the form and verify pending collaborator
            const form = yield Form_model_1.default.findById(formId).lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            //Find the pending collaborator entry
            const pendingCollaborator = (_a = form.pendingCollarborators) === null || _a === void 0 ? void 0 : _a.find((pc) => pc.code === inviteCode);
            if (!pendingCollaborator) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Invitation not found or has already been used"));
            }
            //Check if invitation has expired
            if (Date.now() > pendingCollaborator.expireIn) {
                //Remove expired invitation
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $pull: { pendingCollarborators: { code: inviteCode } },
                });
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invitation has expired"));
            }
            //Verify the current user is the intended recipient
            const pendingUserId = pendingCollaborator.user.toString();
            if (pendingUserId !== currentUser.sub) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "This invitation is not for you"));
            }
            //Determine the field to update based on role
            const targetField = role === Form_model_1.CollaboratorType.editor
                ? "editors"
                : role === Form_model_1.CollaboratorType.owner
                    ? "owners"
                    : undefined;
            if (!targetField) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid role"));
            }
            //Check if user is already a collaborator
            const currentList = form[targetField] || [];
            if (currentList.some((id) => id.toString() === currentUser.sub)) {
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $pull: { pendingCollarborators: { code: inviteCode } },
                });
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, `You are already a ${role} of this form`));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $addToSet: { [targetField]: new mongoose_1.Types.ObjectId(currentUser.sub) },
                $pull: { pendingCollarborators: { code: inviteCode } },
            });
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, `You have been added as ${role} to the form`)), { data: {
                    formId,
                    formTitle: form.title,
                    role,
                } }));
        }
        catch (error) {
            console.error("Confirm Collaborator Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to confirm collaboration"));
        }
    });
}
function GetFormCollaborators(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
                .populate("pendingCollarborators.user", "email")
                .populate("pendingOwnershipTransfer.fromUser", "email")
                .populate("pendingOwnershipTransfer.toUser", "email")
                .lean();
            if (!form)
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            if ((0, formHelpers_1.verifyRole)(Form_model_1.CollaboratorType.editor, form, new mongoose_1.Types.ObjectId(currentUser.sub)))
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
            // Get pending collaborators with user details
            const pendingCollaborators = ((_d = form.pendingCollarborators) === null || _d === void 0 ? void 0 : _d.map((pending) => {
                var _a;
                const pendingUser = pending.user;
                const isExpired = Date.now() > pending.expireIn;
                return {
                    _id: pending._id.toString(),
                    pendingId: pending._id.toString(),
                    email: (pendingUser === null || pendingUser === void 0 ? void 0 : pendingUser.email) || "Unknown",
                    name: ((_a = pendingUser === null || pendingUser === void 0 ? void 0 : pendingUser.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || "Unknown",
                    expireIn: pending.expireIn,
                    isExpired,
                    code: pending.code,
                };
            })) || [];
            // Get pending ownership transfer info if exists
            let pendingOwnershipTransfer = null;
            if (form.pendingOwnershipTransfer) {
                const fromUser = form.pendingOwnershipTransfer
                    .fromUser;
                const toUser = form.pendingOwnershipTransfer
                    .toUser;
                const isExpired = Date.now() > form.pendingOwnershipTransfer.expireIn;
                pendingOwnershipTransfer = {
                    _id: form.pendingOwnershipTransfer._id.toString(),
                    fromUser: {
                        _id: ((_e = fromUser._id) === null || _e === void 0 ? void 0 : _e.toString()) ||
                            form.pendingOwnershipTransfer.fromUser.toString(),
                        email: (fromUser === null || fromUser === void 0 ? void 0 : fromUser.email) || "Unknown",
                    },
                    toUser: {
                        _id: ((_f = toUser._id) === null || _f === void 0 ? void 0 : _f.toString()) ||
                            form.pendingOwnershipTransfer.toUser.toString(),
                        email: (toUser === null || toUser === void 0 ? void 0 : toUser.email) || "Unknown",
                    },
                    expireIn: form.pendingOwnershipTransfer.expireIn,
                    isExpired,
                };
            }
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form collaborators retrieved successfully")), { data: {
                    primaryOwner,
                    allOwners,
                    allEditors,
                    pendingCollaborators,
                    pendingOwnershipTransfer,
                    totalCollaborators: ((_g = allOwners === null || allOwners === void 0 ? void 0 : allOwners.length) !== null && _g !== void 0 ? _g : 0) + ((_h = allEditors === null || allEditors === void 0 ? void 0 : allEditors.length) !== null && _h !== void 0 ? _h : 0),
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
        const { formId } = req.params;
        const currentUser = req.user;
        if (!currentUser || !formId) {
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
            if ((0, formHelpers_1.isPrimaryOwner)(form, currentUser.sub)) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Primary owner cannot remove themselves. Transfer ownership first."));
            }
            const userObjectId = new mongoose_1.Types.ObjectId(currentUser.sub);
            const { hasAccess } = (0, formHelpers_1.validateAccess)(form, userObjectId);
            if (!hasAccess) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "You don't have access to this form"));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $pull: {
                    owners: userObjectId,
                    editors: userObjectId,
                },
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
        //Verify user session
        if (!currentUser)
            return res.status(403).json((0, helper_1.ReturnCode)(403));
        const validation = (0, formHelpers_1.validateFormRequest)(formId, userId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        try {
            const form = yield Form_model_1.default.findById(formId).populate("user", "email").lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            if (!(0, formHelpers_1.isPrimaryOwner)(form, currentUser.sub)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only primary owner can transfer ownership"));
            }
            // Get the target user
            const targetUser = yield User_model_1.default.findById(userId).lean();
            if (!targetUser) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "User not found"));
            }
            // Cannot transfer to yourself
            if (targetUser._id.toString() === currentUser.sub) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Cannot transfer ownership to yourself"));
            }
            // Generate invite code and link
            const FormService = new FormLinkService_1.default();
            const inviteCode = FormService.generateInviteCode();
            const expiresInHours = 24;
            const expireIn = Date.now() + expiresInHours * 60 * 60 * 1000;
            const generatedInviteLink = FormService.generateInviteLink({
                inviteCode,
                formId,
                type: "ownership_transfer",
            }, `/ownership/confirm`, expiresInHours);
            // Save pending ownership transfer
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                pendingOwnershipTransfer: {
                    _id: new mongoose_1.Types.ObjectId(),
                    code: inviteCode,
                    expireIn,
                    fromUser: new mongoose_1.Types.ObjectId(currentUser.sub),
                    toUser: new mongoose_1.Types.ObjectId(userId),
                },
            });
            // Get current owner's email for the email content
            const currentOwner = yield User_model_1.default.findById(currentUser.sub).lean();
            const currentOwnerEmail = (currentOwner === null || currentOwner === void 0 ? void 0 : currentOwner.email) || "The current owner";
            // Send invite email to the new owner
            const emailService = new EmailService_1.default();
            const emailSent = yield emailService.sendEmail({
                to: [targetUser.email],
                subject: `Ownership Transfer Request for Form: ${form.title}`,
                html: (0, CollarboratorEmail_1.generateOwnershipTransferEmail)({
                    currentOwnerEmail,
                    formTitle: form.title,
                    inviteUrl: generatedInviteLink.url,
                    expiresInHours,
                }),
            });
            if (!emailSent) {
                // Rollback pending ownership transfer if email fails
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $unset: { pendingOwnershipTransfer: 1 },
                });
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to send ownership transfer email"));
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, `Ownership transfer invitation sent to ${targetUser.email}. They must confirm to complete the transfer.`));
        }
        catch (error) {
            console.error("Transfer Owner Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
// Confirm ownership transfer
function ConfirmOwnershipTransfer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { invite } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!invite) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing invite code"));
        }
        try {
            // Decrypt and validate the invite link
            const formLinkService = new FormLinkService_1.default();
            const validation = formLinkService.validateInviteLink(invite);
            if (!validation.valid || !validation.data) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, validation.error || "Invalid invite link"));
            }
            const { inviteCode, formId, type } = validation.data;
            // Validate this is an ownership transfer link
            if (type !== "ownership_transfer") {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid invite type"));
            }
            // Validate required fields from decrypted data
            if (!inviteCode || !formId) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid invite data"));
            }
            if (!(0, formHelpers_1.isValidObjectIdString)(formId)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
            }
            // Find the form and verify pending ownership transfer
            const form = yield Form_model_1.default.findById(formId)
                .populate("pendingOwnershipTransfer.fromUser", "email")
                .populate("pendingOwnershipTransfer.toUser", "email")
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            // Check if there's a pending ownership transfer
            if (!form.pendingOwnershipTransfer) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "No pending ownership transfer found or it has already been completed"));
            }
            const pendingTransfer = form.pendingOwnershipTransfer;
            // Verify the invite code matches
            if (pendingTransfer.code !== inviteCode) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid invite code"));
            }
            // Check if invitation has expired
            if (Date.now() > pendingTransfer.expireIn) {
                // Remove expired invitation
                yield Form_model_1.default.findByIdAndUpdate(formId, {
                    $unset: { pendingOwnershipTransfer: 1 },
                });
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Ownership transfer invitation has expired"));
            }
            // Verify the current user is the intended recipient (toUser)
            const toUserId = pendingTransfer.toUser._id
                ? pendingTransfer.toUser._id.toString()
                : pendingTransfer.toUser.toString();
            if (toUserId !== currentUser.sub) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "This ownership transfer invitation is not for you"));
            }
            // Get the fromUser ID (current owner)
            const fromUserId = pendingTransfer.fromUser._id
                ? pendingTransfer.fromUser._id.toString()
                : pendingTransfer.fromUser.toString();
            // Build the update operations
            const updateOps = {
                $set: { user: new mongoose_1.Types.ObjectId(currentUser.sub) },
                $addToSet: { owners: new mongoose_1.Types.ObjectId(fromUserId) },
                $unset: { pendingOwnershipTransfer: 1 },
            };
            yield Form_model_1.default.findByIdAndUpdate(formId, updateOps);
            // Remove new owner from owners/editors list if they were there
            // Only pull from arrays that exist
            const pullOps = {};
            if (Array.isArray(form.owners)) {
                pullOps.owners = new mongoose_1.Types.ObjectId(currentUser.sub);
            }
            if (Array.isArray(form.editors)) {
                pullOps.editors = new mongoose_1.Types.ObjectId(currentUser.sub);
            }
            if (Object.keys(pullOps).length > 0) {
                yield Form_model_1.default.findByIdAndUpdate(formId, { $pull: pullOps });
            }
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Ownership transfer completed successfully. You are now the primary owner of this form.")), { data: {
                    formId,
                    formTitle: form.title,
                    role: "CREATOR",
                } }));
        }
        catch (error) {
            console.error("Confirm Ownership Transfer Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to confirm ownership transfer"));
        }
    });
}
// Cancel pending ownership transfer
function CancelOwnershipTransfer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing form ID"));
        }
        if (!(0, formHelpers_1.isValidObjectIdString)(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId).lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            // Only the current primary owner can cancel the transfer
            if (!(0, formHelpers_1.isPrimaryOwner)(form, currentUser.sub)) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only the primary owner can cancel the ownership transfer"));
            }
            if (!form.pendingOwnershipTransfer) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "No pending ownership transfer to cancel"));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $unset: { pendingOwnershipTransfer: 1 },
            });
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, "Ownership transfer cancelled successfully"));
        }
        catch (error) {
            console.error("Cancel Ownership Transfer Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to cancel ownership transfer"));
        }
    });
}
// Resend invitation to pending collaborator
function ResendPendingInvitation(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { formId, pendingId } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId || !pendingId) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing required fields"));
        }
        if (!(0, formHelpers_1.isValidObjectIdString)(formId) || !(0, formHelpers_1.isValidObjectIdString)(pendingId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid IDs"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId)
                .populate("pendingCollarborators.user", "email")
                .lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            const { isCreator, isOwner } = (0, formHelpers_1.validateAccess)(form, new mongoose_1.Types.ObjectId(currentUser.sub));
            if (!isCreator && !isOwner) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only form owner can resend invitations"));
            }
            const pendingCollaborator = (_a = form.pendingCollarborators) === null || _a === void 0 ? void 0 : _a.find((pc) => pc._id.toString() === pendingId);
            if (!pendingCollaborator) {
                return res
                    .status(404)
                    .json((0, helper_1.ReturnCode)(404, "Pending invitation not found"));
            }
            const pendingUser = pendingCollaborator.user;
            if (!(pendingUser === null || pendingUser === void 0 ? void 0 : pendingUser.email)) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "User email not found"));
            }
            // Generate new invite code and link
            const FormService = new FormLinkService_1.default();
            let isUnique = false;
            let newInviteCode = FormService.generateInviteCode();
            while (!isUnique) {
                const isCode = (_b = form.pendingCollarborators) === null || _b === void 0 ? void 0 : _b.some((c) => c.code === newInviteCode && c._id.toString() !== pendingId);
                if (!isCode)
                    isUnique = true;
                else
                    newInviteCode = FormService.generateInviteCode();
            }
            const expiresInHours = 24;
            const role = Form_model_1.CollaboratorType.owner; // Default to owner, could be stored in pending
            const generatedInviteLink = FormService.generateInviteLink({
                inviteCode: newInviteCode,
                formId,
                role,
            }, `/collaborator/confirm`, expiresInHours);
            const newExpireIn = Date.now() + expiresInHours * 60 * 60 * 1000;
            // Update pending collaborator with new code and expiration
            yield Form_model_1.default.updateOne({ _id: formId, "pendingCollarborators._id": pendingId }, {
                $set: {
                    "pendingCollarborators.$.code": newInviteCode,
                    "pendingCollarborators.$.expireIn": newExpireIn,
                },
            });
            // Get inviter's email
            const inviter = yield User_model_1.default.findById(currentUser.sub).lean();
            const inviterEmail = (inviter === null || inviter === void 0 ? void 0 : inviter.email) || "A form owner";
            // Send new invite email
            const emailService = new EmailService_1.default();
            const emailSent = yield emailService.sendEmail({
                to: [pendingUser.email],
                subject: `Reminder: Invitation to Collaborate on Form: ${form.title}`,
                html: (0, CollarboratorEmail_1.generateCollaboratorReminderEmail)({
                    inviterEmail,
                    formTitle: form.title,
                    role,
                    inviteUrl: generatedInviteLink.url,
                    expiresInHours,
                }),
            });
            if (!emailSent) {
                return res
                    .status(500)
                    .json((0, helper_1.ReturnCode)(500, "Failed to resend invitation email"));
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, `Invitation resent to ${pendingUser.email}`));
        }
        catch (error) {
            console.error("Resend Pending Invitation Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to resend invitation"));
        }
    });
}
// Delete pending collaborator invitation
function DeletePendingCollaborator(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { formId, pendingId } = req.body;
        const currentUser = req.user;
        if (!currentUser) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!formId || !pendingId) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Missing required fields"));
        }
        if (!(0, formHelpers_1.isValidObjectIdString)(formId) || !(0, formHelpers_1.isValidObjectIdString)(pendingId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid IDs"));
        }
        try {
            const form = yield Form_model_1.default.findById(formId).lean();
            if (!form) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            const { isCreator, isOwner } = (0, formHelpers_1.validateAccess)(form, new mongoose_1.Types.ObjectId(currentUser.sub));
            if (!isCreator && !isOwner) {
                return res
                    .status(403)
                    .json((0, helper_1.ReturnCode)(403, "Only form owner can delete pending invitations"));
            }
            const pendingCollaborator = (_a = form.pendingCollarborators) === null || _a === void 0 ? void 0 : _a.find((pc) => pc._id.toString() === pendingId);
            if (!pendingCollaborator) {
                return res
                    .status(404)
                    .json((0, helper_1.ReturnCode)(404, "Pending invitation not found"));
            }
            yield Form_model_1.default.findByIdAndUpdate(formId, {
                $pull: { pendingCollarborators: { _id: new mongoose_1.Types.ObjectId(pendingId) } },
            });
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, "Pending invitation deleted successfully"));
        }
        catch (error) {
            console.error("Delete Pending Collaborator Error:", error);
            return res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to delete pending invitation"));
        }
    });
}
