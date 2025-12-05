import { Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import { MongoErrorHandler } from "../../utilities/MongoErrorHandler";
import Form, { CollaboratorType } from "../../model/Form.model";
import { CustomRequest } from "../../types/customType";
import { Types } from "mongoose";
import User, { UserType } from "../../model/User.model";
import {
  isValidObjectIdString,
  isPrimaryOwner,
  verifyRole,
  validateAccess,
  validateFormRequest,
} from "../../utilities/formHelpers";
import FormLinkService from "../../services/FormLinkService";
import EmailService from "../../services/EmailService";
import {
  generateCollaboratorInviteEmail,
  generateOwnershipTransferEmail,
  generateCollaboratorReminderEmail,
} from "../../utilities/EmailTemplate/CollarboratorEmail";

interface CollaboratorRequest {
  formId: string;
  userEmail?: Array<string>;
  userId?: string;
  role?: CollaboratorType;
}

interface ManageFormCollaboratorBodyType {
  formId: string;
  email: string;
  role: CollaboratorType;
  action: "add" | "remove";
}

interface FormCollarboratorDataType {
  _id: string;
  name?: string;
  email: string;
  role: CollaboratorType;
  isPrimary?: boolean;
}

export const ManageFormCollaborator = async (
  req: CustomRequest,
  res: Response
) => {
  //debug ID
  const operationId = MongoErrorHandler.generateOperationId(
    "manage_collaborator"
  );

  try {
    const { formId, email, role, action } =
      req.body as ManageFormCollaboratorBodyType;
    const user = req.user;

    if (!user) return res.status(401).json(ReturnCode(401));

    if (!email || (action === "remove" ? false : !role) || !action || !formId)
      return res.status(400).json(ReturnCode(400, "Missing required fields"));

    if (
      (action === "add" &&
        ![CollaboratorType.owner, CollaboratorType.editor].includes(role)) ||
      !["add", "remove"].includes(action) ||
      !isValidObjectIdString(formId) ||
      !email ||
      (action === "remove" ? false : !role) ||
      !action ||
      !formId
    )
      return res.status(400).json(ReturnCode(400));

    const form = await Form.findById(formId)
      .populate("user", "email _id")
      .lean();
    if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));
    const { isCreator, isOwner } = validateAccess(
      form,
      new Types.ObjectId(user.sub)
    );

    if (
      action === "remove" || role !== CollaboratorType.editor
        ? !isCreator
        : !(isCreator || isOwner)
    )
      return res
        .status(403)
        .json(ReturnCode(403, "Only form owner can manage collaborators"));

    const targetUser = await User.findOne({ email }).exec();
    if (!targetUser)
      return res.status(404).json(ReturnCode(404, "User not found"));
    if (targetUser._id.toString() === user.sub)
      return res
        .status(400)
        .json(ReturnCode(400, "Cannot modify your own permissions"));

    const collaboratorId = targetUser._id;
    const currentField =
      role === CollaboratorType.editor
        ? "editors"
        : role === CollaboratorType.owner
        ? "owners"
        : undefined;
    const currentList =
      (currentField &&
        (form[currentField as keyof typeof form] as Types.ObjectId[])) ||
      [];

    if (currentField) {
      if (action === "add") {
        if (
          currentList.some((id) => id.toString() === collaboratorId.toString())
        ) {
          return res
            .status(400)
            .json(ReturnCode(400, `User is already a ${role}`));
        }

        // Check if there's already a pending invite for this user
        const existingPendingInvite = form.pendingCollarborators?.find(
          (pc) => pc.user.toString() === collaboratorId.toString()
        );

        //Generate Unique Code
        const FormService = new FormLinkService();
        let isUnique = false;
        let inviteCode = FormService.generateInviteCode();
        while (!isUnique) {
          if (!form.pendingCollarborators) {
            isUnique = true;
            break;
          }
          const isCode = form.pendingCollarborators.some(
            (c) => c.code == inviteCode
          );

          if (isCode) {
            inviteCode = FormService.generateInviteCode();
          } else isUnique = true;
        }

        //Generate invite link with expiration (24 hours)
        const expiresInHours = 24;
        const generatedInviteLink = FormService.generateInviteLink(
          {
            inviteCode,
            formId,
            role,
          },
          `/collaborator/confirm`,
          expiresInHours
        );

        //Calculate expiration timestamp
        const expireIn = Date.now() + expiresInHours * 60 * 60 * 1000;

        // Replace existing pending invite or add new one
        if (existingPendingInvite) {
          // Update existing pending collaborator with new code and expiration
          await Form.findOneAndUpdate(
            { _id: formId, "pendingCollarborators.user": collaboratorId },
            {
              $set: {
                "pendingCollarborators.$.code": inviteCode,
                "pendingCollarborators.$.expireIn": expireIn,
              },
            }
          );
        } else {
          // Add new pending collaborator
          await Form.findByIdAndUpdate(formId, {
            $addToSet: {
              pendingCollarborators: {
                _id: new Types.ObjectId(),
                code: inviteCode,
                expireIn,
                user: collaboratorId,
              },
            },
          });
        }

        //Get inviter's email for the email content
        const inviter = await User.findById(user.sub).lean();
        const inviterEmail = inviter?.email || "A form owner";

        //Send invite email
        const emailService = new EmailService();
        const emailSent = await emailService.sendEmail({
          to: [email],
          subject: `Invitation to Collaborate on Form: ${form.title}`,
          html: generateCollaboratorInviteEmail({
            inviterEmail,
            formTitle: form.title,
            role,
            inviteUrl: generatedInviteLink.url,
            expiresInHours,
          }),
        });

        if (!emailSent) {
          //Rollback pending collaborator if email fails
          await Form.findByIdAndUpdate(formId, {
            $pull: {
              pendingCollarborators: { code: inviteCode },
            },
          });
          return res
            .status(500)
            .json(ReturnCode(500, "Failed to send invitation email"));
        }

        return res
          .status(200)
          .json(ReturnCode(200, `Invitation sent to ${email}`));
      } else {
        if (
          !currentList.some((id) => id.toString() === collaboratorId.toString())
        ) {
          return res.status(400).json(ReturnCode(400, `User is not a ${role}`));
        }
        await Form.findByIdAndUpdate(formId, {
          $pull: { [currentField]: collaboratorId },
        });

        return res
          .status(200)
          .json(ReturnCode(200, `User successfully removed from ${role}`));
      }
    }

    return res.status(400).json(ReturnCode(400, "Invalid role specified"));
  } catch (error) {
    console.error(`[${operationId}] Error managing form collaborator:`, error);

    const mongoErrorHandled = MongoErrorHandler.handleMongoError(error, res, {
      operationId,
      customMessage: "Failed to manage form collaborator",
    });

    if (!mongoErrorHandled.handled) {
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  }
};

