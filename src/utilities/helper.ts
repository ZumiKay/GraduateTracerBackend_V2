import Bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import {
  ChoiceQuestionType,
  ContentTitle,
  ContentType,
  ParentContentType,
  QuestionType,
  RangeType,
} from "../model/Content.model";
import { ResponseSetType } from "../model/Response.model";

import { Response } from "express";

export type StatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 500;

export function ReturnCode(code: StatusCode, custommess?: string) {
  const returnValue = (code: number, message: string) => ({ code, message });

  let message = "";

  switch (code) {
    case 200:
      message = "Success";
      break;
    case 201:
      message = "Data Created";
      break;
    case 204:
      message = "No Content";
      return;
    case 400:
      message = "Bad Request";
      break;
    case 401:
      message = "Unauthenticated";
      break;
    case 403:
      message = "No Access";
      break;
    case 404:
      message = "Not Found";
      break;
    case 409:
      message = "Duplicated Detected";
      break;
    case 500:
      message = "Server Error";
      break;
    default:
      return;
  }

  return returnValue(code, custommess ?? message);
}

export function SendResponse<T = any>(
  res: Response,
  code: StatusCode,
  data?: T,
  message?: string,
): Response {
  const returnObj = ReturnCode(code, message);

  if (code === 204) {
    return res.status(204).send();
  }

  if (data !== undefined) {
    return res.status(code).json({
      ...returnObj,
      data,
    });
  }

  return res.status(code).json(returnObj);
}

// Convenient helper shortcuts
SendResponse.success = <T = any>(res: Response, data?: T, message?: string) =>
  SendResponse(res, 200, data, message);

SendResponse.created = <T = any>(res: Response, data?: T, message?: string) =>
  SendResponse(res, 201, data, message);

SendResponse.noContent = (res: Response) => SendResponse(res, 204);

SendResponse.badRequest = <T = any>(
  res: Response,
  message?: string,
  data?: T,
) => SendResponse(res, 400, data, message);

SendResponse.unauthorized = (res: Response, message?: string) =>
  SendResponse(res, 401, undefined, message);

SendResponse.forbidden = (res: Response, message?: string) =>
  SendResponse(res, 403, undefined, message);

SendResponse.notFound = (res: Response, message?: string) =>
  SendResponse(res, 404, undefined, message);

SendResponse.conflict = (res: Response, message?: string) =>
  SendResponse(res, 409, undefined, message);

SendResponse.error = (res: Response, message?: string) =>
  SendResponse(res, 500, undefined, message);

/**
 * Formats a date to dd-mm-yyyy format
 *
 */
