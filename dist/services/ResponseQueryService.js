"use strict";
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
exports.ResponseQueryService = void 0;
const Response_model_1 = __importDefault(require("../model/Response.model"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
const Content_model_1 = __importDefault(require("../model/Content.model"));
const ResponseValidationService_1 = require("./ResponseValidationService");
const fingerprint_1 = require("../utilities/fingerprint");
class ResponseQueryService {
    static getResponsesByFormId(formId, page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const responses = yield Response_model_1.default.find({ formId })
                .select(this.SummarySelectResponseField)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            const totalCount = yield Response_model_1.default.countDocuments({ formId });
            return {
                responses,
                pagination: ResponseValidationService_1.ResponseValidationService.createPaginationResponse(page, limit, totalCount),
            };
        });
    }
    static getResponsesWithFilters(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = ResponseValidationService_1.ResponseValidationService.buildFilterQuery(filters);
            const sortOptions = ResponseValidationService_1.ResponseValidationService.buildSortOptions(filters.sortBy, filters.sortOrder);
            const responses = yield Response_model_1.default.find(query)
                .populate("userId", "email")
                .sort(sortOptions)
                .select(this.SummarySelectResponseField)
                .skip((filters.page - 1) * filters.limit)
                .limit(filters.limit);
            const totalCount = yield Response_model_1.default.countDocuments(query);
            return {
                responses,
                pagination: ResponseValidationService_1.ResponseValidationService.createPaginationResponse(filters.page, filters.limit, totalCount),
            };
        });
    }
    static getUserResponses(_a) {
        return __awaiter(this, arguments, void 0, function* ({ page, limit, user, formId, }) {
            const skip = (page - 1) * limit;
            const query = {
                $and: [
                    { formId },
                    {
                        $or: [{ user }, { respondentEmail: user }],
                    },
                ],
            };
            const responses = yield Response_model_1.default.find(query)
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            const totalCount = yield Response_model_1.default.countDocuments(query);
            return {
                responses,
                pagination: ResponseValidationService_1.ResponseValidationService.createPaginationResponse(page, limit, totalCount),
            };
        });
    }
    static getGuestResponses(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Response_model_1.default.find({
                $and: [{ formId }, { userId: null }],
            });
        });
    }
    static getPublicFormData(formId_1) {
        return __awaiter(this, arguments, void 0, function* (formId, page = 1, req, res) {
            var _a, _b;
            const form = yield Form_model_1.default.findById(formId)
                .select("title type setting totalpage totalscore")
                .lean();
            if (!form) {
                throw new Error("Form not found");
            }
            if (((_a = form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses) === false) {
                throw new Error("Form is no longer accepting responses");
            }
            //Verify respodent brower fingerprinting for single response form
            if (((_b = form.setting) === null || _b === void 0 ? void 0 : _b.submitonce) && !form.setting.email) {
                const respondentFingerprint = fingerprint_1.FingerprintService.extractFingerprintFromRequest(req);
                const respondentIP = fingerprint_1.FingerprintService.getClientIP(req);
                const isResponse = yield Response_model_1.default.findOne({
                    respondentFingerprint,
                    respondentIP,
                })
                    .select("_id totalScore isCompleted submittedAt respondentEmail respondentName")
                    .lean();
                if (isResponse) {
                    return res.status(200).json({
                        data: {
                            submittedResult: Object.assign(Object.assign({ message: "You already submitted response" }, isResponse), { formId: undefined, maxScore: form.totalscore }),
                        },
                    });
                }
            }
            const contents = yield Content_model_1.default.find({ $and: [{ formId }, { page }] })
                .select("_id qIdx title type text multiple selection checkbox rangedate rangenumber date require page conditional parentcontent score")
                .lean()
                .sort({ idx: 1 });
            const formattedContents = contents.map((content) => {
                var _a;
                return (Object.assign(Object.assign({}, content), { parentcontent: ((_a = content.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) === content._id.toString()
                        ? undefined
                        : content.parentcontent, answer: undefined }));
            });
            return Object.assign(Object.assign({}, form), { contentIds: undefined, contents: formattedContents });
        });
    }
    static deleteResponse(responseId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Response_model_1.default.findByIdAndDelete(responseId);
        });
    }
    static bulkDeleteResponses(responseIds, formId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify all responses exist and belong to the form
            const responses = yield Response_model_1.default.find({
                _id: { $in: responseIds },
                formId: formId,
            });
            if (responses.length !== responseIds.length) {
                throw new Error("Some responses don't exist or don't belong to this form");
            }
            const deleteResult = yield Response_model_1.default.deleteMany({
                _id: { $in: responseIds },
                formId: formId,
            });
            return {
                deletedCount: deleteResult.deletedCount,
            };
        });
    }
}
exports.ResponseQueryService = ResponseQueryService;
ResponseQueryService.SummarySelectResponseField = "_id respondentEmail respondentName respondentType submittedAt isCompleted completionStatus createdAt";