//User confirmation for collaborator
export async function ConfirmAddCollaborator(
  req: CustomRequest,
  res: Response
) {
  const { invite }: { invite: string } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!invite) {
    return res.status(400).json(ReturnCode(400, "Missing invite code"));
  }

  try {
    //Decrypt and validate the invite link
    const formLinkService = new FormLinkService();
    const validation = formLinkService.validateInviteLink(invite);

    if (!validation.valid || !validation.data) {
      return res
        .status(400)
        .json(ReturnCode(400, validation.error || "Invalid invite link"));
    }

    const { inviteCode, formId, role } = validation.data as {
      inviteCode: string;
      formId: string;
      role: CollaboratorType;
    };

    //Validate required fields from decrypted data
    if (!inviteCode || !formId || !role) {
      return res.status(400).json(ReturnCode(400, "Invalid invite data"));
    }

    if (!isValidObjectIdString(formId)) {
      return res.status(400).json(ReturnCode(400, "Invalid form ID"));
    }

    //Find the form and verify pending collaborator
    const form = await Form.findById(formId).lean();
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    //Find the pending collaborator entry
    const pendingCollaborator = form.pendingCollarborators?.find(
      (pc) => pc.code === inviteCode
    );

    if (!pendingCollaborator) {
      return res
        .status(400)
        .json(ReturnCode(400, "Invitation not found or has already been used"));
    }

    //Check if invitation has expired
    if (Date.now() > pendingCollaborator.expireIn) {
      //Remove expired invitation
      await Form.findByIdAndUpdate(formId, {
        $pull: { pendingCollarborators: { code: inviteCode } },
      });
      return res.status(400).json(ReturnCode(400, "Invitation has expired"));
    }

    //Verify the current user is the intended recipient
    const pendingUserId = pendingCollaborator.user.toString();
    if (pendingUserId !== currentUser.sub) {
      return res
        .status(403)
        .json(ReturnCode(403, "This invitation is not for you"));
    }

    //Determine the field to update based on role
    const targetField =
      role === CollaboratorType.editor
        ? "editors"
        : role === CollaboratorType.owner
        ? "owners"
        : undefined;

    if (!targetField) {
      return res.status(400).json(ReturnCode(400, "Invalid role"));
    }

    //Check if user is already a collaborator
    const currentList =
      (form[targetField as keyof typeof form] as Types.ObjectId[]) || [];
    if (currentList.some((id) => id.toString() === currentUser.sub)) {
      await Form.findByIdAndUpdate(formId, {
        $pull: { pendingCollarborators: { code: inviteCode } },
      });
      return res
        .status(400)
        .json(ReturnCode(400, `You are already a ${role} of this form`));
    }

    await Form.findByIdAndUpdate(formId, {
      $addToSet: { [targetField]: new Types.ObjectId(currentUser.sub) },
      $pull: { pendingCollarborators: { code: inviteCode } },
    });

    return res.status(200).json({
      ...ReturnCode(200, `You have been added as ${role} to the form`),
      data: {
        formId,
        formTitle: form.title,
        role,
      },
    });
  } catch (error) {
    console.error("Confirm Collaborator Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to confirm collaboration"));
  }
}