export const formatDateToDDMMYYYY = (date: Date | string | number): string => {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Converts a ContentTitle object or string to a plain string
 */
export const convertTitleToString = (
  title: ContentTitle | string | undefined | null,
  fallback: string = "Question",
): string => {
  if (!title) return fallback;

  if (typeof title === "string") return title;

  // If title has a text property directly
  if (title.text) return title.text;

  // If title has content array, extract text from it
  if (title.content && Array.isArray(title.content)) {
    const texts: string[] = [];

    const extractText = (items: ContentTitle[]): void => {
      for (const item of items) {
        if (item.text) {
          texts.push(item.text);
        }
        if (item.content && Array.isArray(item.content)) {
          extractText(item.content);
        }
      }
    };

    extractText(title.content);
    const result = texts.join(" ").trim();
    return result || fallback;
  }

  return fallback;
};

/**
 * Converts response value to string, handling object types
 *
 * @param value - Response value (can be string, number, object, etc.)
 * @returns String representation of the value
 */
export const convertResponseToString = (value: any): string => {
  if (value === null || value === undefined || value === "") {
    return "No Response";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((v) => convertResponseToString(v)).join(", ");
  }

    // Handle objects with key/val structure (like CheckBox)
    if (value.key && value.val) {
      if (Array.isArray(value.key) && Array.isArray(value.val)) {
        return value.key
          .map((k: any, i: number) => `${k}: ${value.val[i]}`)
          .join(", ");
      }
      return `${value.key}: ${value.val}`;
    }

    // Handle range objects
    if (value.start !== undefined && value.end !== undefined) {
      return `${value.start} to ${value.end}`;
    }

    if (value.val !== undefined) {
      return String(value.val);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

export const ValidatePassword = (pass: string) => {
  const hasNumber = /\d/.test(pass);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
  if (pass.length < 8 || !hasNumber || !hasSpecialChar) {
    return false;
  }
  return true;
};

export const hashedPassword = (pass: string) => {
  const salt = Bcrypt.genSaltSync(10);
  const hased = Bcrypt.hashSync(pass, salt);

  return hased;
};

export const RandomNumber = (length: number) => {
  if (length < 1) throw new Error("Length must be a positive integer");

  const min = Math.pow(10, length - 1); // Smallest number with 'length' digits
  const max = Math.pow(10, length) - 1; // Largest number with 'length' digits

  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const GenerateToken = (
  payload: Record<string, any>,
  expiresIn: number | string,
  customSecret?: string,
) => {
  const token = JWT.sign(
    payload,
    customSecret ?? (process.env.JWT_SECRET || "secret"),
    {
      expiresIn,
      algorithm: "HS256",
    },
  );

  return token;
};

/**
 * @param token - JWT token string to verify and decode
 * @param customSecret - Optional custom secret key (defaults to process.env.JWT_SECRET)
 * @param ignoreExpiration - If true, will not throw error for expired tokens (default: false)
 *
 */
export const ExtractTokenPayload = ({
  token,
  customSecret,
  ignoreExpiration = false,
}: {
  token: string;
  customSecret?: string;
  ignoreExpiration?: boolean;
}): JWT.JwtPayload | string | null => {
  try {
    // Validate token format
    if (!token || typeof token !== "string" || token.trim() === "") {
      console.error("ExtractTokenPayload: Invalid token format");
      return null;
    }

    // Validate secret
    const secret = customSecret ?? process.env.JWT_SECRET;
    if (!secret) {
      console.error("ExtractTokenPayload: JWT secret is not configured");
      return null;
    }

    // Verify and decode token
    const payload = JWT.verify(token, secret, {
      ignoreExpiration,
      algorithms: ["HS256"], // Explicit algorithm for security
    });

    return payload;
  } catch (error) {
    if (error instanceof JWT.TokenExpiredError) {
      console.error("ExtractTokenPayload: Token has expired", {
        expiredAt: error.expiredAt,
      });
    } else if (error instanceof JWT.JsonWebTokenError) {
      console.error("ExtractTokenPayload: Invalid token", {
        message: error.message,
      });
    } else if (error instanceof JWT.NotBeforeError) {
      console.error("ExtractTokenPayload: Token not active yet", {
        date: error.date,
      });
    } else {
      console.error("ExtractTokenPayload: Unexpected error", error);
    }
    return null;
  }
};

export const getDateByNumDay = (add: number): Date => {
  const today = new Date();
  today.setDate(today.getDate() + add); // Add 1 day
  return today;
};

export const getDateByMinute = (min: number) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + min);
  return now;
};

export const FormatToGeneralDate = (date: Date) => {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const groupContentByParent = (data: Array<ContentType>) => {
  if (!data.length) return [];

  const childrenMap = new Map<string, Array<ContentType>>();

  const processed = new Set<string>();

  const result: Array<ContentType> = [];

  //Extract Child
  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (!item._id) continue;

    if (item.parentcontent?.qId) {
      const parentId = item.parentcontent.qId;

      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }

      childrenMap.get(parentId)!.push(item);
    }
  }

  const addWithChildren = (item: ContentType): void => {
    if (!item._id || processed.has(item._id.toString())) return;

    // Add the item itself
    result.push(item);
    processed.add(item._id.toString());

    const children = childrenMap.get(item._id.toString());
    if (children && children.length > 0) {
      // Sort children by qIdx in ascending order (lower qIdx first)
      children.sort((a, b) => {
        const aIdx = a.qIdx || 0;
        const bIdx = b.qIdx || 0;
        return aIdx - bIdx; // Ascending order
      });

      for (const child of children) {
        addWithChildren(child);
      }
    }
  };

  const topLevelItems = data.filter((item) => item._id && !item.parentcontent);

  topLevelItems.sort((a, b) => {
    const aIdx = a.qIdx || 0;
    const bIdx = b.qIdx || 0;
    return aIdx - bIdx; // Ascending order for top-level items
  });

  for (const item of topLevelItems) {
    if (!processed.has(item._id?.toString()!)) {
      addWithChildren(item);
    }
  }

  //Others
  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (item._id && !processed.has(item._id.toString())) {
      addWithChildren(item);
    }
  }

  return result;
};

