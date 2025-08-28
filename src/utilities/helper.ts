import Bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import {
  ChoiceQuestionType,
  ContentType,
  ParentContentType,
  QuestionType,
} from "../model/Content.model";
import { ResponseSetType } from "../model/Response.model";

export function ReturnCode(
  code: 200 | 201 | 204 | 400 | 401 | 403 | 404 | 500,
  custommess?: string
) {
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
    case 500:
      message = "Server Error";
    default:
      return;
  }

  return returnValue(code, custommess ?? message);
}

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
  expiresIn: number | string
) => {
  const token = JWT.sign(payload, process.env.JWT_SECRET || "secret", {
    expiresIn,
    algorithm: "HS256",
  });

  return token;
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

export const hasArrayChange = (arr1: Array<object>, arr2: Array<object>) => {
  function deepEqual<t>(a: t, b: t): boolean {
    if (a === b) return true;

    if (a == null || b == null) return false;

    if (typeof a !== typeof b) return false;

    if (a instanceof Date && b instanceof Date)
      return a.getTime() === b.getTime();

    // Handle Array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }

    // Handle Object comparison
    if (typeof a === "object") {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);

      if (aKeys.length !== bKeys.length) return false;
      if (!aKeys.every((key) => bKeys.includes(key))) return false;

      return aKeys.every((key) => deepEqual(a[key as never], b[key as never]));
    }

    return false;
  }

  if (arr1.length !== arr2.length) return false;

  // Element-wise deep comparison
  return arr1.every((item, index) => deepEqual(item, arr2[index]));
};

export const CheckCondition = (
  allcontent: Array<ContentType>,
  qId: string,
  qIdx?: number
): ParentContentType | null => {
  console.log(qId, qIdx);

  const isConditional = allcontent.find((question) =>
    question.conditional?.some((cond) =>
      qIdx ? cond.contentIdx === qIdx : cond.contentId === (qId as never)
    )
  );

  if (!isConditional) {
    return null;
  }

  return {
    qId: isConditional._id?.toString() ?? qId,
    qIdx: undefined,
    optIdx:
      isConditional.conditional?.find(
        (cond) => cond.contentId === (qId as never)
      )?.key ?? 0,
  };
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
      // Sort children by qIdx in descending order (higher qIdx first)
      children.sort((a, b) => {
        const aIdx = a.qIdx || 0;
        const bIdx = b.qIdx || 0;
        return bIdx - aIdx; // Descending order
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

//Extract Answer Key Value
export const GetAnswerKeyPairValue = (content: ResponseSetType) => {
  const questionContent = content.question;
  const questionType = questionContent.type;
  const response = content.response;

  if (
    questionType !== QuestionType.CheckBox &&
    questionType !== QuestionType.MultipleChoice &&
    questionType !== QuestionType.Selection
  ) {
    return response;
  }

  const choices = questionContent[questionType] as Array<ChoiceQuestionType>;
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

    if (!answerkey || !val) return;

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
    (i) => i.idx === content.answer?.answer
  )?.[0];
};

export const isObject = (value: any) => {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
};