export async function GetFormCollaborators(req: CustomRequest, res: Response) {
  const { formId } = req.params;
  const currentUser = req.user;

  if (!currentUser)
    return res.status(401).json(ReturnCode(401, "Unauthorized"));

  const validation = validateFormRequest(formId);
  if (!validation.isValid)
    return res.status(400).json(ReturnCode(400, validation.error));

  try {
    const form = await Form.findById(formId)
      .populate("user owners editors", "email")
      .populate("pendingCollarborators.user", "email")
      .populate("pendingOwnershipTransfer.fromUser", "email")
      .populate("pendingOwnershipTransfer.toUser", "email")
      .lean();
    if (!form) return res.status(404).json(ReturnCode(404, "Form not found"));

    if (
      verifyRole(
        CollaboratorType.editor,
        form,
        new Types.ObjectId(currentUser.sub)
      )
    )
      return res.status(403).json(ReturnCode(403, "Access denied"));

    const formCreator = form.user as unknown as UserType;
    const primaryOwner: FormCollarboratorDataType = {
      _id: formCreator._id.toString(),
      name: formCreator.email?.split("@")[0] || "Unknown",
      email: formCreator.email,
      role: CollaboratorType.creator,
      isPrimary: true,
    };

    const allOwners =
      form.owners &&
      (form.owners as unknown as UserType[])?.map((i) => ({
        _id: i._id,
        email: i.email,
        name: i.email?.split("@")[0] || "Unknown",
        role: CollaboratorType.owner,
      }));
    const allEditors =
      form.editors &&
      (form.editors as unknown as UserType[])?.map((i) => ({
        _id: i._id,
        email: i.email,
        name: i.email?.split("@")[0] || "Unknown",
        role: CollaboratorType.editor,
      }));

    // Get pending collaborators with user details
    const pendingCollaborators =
      form.pendingCollarborators?.map((pending) => {
        const pendingUser = pending.user as unknown as UserType;
        const isExpired = Date.now() > pending.expireIn;
        return {
          _id: pending._id.toString(),
          pendingId: pending._id.toString(),
          email: pendingUser?.email || "Unknown",
          name: pendingUser?.email?.split("@")[0] || "Unknown",
          expireIn: pending.expireIn,
          isExpired,
          code: pending.code,
        };
      }) || [];

    // Get pending ownership transfer info if exists
    let pendingOwnershipTransfer = null;
    if (form.pendingOwnershipTransfer) {
      const fromUser = form.pendingOwnershipTransfer
        .fromUser as unknown as UserType;
      const toUser = form.pendingOwnershipTransfer
        .toUser as unknown as UserType;
      const isExpired = Date.now() > form.pendingOwnershipTransfer.expireIn;
      pendingOwnershipTransfer = {
        _id: form.pendingOwnershipTransfer._id.toString(),
        fromUser: {
          _id:
            fromUser._id?.toString() ||
            form.pendingOwnershipTransfer.fromUser.toString(),
          email: fromUser?.email || "Unknown",
        },
        toUser: {
          _id:
            toUser._id?.toString() ||
            form.pendingOwnershipTransfer.toUser.toString(),
          email: toUser?.email || "Unknown",
        },
        expireIn: form.pendingOwnershipTransfer.expireIn,
        isExpired,
      };
    }

    return res.status(200).json({
      ...ReturnCode(200, "Form collaborators retrieved successfully"),
      data: {
        primaryOwner,
        allOwners,
        allEditors,
        pendingCollaborators,
        pendingOwnershipTransfer,
        totalCollaborators:
          (allOwners?.length ?? 0) + (allEditors?.length ?? 0),
      },
    });
  } catch (error) {
    console.error("Get Form Collaborators Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to retrieve collaborators"));
  }
}

