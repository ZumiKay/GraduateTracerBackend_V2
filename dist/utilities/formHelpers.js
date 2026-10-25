"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.projections = void 0;
exports.isValidObjectIdString = isValidObjectIdString;
exports.hasFormAccess = hasFormAccess;
exports.isPrimaryOwner = isPrimaryOwner;
exports.verifyRole = verifyRole;
exports.validateAccess = validateAccess;
exports.getPageVersion = getPageVersion;
exports.buildBumpedPageVersions = buildBumpedPageVersions;
exports.validateFormRequest = validateFormRequest;
exports.getLastQuestionIdx = getLastQuestionIdx;
exports.formatResponseValue = formatResponseValue;
const Form_model_1 = require("../model/Form.model");
const Content_model_1 = __importStar(require("../model/Content.model"));
const helper_1 = require("./helper");
// Helper function to validate ObjectId format
function isValidObjectIdString(id) {
    return typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
}
function hasFormAccess(form, userId) {
    try {
        const userIdStr = userId.toString();
        const HaveAccessID = new Set();
        form.editors?.forEach((i) => HaveAccessID.add(i._id.toString()));
        form.owners?.forEach((i) => HaveAccessID.add(i._id.toString()));
        //Verify creator
        form.user.equals(userId) && HaveAccessID.add(userId.toString());
        return HaveAccessID.has(userIdStr);
    }
    catch (error) {
        console.error("Error in hasFormAccess:", error);
        return false;
    }
}
function isPrimaryOwner(form, userId) {
    try {
        const userIdStr = userId.toString();
        let formUserId;
        if (form.user && typeof form.user === "object" && form.user._id) {
            formUserId = form.user._id.toString();
        }
        else if (form.user) {
            formUserId = form.user.toString();
        }
        else {
            return false;
        }
        return formUserId === userIdStr;
    }
    catch (error) {
        console.error("Error in isPrimaryOwner:", error);
        return false;
    }
}
function verifyRole(role, form, userId) {
    const user_id = userId.toString();
    if (role === Form_model_1.CollaboratorType.creator) {
        return user_id === form.user.toString();
    }
    return role === Form_model_1.CollaboratorType.editor
        ? (form.editors?.some((i) => i.toString() === user_id) ?? false)
        : (form.owners?.some((i) => i.toString() === user_id) ?? false);
}
// Centralized access validation helper
function validateAccess(form, userId) {
    const userIdStr = userId?.toString();
    const isCreator = isPrimaryOwner(form, userIdStr);
    const isOwner = verifyRole(Form_model_1.CollaboratorType.owner, form, userId);
    const isEditor = verifyRole(Form_model_1.CollaboratorType.editor, form, userId);
    const hasAccess = isCreator || isOwner || isEditor;
    return { hasAccess, isCreator, isOwner, isEditor };
}
// Optimized projections for different use cases
exports.projections = {
    basic: "title type createdAt updatedAt user owners",
    detail: "title type createdAt updatedAt totalpage totalscore extraScore setting contentIds user owners editors pageVersions",
    minimal: "_id title type user owners editors",
    total: "totalpage totalscore extraScore contentIds user owners editors",
    setting: "_id title type setting user owners editors",
};
/**
 * Current content version of a page (0 when the page has never been saved
 * since versioning was introduced).
 */
function getPageVersion(form, page) {
    const versions = form?.pageVersions;
    if (!versions)
        return 0;
    const value = versions instanceof Map
        ? versions.get(String(page))
        : versions[String(page)];
    return typeof value === "number" ? value : 0;
}
/**
 * Invalidates every page version of a form. Used when the page structure
 * changes (page deleted and later pages shifted), so any client holding an
 * older copy of any page gets a conflict instead of saving onto the wrong page.
 */
function buildBumpedPageVersions(form, totalPage) {
    const versions = form.pageVersions;
    const current = versions instanceof Map
        ? Array.from(versions.values())
        : Object.values(versions ?? {});
    const next = Math.max(0, ...current.filter((v) => typeof v === "number")) + 1;
    const bumped = {};
    for (let page = 1; page <= Math.max(totalPage, 1); page++) {
        bumped[String(page)] = next;
    }
    return bumped;
}
// Common validation logic
function validateFormRequest(formId, userId) {
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
async function getLastQuestionIdx(formId, page) {
    if (!page || page <= 1) {
        return 0;
    }
    return Content_model_1.default.countDocuments({
        formId,
        page: { $lt: page },
        $or: [{ parentcontent: { $exists: false } }, { parentcontent: null }],
    });
}
function formatResponseValue({ response, questionType, }) {
    switch (questionType) {
        case Content_model_1.QuestionType.Date: {
            return (0, helper_1.formatDateToDDMMYYYY)(response);
        }
        case Content_model_1.QuestionType.RangeDate: {
            const resp = response;
            const formattedRange = {
                start: (0, helper_1.formatDateToDDMMYYYY)(resp.start),
                end: (0, helper_1.formatDateToDDMMYYYY)(resp.end),
            };
            return formattedRange;
        }
        default:
            return response;
    }
}
