"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckCondition = exports.hasArrayChange = exports.FormatToGeneralDate = exports.getDateByMinute = exports.getDateByNumDay = exports.GenerateToken = exports.RandomNumber = exports.hashedPassword = exports.ValidatePassword = void 0;
exports.ReturnCode = ReturnCode;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function ReturnCode(code, custommess) {
    const returnValue = (code, message) => ({ code, message });
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
    return returnValue(code, custommess !== null && custommess !== void 0 ? custommess : message);
}
const ValidatePassword = (pass) => {
    const hasNumber = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    if (pass.length < 8 || !hasNumber || !hasSpecialChar) {
        return false;
    }
    return true;
};
exports.ValidatePassword = ValidatePassword;
const hashedPassword = (pass) => {
    const salt = bcrypt_1.default.genSaltSync(10);
    const hased = bcrypt_1.default.hashSync(pass, salt);
    return hased;
};
exports.hashedPassword = hashedPassword;
const RandomNumber = (length) => {
    if (length < 1)
        throw new Error("Length must be a positive integer");
    const min = Math.pow(10, length - 1); // Smallest number with 'length' digits
    const max = Math.pow(10, length) - 1; // Largest number with 'length' digits
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
exports.RandomNumber = RandomNumber;
const GenerateToken = (payload, expiresIn) => {
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || "secret", {
        expiresIn,
        algorithm: "HS256",
    });
    return token;
};
exports.GenerateToken = GenerateToken;
const getDateByNumDay = (add) => {
    const today = new Date();
    today.setDate(today.getDate() + add); // Add 1 day
    return today;
};
exports.getDateByNumDay = getDateByNumDay;
const getDateByMinute = (min) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + min);
    return now;
};
exports.getDateByMinute = getDateByMinute;
const FormatToGeneralDate = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};
exports.FormatToGeneralDate = FormatToGeneralDate;
const hasArrayChange = (arr1, arr2) => {
    function deepEqual(a, b) {
        if (a === b)
            return true;
        if (a == null || b == null)
            return false;
        if (typeof a !== typeof b)
            return false;
        if (a instanceof Date && b instanceof Date)
            return a.getTime() === b.getTime();
        // Handle Array comparison
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            return a.every((item, index) => deepEqual(item, b[index]));
        }
        // Handle Object comparison
        if (typeof a === "object") {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length)
                return false;
            if (!aKeys.every((key) => bKeys.includes(key)))
                return false;
            return aKeys.every((key) => deepEqual(a[key], b[key]));
        }
        return false;
    }
    if (arr1.length !== arr2.length)
        return false;
    // Element-wise deep comparison
    return arr1.every((item, index) => deepEqual(item, arr2[index]));
};
exports.hasArrayChange = hasArrayChange;
const CheckCondition = (allcontent, qId, qIdx) => {
    var _a, _b, _c, _d;
    console.log(qId, qIdx);
    const isConditional = allcontent.find((question) => {
        var _a;
        return (_a = question.conditional) === null || _a === void 0 ? void 0 : _a.some((cond) => qIdx ? cond.contentIdx === qIdx : cond.contentId === qId);
    });
    if (!isConditional) {
        return null;
    }
    return {
        qId: (_a = isConditional._id) !== null && _a !== void 0 ? _a : qId,
        qIdx: undefined,
        optIdx: (_d = (_c = (_b = isConditional.conditional) === null || _b === void 0 ? void 0 : _b.find((cond) => cond.contentId === qId)) === null || _c === void 0 ? void 0 : _c.key) !== null && _d !== void 0 ? _d : 0,
    };
};
exports.CheckCondition = CheckCondition;