export async function RemoveSelfFromForm(req: CustomRequest, res: Response) {
  const { formId } = req.params;
  const currentUser = req.user;

  if (!currentUser || !formId) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  const validation = validateFormRequest(formId);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (isPrimaryOwner(form, currentUser.sub)) {
      return res
        .status(400)
        .json(
          ReturnCode(
            400,
            "Primary owner cannot remove themselves. Transfer ownership first."
          )
        );
    }

    const userObjectId = new Types.ObjectId(currentUser.sub);
    const { hasAccess } = validateAccess(form, userObjectId);

    if (!hasAccess) {
      return res
        .status(403)
        .json(ReturnCode(403, "You don't have access to this form"));
    }

    await Form.findByIdAndUpdate(formId, {
      $pull: {
        owners: userObjectId,
        editors: userObjectId,
      },
    });

    return res
      .status(200)
      .json(ReturnCode(200, "Successfully removed from form"));
  } catch (error) {
    console.error("Remove Self From Form Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to remove from form"));
  }
}

export async function ChangePrimaryOwner(req: CustomRequest, res: Response) {
  const { formId, userId } = req.body as CollaboratorRequest;
  const currentUser = req.user;

  //Verify user session
  if (!currentUser) return res.status(403).json(ReturnCode(403));

  const validation = validateFormRequest(formId, userId);
  if (!validation.isValid) {
    return res.status(400).json(ReturnCode(400, validation.error));
  }

  try {
    const form = await Form.findById(formId).populate("user", "email").lean();
    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    if (!isPrimaryOwner(form, currentUser.sub)) {
      return res
        .status(403)
        .json(ReturnCode(403, "Only primary owner can transfer ownership"));
    }

    // Get the target user
    const targetUser = await User.findById(userId).lean();
    if (!targetUser) {
      return res.status(404).json(ReturnCode(404, "User not found"));
    }

    // Cannot transfer to yourself
    if (targetUser._id.toString() === currentUser.sub) {
      return res
        .status(400)
        .json(ReturnCode(400, "Cannot transfer ownership to yourself"));
    }

    // Generate invite code and link
    const FormService = new FormLinkService();
    const inviteCode = FormService.generateInviteCode();
    const expiresInHours = 24;
    const expireIn = Date.now() + expiresInHours * 60 * 60 * 1000;

    const generatedInviteLink = FormService.generateInviteLink(
      {
        inviteCode,
        formId,
        type: "ownership_transfer",
      },
      `/ownership/confirm`,
      expiresInHours
    );

    // Save pending ownership transfer
    await Form.findByIdAndUpdate(formId, {
      pendingOwnershipTransfer: {
        _id: new Types.ObjectId(),
        code: inviteCode,
        expireIn,
        fromUser: new Types.ObjectId(currentUser.sub),
        toUser: new Types.ObjectId(userId),
      },
    });

    // Get current owner's email for the email content
    const currentOwner = await User.findById(currentUser.sub).lean();
    const currentOwnerEmail = currentOwner?.email || "The current owner";

    // Send invite email to the new owner
    const emailService = new EmailService();
    const emailSent = await emailService.sendEmail({
      to: [targetUser.email],
      subject: `Ownership Transfer Request for Form: ${form.title}`,
      html: generateOwnershipTransferEmail({
        currentOwnerEmail,
        formTitle: form.title,
        inviteUrl: generatedInviteLink.url,
        expiresInHours,
      }),
    });

    if (!emailSent) {
      // Rollback pending ownership transfer if email fails
      await Form.findByIdAndUpdate(formId, {
        $unset: { pendingOwnershipTransfer: 1 },
      });
      return res
        .status(500)
        .json(ReturnCode(500, "Failed to send ownership transfer email"));
    }

    return res
      .status(200)
      .json(
        ReturnCode(
          200,
          `Ownership transfer invitation sent to ${targetUser.email}. They must confirm to complete the transfer.`
        )
      );
  } catch (error) {
    console.error("Transfer Owner Error:", error);
    return res.status(500).json(ReturnCode(500));
  }
}