/**
 * Adds hierarchical question numbering to questions
 * Main questions: 1, 2, 3
 * Conditional questions: 3.1, 3.2
 * Sub-conditional questions: 3.1.1, 3.1.2
 *
 * @param questions - Array of questions
 * @returns Array of questions with (questionId)
 */

export const MAX_QUESTION_DEPTH = 20;

/**
 * Returns the nesting depth of a single question (1 = top-level, 2 = first
 * conditional child, etc.)
 */
export const getQuestionDepth = (
  question: ContentType,
  byId: Map<string, ContentType>,
  byQIdx: Map<number, ContentType>,
): number => {
  let depth = 1;
  const visited = new Set<string>();
  let current: ContentType = question;

  while (current.parentcontent) {
    const key =
      current.parentcontent.qId ||
      (current.parentcontent.qIdx !== undefined
        ? `qIdx_${current.parentcontent.qIdx}`
        : null);

    if (!key || visited.has(key)) break; //Break loop
    visited.add(key);

    const parent =
      byId.get(current.parentcontent.qId ?? "") ||
      (current.parentcontent.qIdx !== undefined
        ? byQIdx.get(current.parentcontent.qIdx)
        : undefined);

    if (!parent) break;
    depth++;
    current = parent;
  }

  return depth;
};

/**
 * Validates that no question in the array exceeds `maxDepth` nesting levels.
 */
export const validateNestingDepth = (
  questions: ContentType[],
  maxDepth: number = MAX_QUESTION_DEPTH,
): string | null => {
  if (!questions || questions.length === 0) return null;

  // Build lookup maps once
  const byId = new Map<string, ContentType>();
  const byQIdx = new Map<number, ContentType>();
  for (const q of questions) {
    if (q._id) byId.set(q._id.toString(), q);
    if (q.qIdx !== undefined) byQIdx.set(q.qIdx, q);
  }

  const exceedDepth: string[] = [];
  for (const q of questions) {
    const depth = getQuestionDepth(q, byId, byQIdx);
    if (depth > maxDepth) {
      const label =
        q.qIdx !== undefined
          ? `qIdx ${q.qIdx}`
          : (q._id?.toString() ?? "unknown");
      exceedDepth.push(`${label} (depth ${depth})`);
    }
  }

  return exceedDepth.length > 0
    ? `Question nesting exceeds maximum depth of ${maxDepth}: ${exceedDepth.join(", ")}`
    : null;
};

