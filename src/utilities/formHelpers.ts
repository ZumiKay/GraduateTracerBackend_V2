import { Types } from "mongoose";
import { FormType, CollaboratorType } from "../model/Form.model";
import Content, { QuestionType, RangeType } from "../model/Content.model";
import { ResponseAnswerType, ResponseSetType } from "../model/Response.model";
import { formatDateToDDMMYYYY } from "./helper";

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
  userId: Types.ObjectId,
): boolean {
  const user_id = userId.toString();

  if (role === CollaboratorType.creator) {
    return user_id === form.user.toString();
  }

  return role === CollaboratorType.editor
    ? (form.editors?.some((i) => i.toString() === user_id) ?? false)
    : (form.owners?.some((i) => i.toString() === user_id) ?? false);
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
    "title type createdAt updatedAt totalpage totalscore extraScore setting contentIds user owners editors pageVersions",
  minimal: "_id title type user owners editors",
  total: "totalpage totalscore extraScore contentIds user owners editors",
  setting: "_id title type setting user owners editors",
};

/**
 * Current content version of a page (0 when the page has never been saved
 * since versioning was introduced).
 */
export function getPageVersion(
  form: Pick<FormType, "pageVersions"> | null | undefined,
  page: number,
): number {
  const versions = form?.pageVersions;
  if (!versions) return 0;
  const value =
    versions instanceof Map
      ? versions.get(String(page))
      : (versions as Record<string, number>)[String(page)];
  return typeof value === "number" ? value : 0;
}

/**
 * Invalidates every page version of a form. Used when the page structure
 * changes (page deleted and later pages shifted), so any client holding an
 * older copy of any page gets a conflict instead of saving onto the wrong page.
 */
export function buildBumpedPageVersions(
  form: Pick<FormType, "pageVersions" | "totalpage">,
  totalPage: number,
): Record<string, number> {
  const versions = form.pageVersions;
  const current =
    versions instanceof Map
      ? Array.from(versions.values())
      : Object.values((versions as Record<string, number>) ?? {});
  const next = Math.max(0, ...current.filter((v) => typeof v === "number")) + 1;
  const bumped: Record<string, number> = {};
  for (let page = 1; page <= Math.max(totalPage, 1); page++) {
    bumped[String(page)] = next;
  }
  return bumped;
}

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

/**
 * Get the cumulative question count from previous pages
 * Counts only parent questions (non-conditional) from pages before the current page
 * Used for proper question numbering across paginated forms
 *
 * @param formId - The form ID (string or ObjectId)
 * @param page - Current page number
 * @returns The count of questions from previous pages
 */
export async function getLastQuestionIdx(
  formId: string | Types.ObjectId,
  page: number,
): Promise<number> {
  if (!page || page <= 1) {
    return 0;
  }

  return Content.countDocuments({
    formId,
    page: { $lt: page },
    $or: [{ parentcontent: { $exists: false } }, { parentcontent: null }],
  });
}

export function formatResponseValue({
  response,
  questionType,
}: {
  response: ResponseAnswerType;
  questionType: QuestionType;
}) {
  switch (questionType) {
    case QuestionType.Date: {
      return formatDateToDDMMYYYY(response as string);
    }

    case QuestionType.RangeDate: {
      const resp = response as RangeType<string>;
      const formattedRange: RangeType<string> = {
        start: formatDateToDDMMYYYY(resp.start),
        end: formatDateToDDMMYYYY(resp.end),
      };
      return formattedRange;
    }

    default:
      return response;
  }
}