// Confirm ownership transfer
export async function ConfirmOwnershipTransfer(
  req: CustomRequest,
  res: Response
) {
  const { invite }: { invite: string } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!invite) {
    return res.status(400).json(ReturnCode(400, "Missing invite code"));
  }

  try {
    // Decrypt and validate the invite link
    const formLinkService = new FormLinkService();
    const validation = formLinkService.validateInviteLink(invite);

    if (!validation.valid || !validation.data) {
      return res
        .status(400)
        .json(ReturnCode(400, validation.error || "Invalid invite link"));
    }

    const { inviteCode, formId, type } = validation.data as {
      inviteCode: string;
      formId: string;
      type: string;
    };

    // Validate this is an ownership transfer link
    if (type !== "ownership_transfer") {
      return res.status(400).json(ReturnCode(400, "Invalid invite type"));
    }

    // Validate required fields from decrypted data
    if (!inviteCode || !formId) {
      return res.status(400).json(ReturnCode(400, "Invalid invite data"));
    }

    if (!isValidObjectIdString(formId)) {
      return res.status(400).json(ReturnCode(400, "Invalid form ID"));
    }

    // Find the form and verify pending ownership transfer
    const form = await Form.findById(formId)
      .populate("pendingOwnershipTransfer.fromUser", "email")
      .populate("pendingOwnershipTransfer.toUser", "email")
      .lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    // Check if there's a pending ownership transfer
    if (!form.pendingOwnershipTransfer) {
      return res
        .status(400)
        .json(
          ReturnCode(
            400,
            "No pending ownership transfer found or it has already been completed"
          )
        );
    }

    const pendingTransfer = form.pendingOwnershipTransfer;

    // Verify the invite code matches
    if (pendingTransfer.code !== inviteCode) {
      return res.status(400).json(ReturnCode(400, "Invalid invite code"));
    }

    // Check if invitation has expired
    if (Date.now() > pendingTransfer.expireIn) {
      // Remove expired invitation
      await Form.findByIdAndUpdate(formId, {
        $unset: { pendingOwnershipTransfer: 1 },
      });
      return res
        .status(400)
        .json(ReturnCode(400, "Ownership transfer invitation has expired"));
    }

    // Verify the current user is the intended recipient (toUser)
    const toUserId = pendingTransfer.toUser._id
      ? pendingTransfer.toUser._id.toString()
      : pendingTransfer.toUser.toString();

    if (toUserId !== currentUser.sub) {
      return res
        .status(403)
        .json(
          ReturnCode(403, "This ownership transfer invitation is not for you")
        );
    }

    // Get the fromUser ID (current owner)
    const fromUserId = pendingTransfer.fromUser._id
      ? pendingTransfer.fromUser._id.toString()
      : pendingTransfer.fromUser.toString();

    await Form.findByIdAndUpdate(formId, {
      $set: { user: new Types.ObjectId(currentUser.sub) },
      $addToSet: { owners: new Types.ObjectId(fromUserId) },
      $unset: { pendingOwnershipTransfer: 1 },
    });

    // Remove new owner from owners/editors list if they were there
    await Form.findByIdAndUpdate(formId, {
      $pull: {
        owners: new Types.ObjectId(currentUser.sub),
        editors: new Types.ObjectId(currentUser.sub),
      },
    });

    return res.status(200).json({
      ...ReturnCode(
        200,
        "Ownership transfer completed successfully. You are now the primary owner of this form."
      ),
      data: {
        formId,
        formTitle: form.title,
        role: "CREATOR",
      },
    });
  } catch (error) {
    console.error("Confirm Ownership Transfer Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to confirm ownership transfer"));
  }
}