export const AddQuestionNumbering = ({
  questions,
  lastIdx,
}: {
  questions: Array<ContentType>;
  lastIdx?: number;
}): Array<ContentType> => {
  if (!questions || questions.length === 0) return [];

  const questionIdMap = new Map<string, string>();

  const getParentId = (question: ContentType): string | null => {
    if (!question.parentcontent) return null;
    if (question.parentcontent.qId) return question.parentcontent.qId;
    if (question.parentcontent.qIdx !== undefined)
      return `temp_${question.parentcontent.qIdx}`;
    return null;
  };

  const getQuestionId = (question: ContentType): string =>
    question._id ? question._id.toString() : `temp_${question.qIdx}`;

  const isTopLevel = (question: ContentType): boolean =>
    !question.parentcontent ||
    (question.parentcontent.qIdx === undefined && !question.parentcontent.qId);

  // Build parent → sorted children map
  const parentChildrenMap = new Map<
    string,
    Array<{ question: ContentType; index: number }>
  >();
  questions.forEach((question, index) => {
    const parentId = getParentId(question);
    if (parentId) {
      if (!parentChildrenMap.has(parentId)) parentChildrenMap.set(parentId, []);
      parentChildrenMap.get(parentId)!.push({ question, index });
    }
  });
  parentChildrenMap.forEach((siblings) =>
    siblings.sort((a, b) => {
      const diff = (a.question.qIdx ?? 0) - (b.question.qIdx ?? 0);
      return diff !== 0 ? diff : a.index - b.index;
    }),
  );

  let topLevelCount = lastIdx ?? 0;

  const buildNumber = (question: ContentType, index: number): string => {
    if (isTopLevel(question)) return `${++topLevelCount}`;

    const parentId = getParentId(question)!;
    const parentNumber =
      questionIdMap.get(parentId) ??
      questions.find(
        (q) =>
          q._id?.toString() === parentId ||
          (parentId.startsWith("temp_") &&
            q.qIdx === parseInt(parentId.replace("temp_", ""), 10)),
      )?.questionId ??
      `${index + 1}`;

    const siblings = parentChildrenMap.get(parentId) ?? [];
    const position =
      siblings.findIndex(
        (s) => getQuestionId(s.question) === getQuestionId(question),
      ) + 1;

    return `${parentNumber}.${position}`;
  };

  return questions.map((question, index) => {
    const questionId = buildNumber(question, index);
    questionIdMap.set(getQuestionId(question), questionId);

    const parentId = getParentId(question);
    const updatedParentContent = parentId
      ? { ...question.parentcontent, questionId: questionIdMap.get(parentId) }
      : question.parentcontent;

    return {
      ...question,
      questionId,
      parentcontent: updatedParentContent as ParentContentType,
    };
  });
};

//Extract Answer Key Value
export const GetAnswerKeyPairValue = (content: ResponseSetType) => {
  const questionContent = content.question;
  const questionType = (questionContent as ContentType).type;
  const response = content.response;

  if (
    questionType !== QuestionType.CheckBox &&
    questionType !== QuestionType.MultipleChoice &&
    questionType !== QuestionType.Selection
  ) {
    return response;
  }

  const choices = questionContent[
    questionType as never
  ] as Array<ChoiceQuestionType>;
  if (!choices || !Array.isArray(choices)) {
    return { key: response, val: response };
  }

  if (questionType === QuestionType.CheckBox && Array.isArray(response)) {
    const selectedChoices = choices
      .filter((choice) => response.includes(choice.idx))
      .map((choice) => choice.content);

    return { key: response, val: selectedChoices };
  }

  const matchingChoice = choices.find((choice) => choice.idx === response);
  const val = matchingChoice?.content ?? response;

  return { key: response, val };
};

export const GetAnswerKeyForQuestion = (content: ContentType) => {
  if (
    content.type !== QuestionType.CheckBox &&
    content.type !== QuestionType.MultipleChoice &&
    content.type !== QuestionType.Selection
  ) {
    return content.answer;
  }

  if (content.type === QuestionType.CheckBox) {
    const val = content.checkbox;
    const answerkey = content.answer?.answer as Array<number>;

    if (!answerkey || !Array.isArray(answerkey) || !val) return;

    const result = val
      .map((i) => {
        if (answerkey.includes(i.idx)) {
          return { key: i.idx, val: i.content };
        }
      })
      .filter(Boolean);
    return result;
  }
  return content[content.type]?.filter(
    (i) => i.idx === content.answer?.answer,
  )?.[0];
};

/**
 *Convert TipTab JSON Content to string  */
