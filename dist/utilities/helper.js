"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRangeValueValid = exports.contentTitleToString = exports.latexToUnicode = exports.GetAnswerKeyForQuestion = exports.GetAnswerKeyPairValue = exports.AddQuestionNumbering = exports.validateNestingDepth = exports.getQuestionDepth = exports.MAX_QUESTION_DEPTH = exports.groupContentByParent = exports.FormatToGeneralDate = exports.getDateByMinute = exports.getDateByNumDay = exports.ExtractTokenPayload = exports.GenerateToken = exports.RandomNumber = exports.hashedPassword = exports.ValidatePassword = exports.convertResponseToString = exports.formatDateToDDMMYYYY = void 0;
exports.ReturnCode = ReturnCode;
exports.SendResponse = SendResponse;
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
            break;
        default:
            return;
    }
    return returnValue(code, custommess ?? message);
}
function SendResponse(res, code, data, message) {
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
SendResponse.success = (res, data, message) => SendResponse(res, 200, data, message);
SendResponse.created = (res, data, message) => SendResponse(res, 201, data, message);
SendResponse.noContent = (res) => SendResponse(res, 204);
SendResponse.badRequest = (res, message, data) => SendResponse(res, 400, data, message);
SendResponse.unauthorized = (res, message) => SendResponse(res, 401, undefined, message);
SendResponse.forbidden = (res, message) => SendResponse(res, 403, undefined, message);
SendResponse.notFound = (res, message) => SendResponse(res, 404, undefined, message);
SendResponse.conflict = (res, message) => SendResponse(res, 409, undefined, message);
SendResponse.error = (res, message) => SendResponse(res, 500, undefined, message);
/**
 * Formats a date to dd-mm-yyyy format
 *
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
        catch {
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
    const token = jsonwebtoken_1.default.sign(payload, customSecret ?? (process.env.JWT_SECRET || "secret"), {
        expiresIn,
        algorithm: "HS256",
    });
    return token;
};
exports.GenerateToken = GenerateToken;
/**
 * @param token - JWT token string to verify and decode
 * @param customSecret - Optional custom secret key (defaults to process.env.JWT_SECRET)
 * @param ignoreExpiration - If true, will not throw error for expired tokens (default: false)
 *
 */
const ExtractTokenPayload = ({ token, customSecret, ignoreExpiration = false, }) => {
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
        if (item.parentcontent?.qId) {
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
        if (!processed.has(item._id?.toString())) {
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
exports.MAX_QUESTION_DEPTH = 20;
/**
 * Returns the nesting depth of a single question (1 = top-level, 2 = first
 * conditional child, etc.)
 */
const getQuestionDepth = (question, byId, byQIdx) => {
    let depth = 1;
    const visited = new Set();
    let current = question;
    while (current.parentcontent) {
        const key = current.parentcontent.qId ||
            (current.parentcontent.qIdx !== undefined
                ? `qIdx_${current.parentcontent.qIdx}`
                : null);
        if (!key || visited.has(key))
            break; //Break loop
        visited.add(key);
        const parent = byId.get(current.parentcontent.qId ?? "") ||
            (current.parentcontent.qIdx !== undefined
                ? byQIdx.get(current.parentcontent.qIdx)
                : undefined);
        if (!parent)
            break;
        depth++;
        current = parent;
    }
    return depth;
};
exports.getQuestionDepth = getQuestionDepth;
/**
 * Validates that no question in the array exceeds `maxDepth` nesting levels.
 */
const validateNestingDepth = (questions, maxDepth = exports.MAX_QUESTION_DEPTH) => {
    if (!questions || questions.length === 0)
        return null;
    // Build lookup maps once
    const byId = new Map();
    const byQIdx = new Map();
    for (const q of questions) {
        if (q._id)
            byId.set(q._id.toString(), q);
        if (q.qIdx !== undefined)
            byQIdx.set(q.qIdx, q);
    }
    const exceedDepth = [];
    for (const q of questions) {
        const depth = (0, exports.getQuestionDepth)(q, byId, byQIdx);
        if (depth > maxDepth) {
            const label = q.qIdx !== undefined
                ? `qIdx ${q.qIdx}`
                : (q._id?.toString() ?? "unknown");
            exceedDepth.push(`${label} (depth ${depth})`);
        }
    }
    return exceedDepth.length > 0
        ? `Question nesting exceeds maximum depth of ${maxDepth}: ${exceedDepth.join(", ")}`
        : null;
};
exports.validateNestingDepth = validateNestingDepth;
const AddQuestionNumbering = ({ questions, lastIdx, }) => {
    if (!questions || questions.length === 0)
        return [];
    const questionIdMap = new Map();
    const getParentId = (question) => {
        if (!question.parentcontent)
            return null;
        if (question.parentcontent.qId)
            return question.parentcontent.qId.toString();
        if (question.parentcontent.qIdx !== undefined)
            return `temp_${question.parentcontent.qIdx}`;
        return null;
    };
    const getQuestionId = (question) => question._id ? question._id.toString() : `temp_${question.qIdx}`;
    const isTopLevel = (question) => !question.parentcontent ||
        (question.parentcontent.qIdx === undefined && !question.parentcontent.qId);
    // Build parent → sorted children map
    const parentChildrenMap = new Map();
    questions.forEach((question, index) => {
        const parentId = getParentId(question);
        if (parentId) {
            if (!parentChildrenMap.has(parentId))
                parentChildrenMap.set(parentId, []);
            parentChildrenMap.get(parentId).push({ question, index });
        }
    });
    parentChildrenMap.forEach((siblings) => siblings.sort((a, b) => {
        const diff = (a.question.qIdx ?? 0) - (b.question.qIdx ?? 0);
        return diff !== 0 ? diff : a.index - b.index;
    }));
    let topLevelCount = lastIdx ?? 0;
    const buildNumber = (question, index) => {
        if (isTopLevel(question))
            return `${++topLevelCount}`;
        const parentId = getParentId(question);
        const parentNumber = questionIdMap.get(parentId) ??
            questions.find((q) => q._id?.toString() === parentId ||
                (parentId.startsWith("temp_") &&
                    q.qIdx === parseInt(parentId.replace("temp_", ""), 10)))?.questionId ??
            `${index + 1}`;
        const siblings = parentChildrenMap.get(parentId) ?? [];
        const position = siblings.findIndex((s) => getQuestionId(s.question) === getQuestionId(question)) + 1;
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
            parentcontent: updatedParentContent,
        };
    });
};
exports.AddQuestionNumbering = AddQuestionNumbering;
//Extract Answer Key Value
const GetAnswerKeyPairValue = (content) => {
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
    const val = matchingChoice?.content ?? response;
    return { key: response, val };
};
exports.GetAnswerKeyPairValue = GetAnswerKeyPairValue;
const GetAnswerKeyForQuestion = (content) => {
    if (content.type !== Content_model_1.QuestionType.CheckBox &&
        content.type !== Content_model_1.QuestionType.MultipleChoice &&
        content.type !== Content_model_1.QuestionType.Selection) {
        return content.answer;
    }
    if (content.type === Content_model_1.QuestionType.CheckBox) {
        const val = content.checkbox;
        const answerkey = content.answer?.answer;
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
    return content[content.type]?.filter((i) => i.idx === content.answer?.answer)?.[0];
};
exports.GetAnswerKeyForQuestion = GetAnswerKeyForQuestion;
/**
 * Helper to match balanced curly braces { ... }
 */
const extractBalancedBraces = (str, startIndex) => {
    if (str[startIndex] !== "{")
        return null;
    let depth = 0;
    const start = startIndex + 1;
    for (let i = startIndex; i < str.length; i++) {
        if (str[i] === "{")
            depth++;
        else if (str[i] === "}") {
            depth--;
            if (depth === 0) {
                return { content: str.slice(start, i), endIndex: i };
            }
        }
    }
    return null;
};
/**
 * Converts a LaTeX formula string into a readable Unicode math string representation.
 * Useful for email templates, notifications, and plaintext contexts where client-side Math rendering is unavailable.
 */
const latexToUnicode = (latex) => {
    if (!latex || typeof latex !== "string")
        return "";
    const superscripts = {
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
        "+": "⁺",
        "-": "⁻",
        "=": "⁼",
        "(": "⁽",
        ")": "⁾",
        n: "ⁿ",
        i: "ⁱ",
        j: "ʲ",
        k: "ᵏ",
        x: "ˣ",
        y: "ʸ",
        z: "ᶻ",
        a: "ᵃ",
        b: "ᵇ",
        c: "ᶜ",
        d: "ᵈ",
        e: "ᵉ",
        m: "ᵐ",
        p: "ᵖ",
        t: "ᵗ",
    };
    const subscripts = {
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
        "+": "₊",
        "-": "₋",
        "=": "₌",
        "(": "₍",
        ")": "₎",
        a: "ₐ",
        e: "ₑ",
        h: "ₕ",
        i: "ᵢ",
        j: "ⱼ",
        k: "ₖ",
        l: "ₗ",
        m: "ₘ",
        n: "ₙ",
        o: "ₒ",
        p: "ₚ",
        r: "ᵣ",
        s: "ₛ",
        t: "ₜ",
        u: "ᵤ",
        v: "ᵥ",
        x: "ₓ",
    };
    const greekAndSymbols = [
        // Multi-char / standard symbols
        [/\\rightarrow|\\to(?![a-zA-Z])/g, "→"],
        [/\\leftarrow|\\gets(?![a-zA-Z])/g, "←"],
        [/\\Rightarrow(?![a-zA-Z])/g, "⇒"],
        [/\\Leftarrow(?![a-zA-Z])/g, "⇐"],
        [/\\Leftrightarrow|\\iff(?![a-zA-Z])/g, "⇔"],
        [/\\leq|\\le(?![a-zA-Z])/g, "≤"],
        [/\\geq|\\ge(?![a-zA-Z])/g, "≥"],
        [/\\neq|\\ne(?![a-zA-Z])/g, "≠"],
        [/\\approx(?![a-zA-Z])/g, "≈"],
        [/\\equiv(?![a-zA-Z])/g, "≡"],
        [/\\pm(?![a-zA-Z])/g, "±"],
        [/\\mp(?![a-zA-Z])/g, "∓"],
        [/\\times(?![a-zA-Z])/g, "×"],
        [/\\div(?![a-zA-Z])/g, "÷"],
        [/\\cdot(?![a-zA-Z])/g, "·"],
        [/\\circ|\\degree(?![a-zA-Z])/g, "°"],
        [/\\infty(?![a-zA-Z])/g, "∞"],
        [/\\propto(?![a-zA-Z])/g, "∝"],
        [/\\partial(?![a-zA-Z])/g, "∂"],
        [/\\nabla(?![a-zA-Z])/g, "∇"],
        [/\\forall(?![a-zA-Z])/g, "∀"],
        [/\\exists(?![a-zA-Z])/g, "∃"],
        [/\\in(?![a-zA-Z])/g, "∈"],
        [/\\notin(?![a-zA-Z])/g, "∉"],
        [/\\subset(?![a-zA-Z])/g, "⊂"],
        [/\\subseteq(?![a-zA-Z])/g, "⊆"],
        [/\\cup(?![a-zA-Z])/g, "∪"],
        [/\\cap(?![a-zA-Z])/g, "∩"],
        [/\\int(?![a-zA-Z])/g, "∫"],
        [/\\iint(?![a-zA-Z])/g, "∬"],
        [/\\sum(?![a-zA-Z])/g, "∑"],
        [/\\prod(?![a-zA-Z])/g, "∏"],
        // Lowercase Greek
        [/\\alpha(?![a-zA-Z])/g, "α"],
        [/\\beta(?![a-zA-Z])/g, "β"],
        [/\\gamma(?![a-zA-Z])/g, "γ"],
        [/\\delta(?![a-zA-Z])/g, "δ"],
        [/\\epsilon|\\varepsilon(?![a-zA-Z])/g, "ε"],
        [/\\zeta(?![a-zA-Z])/g, "ζ"],
        [/\\eta(?![a-zA-Z])/g, "η"],
        [/\\theta|\\vartheta(?![a-zA-Z])/g, "θ"],
        [/\\iota(?![a-zA-Z])/g, "ι"],
        [/\\kappa(?![a-zA-Z])/g, "κ"],
        [/\\lambda(?![a-zA-Z])/g, "λ"],
        [/\\mu(?![a-zA-Z])/g, "μ"],
        [/\\nu(?![a-zA-Z])/g, "ν"],
        [/\\xi(?![a-zA-Z])/g, "ξ"],
        [/\\pi(?![a-zA-Z])/g, "π"],
        [/\\rho(?![a-zA-Z])/g, "ρ"],
        [/\\sigma(?![a-zA-Z])/g, "σ"],
        [/\\tau(?![a-zA-Z])/g, "τ"],
        [/\\upsilon(?![a-zA-Z])/g, "υ"],
        [/\\phi|\\varphi(?![a-zA-Z])/g, "φ"],
        [/\\chi(?![a-zA-Z])/g, "χ"],
        [/\\psi(?![a-zA-Z])/g, "ψ"],
        [/\\omega(?![a-zA-Z])/g, "ω"],
        // Uppercase Greek
        [/\\Gamma(?![a-zA-Z])/g, "Γ"],
        [/\\Delta(?![a-zA-Z])/g, "Δ"],
        [/\\Theta(?![a-zA-Z])/g, "Θ"],
        [/\\Lambda(?![a-zA-Z])/g, "Λ"],
        [/\\Xi(?![a-zA-Z])/g, "Ξ"],
        [/\\Pi(?![a-zA-Z])/g, "Π"],
        [/\\Sigma(?![a-zA-Z])/g, "Σ"],
        [/\\Upsilon(?![a-zA-Z])/g, "Υ"],
        [/\\Phi(?![a-zA-Z])/g, "Φ"],
        [/\\Psi(?![a-zA-Z])/g, "Ψ"],
        [/\\Omega(?![a-zA-Z])/g, "Ω"],
    ];
    let result = latex;
    // 1. Process Fractions: \frac{num}{den} with balanced brace support
    while (result.includes("\\frac")) {
        const fracIdx = result.indexOf("\\frac");
        const afterFrac = fracIdx + 5;
        const numMatch = extractBalancedBraces(result, afterFrac);
        if (!numMatch)
            break;
        const denMatch = extractBalancedBraces(result, numMatch.endIndex + 1);
        if (!denMatch)
            break;
        const numUnicode = (0, exports.latexToUnicode)(numMatch.content);
        const denUnicode = (0, exports.latexToUnicode)(denMatch.content);
        const replacement = `(${numUnicode} / ${denUnicode})`;
        result =
            result.slice(0, fracIdx) +
                replacement +
                result.slice(denMatch.endIndex + 1);
    }
    // 2. Process Square roots: \sqrt[3]{...}, \sqrt{...} with balanced brace support
    while (result.includes("\\sqrt")) {
        const sqrtIdx = result.indexOf("\\sqrt");
        let afterSqrt = sqrtIdx + 5;
        let rootPrefix = "√";
        if (result.startsWith("[3]", afterSqrt)) {
            rootPrefix = "∛";
            afterSqrt += 3;
        }
        else if (result[afterSqrt] === "[") {
            const closeBracket = result.indexOf("]", afterSqrt);
            if (closeBracket !== -1) {
                rootPrefix = `${result.slice(afterSqrt + 1, closeBracket)}√`;
                afterSqrt = closeBracket + 1;
            }
        }
        const contentMatch = extractBalancedBraces(result, afterSqrt);
        if (!contentMatch)
            break;
        const innerUnicode = (0, exports.latexToUnicode)(contentMatch.content);
        const replacement = `${rootPrefix}(${innerUnicode})`;
        result =
            result.slice(0, sqrtIdx) +
                replacement +
                result.slice(contentMatch.endIndex + 1);
    }
    // 3. Greek letters and Math Operators
    for (const [regex, symbol] of greekAndSymbols) {
        result = result.replace(regex, symbol);
    }
    // Handle common limit expressions like ^{\infty}, _{-\infty}
    result = result.replace(/\^\{[ \t]*\\infty[ \t]*\}|\^\\infty/g, "^∞");
    result = result.replace(/_\{[ \t]*-\\infty[ \t]*\}|_-\\infty/g, "₋∞");
    result = result.replace(/_\{[ \t]*\\infty[ \t]*\}|_\\infty/g, "∞");
    // 4. Superscripts: x^{2} or x^2 -> x²
    result = result.replace(/\^\{([^{}]+)\}|\^([0-9a-zA-Z+-=()])/g, (_, p1, p2) => {
        let chars = p1 || p2 || "";
        chars = chars.replace(/\^([0-9a-zA-Z+-=()])/g, (__, c) => superscripts[c] || c);
        return chars
            .split("")
            .map((c) => superscripts[c] || c)
            .join("");
    });
    // 5. Subscripts: x_{i} or x_i -> xᵢ
    result = result.replace(/_\{([^{}]+)\}|_([0-9a-zA-Z+-=()])/g, (_, p1, p2) => {
        let chars = p1 || p2 || "";
        chars = chars.replace(/_([0-9a-zA-Z+-=()])/g, (__, c) => subscripts[c] || c);
        return chars
            .split("")
            .map((c) => subscripts[c] || c)
            .join("");
    });
    // 6. Common functions: \sin, \cos, \tan, \log, \ln, \lim, \exp, etc.
    result = result.replace(/\\(sin|cos|tan|sec|csc|cot|log|ln|exp|lim|max|min|det|deg)(?![a-zA-Z])/g, "$1");
    // 7. Text wrappers: \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}
    result = result.replace(/\\[a-zA-Z]+\{([^{}]+)\}/g, "$1");
    // 8. Spaces and formatting
    result = result.replace(/\\quad|\\qquad|\\;|\\,|\\:/g, " ");
    result = result.replace(/\\\\/g, " ");
    result = result.replace(/[{}]/g, "");
    return result.replace(/[ \t]+/g, " ").trim();
};
exports.latexToUnicode = latexToUnicode;
/**
 *Convert TipTab JSON Content to string  */
const contentTitleToString = (contentTitle) => {
    if (!contentTitle) {
        return "";
    }
    if (typeof contentTitle === "string") {
        return contentTitle;
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
        case "inlineMath":
        case "displayMath":
        case "math":
        case "math_inline":
        case "math_display":
            return (0, exports.latexToUnicode)(contentTitle.attrs?.latex || "");
        case "image":
            const alt = contentTitle.attrs?.alt || "";
            const src = contentTitle.attrs?.src || "";
            return alt ? `[Image: ${alt}]` : `[Image: ${src}]`;
        case "mention":
            const mentionLabel = contentTitle.attrs?.label || contentTitle.attrs?.id || "";
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
    // Check if both start and end exist (0 is a valid value)
    if (value.start === null ||
        value.start === undefined ||
        value.end === null ||
        value.end === undefined) {
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
        const isValid = startValue <= endValue;
        if (!isValid) {
            console.warn("isRangeValueValid: Start value is greater than end value", {
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