// Cancel pending ownership transfer
export async function CancelOwnershipTransfer(
  req: CustomRequest,
  res: Response
) {
  const { formId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId) {
    return res.status(400).json(ReturnCode(400, "Missing form ID"));
  }

  if (!isValidObjectIdString(formId)) {
    return res.status(400).json(ReturnCode(400, "Invalid form ID"));
  }

  try {
    const form = await Form.findById(formId).lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    // Only the current primary owner can cancel the transfer
    if (!isPrimaryOwner(form, currentUser.sub)) {
      return res
        .status(403)
        .json(
          ReturnCode(
            403,
            "Only the primary owner can cancel the ownership transfer"
          )
        );
    }

    if (!form.pendingOwnershipTransfer) {
      return res
        .status(400)
        .json(ReturnCode(400, "No pending ownership transfer to cancel"));
    }

    await Form.findByIdAndUpdate(formId, {
      $unset: { pendingOwnershipTransfer: 1 },
    });

    return res
      .status(200)
      .json(ReturnCode(200, "Ownership transfer cancelled successfully"));
  } catch (error) {
    console.error("Cancel Ownership Transfer Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to cancel ownership transfer"));
  }
}

// Resend invitation to pending collaborator
export async function ResendPendingInvitation(
  req: CustomRequest,
  res: Response
) {
  const { formId, pendingId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId || !pendingId) {
    return res.status(400).json(ReturnCode(400, "Missing required fields"));
  }

  if (!isValidObjectIdString(formId) || !isValidObjectIdString(pendingId)) {
    return res.status(400).json(ReturnCode(400, "Invalid IDs"));
  }

  try {
    const form = await Form.findById(formId)
      .populate("pendingCollarborators.user", "email")
      .lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    const { isCreator, isOwner } = validateAccess(
      form,
      new Types.ObjectId(currentUser.sub)
    );

    if (!isCreator && !isOwner) {
      return res
        .status(403)
        .json(ReturnCode(403, "Only form owner can resend invitations"));
    }

    const pendingCollaborator = form.pendingCollarborators?.find(
      (pc) => pc._id.toString() === pendingId
    );

    if (!pendingCollaborator) {
      return res
        .status(404)
        .json(ReturnCode(404, "Pending invitation not found"));
    }

    const pendingUser = pendingCollaborator.user as unknown as UserType;
    if (!pendingUser?.email) {
      return res.status(400).json(ReturnCode(400, "User email not found"));
    }

    // Generate new invite code and link
    const FormService = new FormLinkService();
    let isUnique = false;
    let newInviteCode = FormService.generateInviteCode();
    while (!isUnique) {
      const isCode = form.pendingCollarborators?.some(
        (c) => c.code === newInviteCode && c._id.toString() !== pendingId
      );
      if (!isCode) isUnique = true;
      else newInviteCode = FormService.generateInviteCode();
    }

    const expiresInHours = 24;
    const role = CollaboratorType.owner; // Default to owner, could be stored in pending
    const generatedInviteLink = FormService.generateInviteLink(
      {
        inviteCode: newInviteCode,
        formId,
        role,
      },
      `/collaborator/confirm`,
      expiresInHours
    );

    const newExpireIn = Date.now() + expiresInHours * 60 * 60 * 1000;

    // Update pending collaborator with new code and expiration
    await Form.updateOne(
      { _id: formId, "pendingCollarborators._id": pendingId },
      {
        $set: {
          "pendingCollarborators.$.code": newInviteCode,
          "pendingCollarborators.$.expireIn": newExpireIn,
        },
      }
    );

    // Get inviter's email
    const inviter = await User.findById(currentUser.sub).lean();
    const inviterEmail = inviter?.email || "A form owner";

    // Send new invite email
    const emailService = new EmailService();
    const emailSent = await emailService.sendEmail({
      to: [pendingUser.email],
      subject: `Reminder: Invitation to Collaborate on Form: ${form.title}`,
      html: generateCollaboratorReminderEmail({
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
        .json(ReturnCode(500, "Failed to resend invitation email"));
    }

    return res
      .status(200)
      .json(ReturnCode(200, `Invitation resent to ${pendingUser.email}`));
  } catch (error) {
    console.error("Resend Pending Invitation Error:", error);
    return res.status(500).json(ReturnCode(500, "Failed to resend invitation"));
  }
}

// Delete pending collaborator invitation
export async function DeletePendingCollaborator(
  req: CustomRequest,
  res: Response
) {
  const { formId, pendingId } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    return res.status(401).json(ReturnCode(401, "Unauthorized"));
  }

  if (!formId || !pendingId) {
    return res.status(400).json(ReturnCode(400, "Missing required fields"));
  }

  if (!isValidObjectIdString(formId) || !isValidObjectIdString(pendingId)) {
    return res.status(400).json(ReturnCode(400, "Invalid IDs"));
  }

  try {
    const form = await Form.findById(formId).lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    const { isCreator, isOwner } = validateAccess(
      form,
      new Types.ObjectId(currentUser.sub)
    );

    if (!isCreator && !isOwner) {
      return res
        .status(403)
        .json(
          ReturnCode(403, "Only form owner can delete pending invitations")
        );
    }

    const pendingCollaborator = form.pendingCollarborators?.find(
      (pc) => pc._id.toString() === pendingId
    );

    if (!pendingCollaborator) {
      return res
        .status(404)
        .json(ReturnCode(404, "Pending invitation not found"));
    }

    await Form.findByIdAndUpdate(formId, {
      $pull: { pendingCollarborators: { _id: new Types.ObjectId(pendingId) } },
    });

    return res
      .status(200)
      .json(ReturnCode(200, "Pending invitation deleted successfully"));
  } catch (error) {
    console.error("Delete Pending Collaborator Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to delete pending invitation"));
  }
}
