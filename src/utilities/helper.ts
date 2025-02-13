import Bcrypt from "bcrypt";

import JWT from "jsonwebtoken";

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
