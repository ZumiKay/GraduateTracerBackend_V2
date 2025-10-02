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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    static hasRespondent(formId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { fingerprint, ipAddress, userId, guestEmail, requireExactMatch = false, includeFallbackChecks = true, } = options;
                // Validate input
                if (!formId || !mongoose_1.Types.ObjectId.isValid(formId)) {
                    throw new Error("Invalid form ID provided");
                }
                // Strategy 1: Check by authenticated user ID (highest confidence)
                if (userId && mongoose_1.Types.ObjectId.isValid(userId)) {
                    const userResponse = yield Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        userId: new mongoose_1.Types.ObjectId(userId),
                    })
                        .select("_id submittedAt")
                        .lean();
                    if (userResponse) {
                        return {
                            hasResponded: true,
                            responseId: userResponse._id.toString(),
                            trackingMethod: "user_id",
                            confidence: "high",
                            metadata: {
                                userId,
                                submittedAt: userResponse.submittedAt,
                            },
                        };
                    }
                }
                // Strategy 2: Check by guest email (high confidence for guest users)
                if (guestEmail) {
                    const emailResponse = yield Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        "guest.email": guestEmail.toLowerCase().trim(),
                    })
                        .select("_id submittedAt guest.email")
                        .lean();
                    if (emailResponse) {
                        return {
                            hasResponded: true,
                            responseId: emailResponse._id.toString(),
                            trackingMethod: "guest_email",
                            confidence: "high",
                            metadata: {
                                guestEmail,
                                submittedAt: emailResponse.submittedAt,
                            },
                        };
                    }
                }
                // Strategy 3: Check by fingerprint + IP combination (medium-high confidence)
                if (fingerprint && ipAddress) {
                    const fingerprintIpResponse = yield Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        respondentFingerprint: fingerprint,
                        respondentIP: ipAddress,
                    })
                        .select("_id submittedAt respondentFingerprint respondentIP fingerprintStrength")
                        .lean();
                    if (fingerprintIpResponse) {
                        return {
                            hasResponded: true,
                            responseId: fingerprintIpResponse._id.toString(),
                            trackingMethod: "fingerprint_and_ip",
                            confidence: "high",
                            metadata: {
                                fingerprint,
                                ipAddress,
                                submittedAt: fingerprintIpResponse.submittedAt,
                                fingerprintStrength: fingerprintIpResponse.fingerprintStrength,
                            },
                        };
                    }
                }
                if (requireExactMatch || !includeFallbackChecks) {
                    return {
                        hasResponded: false,
                        trackingMethod: "none",
                        confidence: "high",
                    };
                }
                // Strategy 4: Fallback - Check by fingerprint only (medium confidence)
                if (fingerprint) {
                    const fingerprintResponse = yield Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        respondentFingerprint: fingerprint,
                    })
                        .select("_id submittedAt respondentFingerprint respondentIP fingerprintStrength")
                        .lean();
                    if (fingerprintResponse) {
                        return {
                            hasResponded: true,
                            responseId: fingerprintResponse._id.toString(),
                            trackingMethod: "fingerprint",
                            confidence: "medium",
                            metadata: {
                                fingerprint,
                                ipAddress: fingerprintResponse.respondentIP,
                                submittedAt: fingerprintResponse.submittedAt,
                                fingerprintStrength: fingerprintResponse.fingerprintStrength,
                            },
                        };
                    }
                }
                // Strategy 5: Fallback - Check by IP only (low confidence)
                if (ipAddress) {
                    const ipResponse = yield Response_model_1.default.findOne({
                        formId: new mongoose_1.Types.ObjectId(formId),
                        respondentIP: ipAddress,
                    })
                        .select("_id submittedAt respondentIP respondentFingerprint")
                        .sort({ submittedAt: -1 }) // Get most recent if multiple
                        .lean();
                    if (ipResponse) {
                        return {
                            hasResponded: true,
                            responseId: ipResponse._id.toString(),
                            trackingMethod: "ip",
                            confidence: "low",
                            metadata: {
                                ipAddress,
                                fingerprint: ipResponse.respondentFingerprint,
                                submittedAt: ipResponse.submittedAt,
                            },
                        };
                    }
                }
                return {
                    hasResponded: false,
                    trackingMethod: "none",
                    confidence: "high",
                    metadata: {
                        fingerprint,
                        ipAddress,
                        userId,
                        guestEmail,
                    },
                };
            }
            catch (error) {
                console.error("Error checking respondent:", {
                    formId,
                    options,
                    error: error instanceof Error ? error.message : error,
                });
                throw new Error(`Failed to check respondent status: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        });
    }
    static hasRespondentResponse(formId, fingerprint, respondentIp) {
        return __awaiter(this, void 0, void 0, function* () {
            console.warn("hasRespondentResponse is deprecated. Use hasRespondent() instead.");
            try {
                const result = yield this.hasRespondent(formId, {
                    fingerprint,
                    ipAddress: respondentIp,
                    requireExactMatch: true,
                    includeFallbackChecks: false,
                });
                return result.hasResponded;
            }
            catch (error) {
                console.error("Check for response", error);
                throw new Error("Error occurred while checking respondent response");
            }
        });
    }
    static extractTrackingOptions(req, additionalOptions = {}) {
        var _a, _b, _c, _d, _e, _f, _g;
        const options = Object.assign({}, additionalOptions);
        // Extract user ID from authenticated request
        if ("user" in req && req.user && req.user.id) {
            options.userId = req.user.id.toString();
        }
        // Extract guest email from request body
        if ((_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.guest) === null || _b === void 0 ? void 0 : _b.email) {
            options.guestEmail = req.body.guest.email;
        }
        // Extract fingerprint from headers or body
        if (req.headers["x-fingerprint"]) {
            options.fingerprint = req.headers["x-fingerprint"];
        }
        else if ((_c = req.body) === null || _c === void 0 ? void 0 : _c.fingerprint) {
            options.fingerprint = req.body.fingerprint;
        }
        // Extract IP address
        const clientIP = req.ip ||
            ((_d = req.connection) === null || _d === void 0 ? void 0 : _d.remoteAddress) ||
            ((_e = req.socket) === null || _e === void 0 ? void 0 : _e.remoteAddress) ||
            ((_g = (_f = req.headers["x-forwarded-for"]) === null || _f === void 0 ? void 0 : _f.split(",")[0]) === null || _g === void 0 ? void 0 : _g.trim()) ||
            req.headers["x-real-ip"] ||
            req.headers["x-client-ip"];
        if (clientIP) {
            options.ipAddress = clientIP;
        }
        return options;
    }
    static hasRespondentFromRequest(formId_1, req_1) {
        return __awaiter(this, arguments, void 0, function* (formId, req, options = {}) {
            const trackingOptions = this.extractTrackingOptions(req, options);
            return this.hasRespondent(formId, trackingOptions);
        });
    }
    static validateRequest(_a) {
        return __awaiter(this, arguments, void 0, function* ({ req, res, requireFormId = true, requireUserInfo, }) {
            var _b, _c;
            const user = req.user;
            if (!user) {
                res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
                return { user: null, isValid: false };
            }
            if (requireFormId) {
                const formId = req.query.formId ||
                    req.params.formId ||
                    req.body.formId;
                if (!formId) {
                    res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
                    return { user, isValid: false };
                }
                return {
                    user,
                    formId,
                    page: Number(req.query.page || req.query.p) || 1,
                    limit: Number(req.query.limit || req.query.lt) || 10,
                    uid: (_b = req.query.uid) !== null && _b !== void 0 ? _b : undefined,
                    isValid: true,
                };
            }
            if (requireUserInfo) {
                if (!req.query.uid) {
                    res.status(400).json((0, helper_1.ReturnCode)(400));
                    return { user, isValid: false };
                }
            }
            return {
                user,
                page: Number(req.query.page || req.query.p) || 1,
                limit: Number(req.query.limit || req.query.lt) || 10,
                uid: (_c = req.query.uid) !== null && _c !== void 0 ? _c : undefined,
                isValid: true,
            };
        });
    }
    static validateFormAccess(formId, userId, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const form = yield Form_model_1.default.findById(formId)
                    .populate({ path: "user", select: "email" })
                    .lean();
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
        });
    }
    static validateResponseAccess(responseId, userId, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield Response_model_1.default.findById(responseId).populate("formId");
                if (!response) {
                    res.status(404).json((0, helper_1.ReturnCode)(404, "Response not found"));
                    return null;
                }
                const form = yield Form_model_1.default.findById(response.formId)
                    .populate({ path: "user", select: "email" })
                    .lean();
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
        });
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
                case Response_model_1.completionStatus.completed:
                    query.isCompleted = true;
                    break;
                case Response_model_1.completionStatus.partial:
                    query.$and = [
                        { isCompleted: { $ne: true } },
                        { submittedAt: { $exists: true } },
                    ];
                    break;
                case Response_model_1.completionStatus.abandoned:
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
