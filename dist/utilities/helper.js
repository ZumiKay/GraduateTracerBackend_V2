"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringToBoolean = exports.contentTitleToString = exports.isObject = exports.GetAnswerKeyForQuestion = exports.GetAnswerKeyPairValue = exports.groupContentByParent = exports.CheckCondition = exports.hasArrayChange = exports.FormatToGeneralDate = exports.getDateByMinute = exports.getDateByNumDay = exports.ExtractTokenPaylod = exports.GenerateToken = exports.RandomNumber = exports.hashedPassword = exports.ValidatePassword = void 0;
exports.ReturnCode = ReturnCode;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Content_model_1 = require("../model/Content.model");
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
const ExtractTokenPaylod = ({ token }) => {
    const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "secret");
    return payload;
};
exports.ExtractTokenPaylod = ExtractTokenPaylod;
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
    var _a, _b, _c, _d, _e;
    console.log(qId, qIdx);
    const isConditional = allcontent.find((question) => {
        var _a;
        return (_a = question.conditional) === null || _a === void 0 ? void 0 : _a.some((cond) => qIdx ? cond.contentIdx === qIdx : cond.contentId === qId);
    });
    if (!isConditional) {
        return null;
    }
    return {
        qId: (_b = (_a = isConditional._id) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : qId,
        qIdx: undefined,
        optIdx: (_e = (_d = (_c = isConditional.conditional) === null || _c === void 0 ? void 0 : _c.find((cond) => cond.contentId === qId)) === null || _d === void 0 ? void 0 : _d.key) !== null && _e !== void 0 ? _e : 0,
    };
};
exports.CheckCondition = CheckCondition;
const groupContentByParent = (data) => {
    var _a, _b;
    if (!data.length)
        return [];
    const childrenMap = new Map();
    const processed = new Set();
    const result = [];
    //Extract Child
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item._id)
            continue;
        if ((_a = item.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) {
            const parentId = item.parentcontent.qId;
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId).push(item);
        }
    }
    const addWithChildren = (item) => {
        if (!item._id || processed.has(item._id.toString()))
            return;
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
        if (!processed.has((_b = item._id) === null || _b === void 0 ? void 0 : _b.toString())) {
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
exports.groupContentByParent = groupContentByParent;
//Extract Answer Key Value
const GetAnswerKeyPairValue = (content) => {
    var _a;
    const questionContent = content.question;
    const questionType = questionContent.type;
    const response = content.response;
    if (questionType !== Content_model_1.QuestionType.CheckBox &&
        questionType !== Content_model_1.QuestionType.MultipleChoice &&
        questionType !== Content_model_1.QuestionType.Selection) {
        return response;
    }
    const choices = questionContent[questionType];
    if (!choices || !Array.isArray(choices)) {
        return { key: response, val: response };
    }
    if (questionType === Content_model_1.QuestionType.CheckBox && Array.isArray(response)) {
        const selectedChoices = choices
            .filter((choice) => response.includes(choice.idx))
            .map((choice) => choice.content);
        return { key: response, val: selectedChoices };
    }
    const matchingChoice = choices.find((choice) => choice.idx === response);
    const val = (_a = matchingChoice === null || matchingChoice === void 0 ? void 0 : matchingChoice.content) !== null && _a !== void 0 ? _a : response;
    return { key: response, val };
};
exports.GetAnswerKeyPairValue = GetAnswerKeyPairValue;
const GetAnswerKeyForQuestion = (content) => {
    var _a, _b, _c;
    if (content.type !== Content_model_1.QuestionType.CheckBox &&
        content.type !== Content_model_1.QuestionType.MultipleChoice &&
        content.type !== Content_model_1.QuestionType.Selection) {
        return content.answer;
    }
    if (content.type === Content_model_1.QuestionType.CheckBox) {
        const val = content.checkbox;
        const answerkey = (_a = content.answer) === null || _a === void 0 ? void 0 : _a.answer;
        if (!answerkey || !val)
            return;
        const result = val
            .map((i) => {
            if (answerkey.includes(i.idx)) {
                return { key: i.idx, val: i.content };
            }
        })
            .filter(Boolean);
        return result;
    }
    return (_c = (_b = content[content.type]) === null || _b === void 0 ? void 0 : _b.filter((i) => { var _a; return i.idx === ((_a = content.answer) === null || _a === void 0 ? void 0 : _a.answer); })) === null || _c === void 0 ? void 0 : _c[0];
};
exports.GetAnswerKeyForQuestion = GetAnswerKeyForQuestion;
const isObject = (value) => {
    return (value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !(value instanceof RegExp));
};
exports.isObject = isObject;
const contentTitleToString = (contentTitle) => {
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
exports.contentTitleToString = contentTitleToString;
const processContentTitleInternal = (contentTitle) => {
    var _a, _b, _c, _d, _e;
    if (contentTitle.type === "text" && contentTitle.text) {
        return contentTitle.text;
    }
    if (contentTitle.content && Array.isArray(contentTitle.content)) {
        const processedContent = contentTitle.content
            .map((item) => processContentTitleInternal(item))
            .filter((text) => text !== ""); // Only filter completely empty strings, not whitespace-only
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
            const alt = ((_a = contentTitle.attrs) === null || _a === void 0 ? void 0 : _a.alt) || "";
            const src = ((_b = contentTitle.attrs) === null || _b === void 0 ? void 0 : _b.src) || "";
            return alt ? `[Image: ${alt}]` : `[Image: ${src}]`;
        case "mention":
            const mentionLabel = ((_c = contentTitle.attrs) === null || _c === void 0 ? void 0 : _c.label) || ((_d = contentTitle.attrs) === null || _d === void 0 ? void 0 : _d.id) || "";
            return `@${mentionLabel}`;
        case "emoji":
            return ((_e = contentTitle.attrs) === null || _e === void 0 ? void 0 : _e.emoji) || "";
        default:
            if (contentTitle.text) {
                return contentTitle.text;
            }
            return "";
    }
};
const stringToBoolean = (str) => str.toLowerCase() === "true";
exports.stringToBoolean = stringToBoolean;
