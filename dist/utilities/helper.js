"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRangeValueValid = exports.contentTitleToString = exports.GetAnswerKeyForQuestion = exports.GetAnswerKeyPairValue = exports.AddQuestionNumbering = exports.groupContentByParent = exports.FormatToGeneralDate = exports.getDateByMinute = exports.getDateByNumDay = exports.ExtractTokenPaylod = exports.ExtractTokenPayload = exports.GenerateToken = exports.RandomNumber = exports.hashedPassword = exports.ValidatePassword = exports.convertResponseToString = exports.convertTitleToString = exports.formatDateToDDMMYYYY = void 0;
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
        case 409:
            message = "Duplicated Detected";
            break;
        case 500:
            message = "Server Error";
        default:
            return;
    }
    return returnValue(code, custommess !== null && custommess !== void 0 ? custommess : message);
}
/**
 * Formats a date to dd-mm-yyyy format
 *
 * @param date - Date object, string, or timestamp
 * @returns Formatted date string in dd-mm-yyyy format
 */
const formatDateToDDMMYYYY = (date) => {
    if (!date)
        return "";
    const d = new Date(date);
    if (isNaN(d.getTime()))
        return String(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};
exports.formatDateToDDMMYYYY = formatDateToDDMMYYYY;
/**
 * Converts a ContentTitle object or string to a plain string
 * Extracts text from ContentTitle structure recursively
 *
 * @param title - ContentTitle object or string
 * @param fallback - Fallback text if title is empty (default: "Question")
 * @returns Plain string representation of the title
 */
const convertTitleToString = (title, fallback = "Question") => {
    if (!title)
        return fallback;
    if (typeof title === "string")
        return title;
    // If title has a text property directly
    if (title.text)
        return title.text;
    // If title has content array, extract text from it
    if (title.content && Array.isArray(title.content)) {
        const texts = [];
        const extractText = (items) => {
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
exports.convertTitleToString = convertTitleToString;
/**
 * Converts response value to string, handling object types
 *
 * @param value - Response value (can be string, number, object, etc.)
 * @returns String representation of the value
 */
const convertResponseToString = (value) => {
    if (value === null || value === undefined || value === "") {
        return "No Response";
    }
    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "object") {
        // Handle arrays
        if (Array.isArray(value)) {
            return value.map((v) => (0, exports.convertResponseToString)(v)).join(", ");
        }
        // Handle objects with key/val structure (like CheckBox)
        if (value.key && value.val) {
            if (Array.isArray(value.key) && Array.isArray(value.val)) {
                return value.key
                    .map((k, i) => `${k}: ${value.val[i]}`)
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
        }
        catch (_a) {
            return String(value);
        }
    }
    return String(value);
};
exports.convertResponseToString = convertResponseToString;
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
const GenerateToken = (payload, expiresIn, customSecret) => {
    const token = jsonwebtoken_1.default.sign(payload, customSecret !== null && customSecret !== void 0 ? customSecret : (process.env.JWT_SECRET || "secret"), {
        expiresIn,
        algorithm: "HS256",
    });
    return token;
};
exports.GenerateToken = GenerateToken;
/**
 * Extracts and verifies JWT token payload with enhanced error handling
 *
 * @param token - JWT token string to verify and decode
 * @param customSecret - Optional custom secret key (defaults to process.env.JWT_SECRET)
 * @param ignoreExpiration - If true, will not throw error for expired tokens (default: false)
 * @returns Decoded token payload or null if verification fails
 *
 * @example
 * ```typescript
 * const payload = ExtractTokenPayload({ token: "eyJhbGc..." });
 * if (payload) {
 *   console.log(payload.userId);
 * }
 * ```
 */
const ExtractTokenPayload = ({ token, customSecret, ignoreExpiration = false, }) => {
    try {
        // Validate token format
        if (!token || typeof token !== "string" || token.trim() === "") {
            console.error("ExtractTokenPayload: Invalid token format");
            return null;
        }
        // Validate secret
        const secret = customSecret !== null && customSecret !== void 0 ? customSecret : process.env.JWT_SECRET;
        if (!secret) {
            console.error("ExtractTokenPayload: JWT secret is not configured");
            return null;
        }
        // Verify and decode token
        const payload = jsonwebtoken_1.default.verify(token, secret, {
            ignoreExpiration,
            algorithms: ["HS256"], // Explicit algorithm for security
        });
        return payload;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            console.error("ExtractTokenPayload: Token has expired", {
                expiredAt: error.expiredAt,
            });
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            console.error("ExtractTokenPayload: Invalid token", {
                message: error.message,
            });
        }
        else if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
            console.error("ExtractTokenPayload: Token not active yet", {
                date: error.date,
            });
        }
        else {
            console.error("ExtractTokenPayload: Unexpected error", error);
        }
        return null;
    }
};
exports.ExtractTokenPayload = ExtractTokenPayload;
// Alias for backward compatibility (fixing typo)
exports.ExtractTokenPaylod = exports.ExtractTokenPayload;
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
/**
 * Adds hierarchical question numbering to questions
 * Main questions: 1, 2, 3
 * Conditional questions: 3.1, 3.2
 * Sub-conditional questions: 3.1.1, 3.1.2
 *
 * @param questions - Array of questions
 * @returns Array of questions with (questionId)
 */
const AddQuestionNumbering = ({ questions, lastIdx, }) => {
    if (!questions || questions.length === 0) {
        return [];
    }
    const questionIdMap = new Map();
    const questionIndexMap = new Map();
    questions.forEach((q, index) => {
        questionIndexMap.set(q, index);
    });
    // Helper to get parent identifier (qId or fallback to qIdx-based temp id)
    const getParentIdentifier = (question) => {
        if (!question.parentcontent)
            return null;
        // If qId exists, use it
        if (question.parentcontent.qId) {
            return question.parentcontent.qId;
        }
        // Fallback to qIdx-based identifier for unsaved data
        if (question.parentcontent.qIdx !== undefined) {
            return `temp_${question.parentcontent.qIdx}`;
        }
        return null;
    };
    // Helper to get question identifier
    const getQuestionIdentifier = (question) => {
        if (question._id)
            return question._id.toString();
        return `temp_${question.qIdx}`;
    };
    // Check if question is top-level (no parent)
    const isTopLevelQuestion = (question) => {
        return (!question.parentcontent ||
            (question.parentcontent.qIdx === undefined && !question.parentcontent.qId));
    };
    const parentChildrenMap = new Map();
    questions.forEach((question, index) => {
        const parentId = getParentIdentifier(question);
        if (parentId) {
            if (!parentChildrenMap.has(parentId)) {
                parentChildrenMap.set(parentId, []);
            }
            parentChildrenMap.get(parentId).push({ question, index });
        }
    });
    // Sort sibling groups once upfront by qIdx and original index
    parentChildrenMap.forEach((siblings) => {
        siblings.sort((a, b) => {
            const qIdxDiff = (a.question.qIdx || 0) - (b.question.qIdx || 0);
            return qIdxDiff !== 0 ? qIdxDiff : a.index - b.index;
        });
    });
    // Helper function to build hierarchical number
    const buildQuestionNumber = (question, index, lastIndexWihoutParentCount) => {
        //QuestionId for non conditional question (top-level)
        if (isTopLevelQuestion(question)) {
            // Count how many top-level questions come before this one (inclusive)
            let topLevelCount = 0;
            for (let i = 0; i <= index; i++) {
                if (isTopLevelQuestion(questions[i])) {
                    topLevelCount++;
                }
            }
            // Add lastIdx to account for questions from previous pages
            const offset = lastIdx !== null && lastIdx !== void 0 ? lastIdx : 0;
            return `${topLevelCount + offset}`;
        }
        // Find parent question number
        const parentId = getParentIdentifier(question);
        if (!parentId) {
            return `${index + 1}`;
        }
        let parentNumber = questionIdMap.get(parentId);
        if (!parentNumber) {
            // Try to find parent by _id first
            let parentQuestion = questions.find((q) => { var _a; return ((_a = q._id) === null || _a === void 0 ? void 0 : _a.toString()) === parentId; });
            // If not found, try by temp identifier (qIdx-based)
            if (!parentQuestion && parentId.startsWith("temp_")) {
                const parentQIdx = parseInt(parentId.replace("temp_", ""), 10);
                parentQuestion = questions.find((q) => q.qIdx === parentQIdx);
            }
            if (parentQuestion) {
                parentNumber = parentQuestion.questionId || `${index + 1}`;
            }
            else {
                parentNumber = `${index + 1}`;
            }
        }
        const siblings = parentChildrenMap.get(parentId);
        let position = 1;
        if (siblings) {
            for (const sibling of siblings) {
                const siblingId = getQuestionIdentifier(sibling.question);
                const currentId = getQuestionIdentifier(question);
                if (siblingId === currentId) {
                    break;
                }
                position++;
            }
        }
        return `${parentNumber}.${position}`;
    };
    let lastIndexWihoutParentCount = 0;
    // Process questions and assign questionId
    const result = questions.map((question, index) => {
        const questionId = buildQuestionNumber(question, index, // Use array index, not offset
        lastIdx ? undefined : lastIndexWihoutParentCount);
        // Store in map for reference by child questions using identifier
        const qIdentifier = getQuestionIdentifier(question);
        questionIdMap.set(qIdentifier, questionId);
        // Update parentcontent with parent's questionId if it exists
        let updatedParentContent = question.parentcontent;
        if (question.parentcontent) {
            const parentId = getParentIdentifier(question);
            const parentQuestionId = parentId
                ? questionIdMap.get(parentId)
                : undefined;
            updatedParentContent = Object.assign(Object.assign({}, question.parentcontent), { questionId: parentQuestionId || undefined });
            lastIndexWihoutParentCount += 1;
        }
        return Object.assign(Object.assign({}, question), { questionId, parentcontent: updatedParentContent });
    });
    return result;
};
exports.AddQuestionNumbering = AddQuestionNumbering;
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
        if (!answerkey || !Array.isArray(answerkey) || !val)
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
/**
 *Convert TipTab JSON Content to string  */
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
const ISODateToNumber = (isoString) => {
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
const isRangeValueValid = (value, isDate) => {
    // Check if both start and end exist
    if (!value.start || !value.end) {
        console.warn("isRangeValueValid: Missing start or end value", value);
        return false;
    }
    try {
        let startValue;
        let endValue;
        if (isDate) {
            // Handle date ranges
            startValue = ISODateToNumber(value.start);
            endValue = ISODateToNumber(value.end);
            if (isNaN(startValue) || isNaN(endValue)) {
                console.error("isRangeValueValid: Invalid date string(s)", value);
                return false;
            }
        }
        else {
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
        const isValid = startValue < endValue;
        if (!isValid) {
            console.warn("isRangeValueValid: Start value is not less than end value", {
                start: startValue,
                end: endValue,
            });
        }
        return isValid;
    }
    catch (error) {
        console.error("isRangeValueValid: Error validating range", error, value);
        return false;
    }
};
exports.isRangeValueValid = isRangeValueValid;
