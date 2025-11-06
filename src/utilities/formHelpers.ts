import { Types } from "mongoose";
import { FormType, CollaboratorType } from "../model/Form.model";
import Formsession from "../model/Formsession.model";
import FormsessionService from "../controller/formsession.controller";
import { Response } from "express";
import { getDateByMinute } from "./helper";

// Helper function to validate ObjectId format
export function isValidObjectIdString(id: string): boolean {
  return (
    typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)
  );
}

export function hasFormAccess(form: FormType, userId: Types.ObjectId): boolean {
  try {
    const userIdStr = userId.toString();
    const HaveAccessID = new Set<string>();

    form.editors?.forEach((i) => HaveAccessID.add(i._id.toString()));
    form.owners?.forEach((i) => HaveAccessID.add(i._id.toString()));

    //Verify creator
    form.user.equals(userId) && HaveAccessID.add(userId.toString());

    return HaveAccessID.has(userIdStr);
  } catch (error) {
    console.error("Error in hasFormAccess:", error);
    return false;
  }
}

export function isPrimaryOwner(form: FormType, userId: string): boolean {
  try {
    const userIdStr = userId.toString();
    let formUserId: string;

    if (form.user && typeof form.user === "object" && form.user._id) {
      formUserId = form.user._id.toString();
    } else if (form.user) {
      formUserId = form.user.toString();
    } else {
      return false;
    }

    return formUserId === userIdStr;
  } catch (error) {
    console.error("Error in isPrimaryOwner:", error);
    return false;
  }
}

export function verifyRole(
  role: CollaboratorType,
  form: FormType,
  userId: Types.ObjectId
): boolean {
  const user_id = userId.toString();

  if (role === CollaboratorType.creator) {
    return user_id === form.user.toString();
  }

  return role === CollaboratorType.editor
    ? form.editors?.some((i) => i.toString() === user_id) ?? false
    : form.owners?.some((i) => i.toString() === user_id) ?? false;
}

// Centralized access validation helper
export function validateAccess(form: any, userId: Types.ObjectId) {
  const userIdStr = userId?.toString();
  const isCreator = isPrimaryOwner(form, userIdStr);
  const isOwner = verifyRole(CollaboratorType.owner, form, userId);
  const isEditor = verifyRole(CollaboratorType.editor, form, userId);
  const hasAccess = isCreator || isOwner || isEditor;

  return { hasAccess, isCreator, isOwner, isEditor };
}

// Optimized projections for different use cases
export const projections = {
  basic: "title type createdAt updatedAt user owners",
  detail:
    "title type createdAt updatedAt totalpage setting contentIds user owners editors",
  minimal: "_id title type user owners editors",
  total: "totalpage totalscore contentIds user owners editors",
  setting: "_id title type setting user owners editors",
};

// Common validation logic
export function validateFormRequest(formId: string, userId?: string) {
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
