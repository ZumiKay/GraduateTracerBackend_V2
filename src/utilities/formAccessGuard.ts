import { Response } from "express";
import { Types } from "mongoose";
import Form from "../model/Form.model";
import { CustomRequest } from "../types/customType";
import { ReturnCode } from "./helper";
import { hasFormAccess, isValidObjectIdString } from "./formHelpers";

/**
 * Only the form's creator, owners and editors.
 */
export async function ensureFormAccess(
  req: CustomRequest,
  res: Response,
  formId: unknown,
): Promise<boolean> {
  const user = req.user;
  if (!user?.sub) {
    res.status(401).json(ReturnCode(401, "Unauthorized"));
    return false;
  }

  if (typeof formId !== "string" || !isValidObjectIdString(formId)) {
    res.status(400).json(ReturnCode(400, "Invalid request payload"));
    return false;
  }

  const form = await Form.findById(formId).select("user owners editors").lean();
  if (!form) {
    res.status(404).json(ReturnCode(404, "Form not found"));
    return false;
  }

  if (!hasFormAccess(form as never, new Types.ObjectId(user.sub))) {
    res.status(403).json(ReturnCode(403, "You have no access for this"));
    return false;
  }

  return true;
}
