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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseValidationService = void 0;
const mongoose_1 = require("mongoose");
const helper_1 = require("../utilities/helper");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const Response_model_1 = __importStar(require("../model/Response.model"));
const formHelpers_1 = require("../utilities/formHelpers");
class ResponseValidationService {
    static validateRequest({ req, res, requireFormId = true, requireUserInfo, noToken, }) {
        const user = req?.user;
        if (!user && !noToken) {
            (0, helper_1.SendResponse)(res, 404);
            return { isValid: false };
        }
        if (requireFormId) {
            const formId = req.query?.formId ||
                req.params?.formId ||
                req.body?.formId;
            if (!formId || !(0, formHelpers_1.isValidObjectIdString)(formId)) {
                (0, helper_1.SendResponse)(res, 400);
                return { isValid: false };
            }
            return {
                user,
                formId,
                page: Number(req.query.page || req.query.p) || 1,
                limit: Number(req.query.limit || req.query.lt) || 10,
                uid: req.query.uid ?? undefined,
                rid: req.query.rid ?? undefined,
                isValid: true,
                message: req?.body?.message,
                emails: req?.body?.emails,
            };
        }
        if (requireUserInfo) {
            if (!req.query.uid || !user) {
                res.status(400).json((0, helper_1.ReturnCode)(400));
                return { isValid: false };
            }
        }
        return {
            user,
            page: Number(req.query?.page || req.query?.p) || 1,
            limit: Number(req.query?.limit || req.query?.lt) || 10,
            isValid: true,
        };
    }
    static async validateFormAccess(formId, userId, res) {
        try {
            const form = await Form_model_1.default.findById(new mongoose_1.Types.ObjectId(formId)).lean();
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return null;
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(userId))) {
                res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                return null;
            }
            return form;
        }
        catch (error) {
            console.error("Form access validation error:", error);
            res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form access"));
            return null;
        }
    }
    static async validateResponseAccess(responseId, userId, res) {
        try {
            const response = await Response_model_1.default.findById(responseId).populate("formId");
            if (!response) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                return null;
            }
            const form = await Form_model_1.default.findById(response.formId).lean();
            if (!form) {
                res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
                return null;
            }
            if (!(0, formHelpers_1.hasFormAccess)(form, new mongoose_1.Types.ObjectId(userId))) {
                res.status(403).json((0, helper_1.ReturnCode)(403, "Access denied"));
                return null;
            }
            return { response, form };
        }
        catch (error) {
            console.error("Response access validation error:", error);
            res
                .status(500)
                .json((0, helper_1.ReturnCode)(500, "Failed to validate response access"));
            return null;
        }
    }
    static buildFilterQuery(filters) {
        const query = {
            formId: new mongoose_1.Types.ObjectId(filters.formId),
        };
        // Search term filter (searches in respondent email and name)
        if (filters.searchTerm) {
            const searchRegex = { $regex: filters.searchTerm, $options: "i" };
            query.$or = [
                { respondentEmail: searchRegex },
                { respondentName: searchRegex },
                { "guest.email": searchRegex },
                { "guest.name": searchRegex },
            ];
        }
        // Completion status filter
        if (filters.completionStatus) {
            switch (filters.completionStatus) {
                case Response_model_1.ResponseCompletionStatus.completed:
                    query.isCompleted = true;
                    break;
                case Response_model_1.ResponseCompletionStatus.partial:
                    query.$and = [
                        { isCompleted: { $ne: true } },
                        { submittedAt: { $exists: true } },
                    ];
                    break;
                case Response_model_1.ResponseCompletionStatus.abandoned:
                    query.$and = [
                        { isCompleted: { $ne: true } },
                        { submittedAt: { $exists: false } },
                    ];
                    break;
            }
        }
        // Date range filter
        if (filters.startDate || filters.endDate) {
            query.submittedAt = {};
            if (filters.startDate)
                query.submittedAt.$gte = new Date(filters.startDate);
            if (filters.endDate) {
                // Add 23:59:59 to include the entire end date
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                query.submittedAt.$lte = endDate;
            }
        }
        // Score range filter
        if (filters.minScore !== undefined || filters.maxScore !== undefined) {
            query.totalScore = {};
            if (filters.minScore !== undefined && filters.minScore !== "") {
                query.totalScore.$gte = Number(filters.minScore);
            }
            if (filters.maxScore !== undefined && filters.maxScore !== "") {
                query.totalScore.$lte = Number(filters.maxScore);
            }
        }
        //Id and userId filter
        if (filters.id || filters.userId) {
            query._id = filters.id;
            query.userId = filters.userId;
        }
        return query;
    }
    static buildSortOptions(sortBy, sortOrder) {
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
        }
        else {
            sortOptions.submittedAt = -1;
        }
        return sortOptions;
    }
    static createPaginationResponse(page, limit, totalCount) {
        return {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1,
        };
    }
}
exports.ResponseValidationService = ResponseValidationService;