export const contentTitleToString = (
  contentTitle: ContentTitle | null | undefined,
): string => {
  if (!contentTitle) {
    return "";
  }

  const result = processContentTitleInternal(contentTitle);

  // Clean up extra spaces but preserve line breaks
  return result
    .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space (but not line breaks)
    .replace(/\n[ \t]+/g, "\n") // Remove spaces/tabs after line breaks
    .replace(/[ \t]+\n/g, "\n") // Remove spaces/tabs before line breaks
    .replace(/\n\n+/g, "\n") // Replace multiple line breaks with single line break
    .trim(); // Remove leading/trailing whitespace
};
const processContentTitleInternal = (contentTitle: ContentTitle): string => {
  if (contentTitle.type === "text" && contentTitle.text) {
    return contentTitle.text;
  }

  if (contentTitle.content && Array.isArray(contentTitle.content)) {
    const processedContent = contentTitle.content
      .map((item: ContentTitle) => processContentTitleInternal(item))
      .filter((text: string) => text !== ""); // Only filter completely empty strings, not whitespace-only

    // Handle specific node types with their formatting
    switch (contentTitle.type) {
      case "doc":
        // For documents, add space between block elements but preserve line breaks
        return processedContent.join(" ");

      case "paragraph":
        // For paragraphs, preserve line breaks but don't add extra spacing
        return processedContent.join("");

      case "heading":
        // For headings, preserve content and add space after
        return processedContent.join("");

      case "bulletList":
      case "orderedList":
        return processedContent.join("\n");

      case "listItem":
        return "• " + processedContent.join("");

      case "blockquote":
        return "> " + processedContent.join("") + " ";

      case "codeBlock":
        return "```\n" + processedContent.join("") + "\n``` ";

      case "table":
        return processedContent.join("\n") + "\n";

      case "tableRow":
        return processedContent.join(" | ") + " ";

      case "tableCell":
      case "tableHeader":
        return processedContent.join("");

      default:
        return processedContent.join(" ");
    }
  }

  // Handle specific node types without content
  switch (contentTitle.type) {
    case "hardBreak":
      return "\n";

    case "horizontalRule":
      return "\n---\n";

    case "image":
      const alt = contentTitle.attrs?.alt || "";
      const src = contentTitle.attrs?.src || "";
      return alt ? `[Image: ${alt}]` : `[Image: ${src}]`;

    case "mention":
      const mentionLabel =
        contentTitle.attrs?.label || contentTitle.attrs?.id || "";
      return `@${mentionLabel}`;

    case "emoji":
      return contentTitle.attrs?.emoji || "";

    default:
      if (contentTitle.text) {
        return contentTitle.text;
      }
      return "";
  }
};

/**
 * Converts ISO date string to Unix timestamp (milliseconds)
 *
 * @param isoString - ISO 8601 date string
 * @returns Unix timestamp in milliseconds, or NaN if invalid
 *
 * @example
 * ```typescript
 * const timestamp = ISODateToNumber("2025-10-24T00:00:00.000Z");
 * console.log(timestamp); // 1729728000000
 * ```
 */
const ISODateToNumber = (isoString: string): number => {
  if (!isoString || typeof isoString !== "string") {
    console.error("ISODateToNumber: Invalid input", isoString);
    return NaN;
  }

  const timestamp = new Date(isoString).getTime();

  if (isNaN(timestamp)) {
    console.error("ISODateToNumber: Invalid ISO date string", isoString);
  }

  return timestamp;
};

/**
 * Validates if a range value has valid start and end values
 *
 * @param value - Range object with start and end properties
 * @param isDate - If true, treats values as ISO date strings; otherwise as numbers
 * @returns true if range is valid (start < end), false otherwise
 *
 */
export const isRangeValueValid = (
  value: RangeType<string | number>,
  isDate?: boolean,
): boolean => {
  // Check if both start and end exist (0 is a valid value)
  if (
    value.start === null ||
    value.start === undefined ||
    value.end === null ||
    value.end === undefined
  ) {
    console.warn("isRangeValueValid: Missing start or end value", value);
    return false;
  }

  try {
    let startValue: number;
    let endValue: number;

    if (isDate) {
      // Handle date ranges
      startValue = ISODateToNumber(value.start as string);
      endValue = ISODateToNumber(value.end as string);

      if (isNaN(startValue) || isNaN(endValue)) {
        console.error("isRangeValueValid: Invalid date string(s)", value);
        return false;
      }
    } else {
      // Handle number ranges
      startValue =
        typeof value.start === "string" ? parseFloat(value.start) : value.start;
      endValue =
        typeof value.end === "string" ? parseFloat(value.end) : value.end;

      if (isNaN(startValue) || isNaN(endValue)) {
        console.error("isRangeValueValid: Invalid number value(s)", value);
        return false;
      }
    }

    const isValid = startValue <= endValue;

    if (!isValid) {
      console.warn("isRangeValueValid: Start value is greater than end value", {
        start: startValue,
        end: endValue,
      });
    }

    return isValid;
  } catch (error) {
    console.error("isRangeValueValid: Error validating range", error, value);
    return false;
  }
};
