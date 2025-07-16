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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateForm = CreateForm;
exports.PageHandler = PageHandler;
exports.EditForm = EditForm;
exports.DeleteForm = DeleteForm;
exports.GetAllForm = GetAllForm;
exports.GetFilterForm = GetFilterForm;
exports.ValidateFormBeforeAction = ValidateFormBeforeAction;
const helper_1 = require("../utilities/helper");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const mongoose_1 = require("mongoose");
const Content_model_1 = __importDefault(require("../model/Content.model"));
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
function CreateForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const formdata = req.body;
        const user = req.user;
        if (!user)
            return res.status(401).json((0, helper_1.ReturnCode)(404));
        try {
            //Form Creation
            const isForm = yield Form_model_1.default.findOne({ title: formdata.title, user: user.id });
            if (isForm)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Form already exist"));
            yield Form_model_1.default.create(Object.assign(Object.assign({}, formdata), { user: user.id }));
            return res
                .status(200)
                .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(201, "Form Created")), { data: formdata }));
        }
        catch (error) {
            console.log("Create Form", error);
            if (error.name === "Validation Error") {
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            }
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function PageHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { ty, formId, deletepage, } = req.body;
        if (!formId || !ty) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Missing required fields: formId or ty"));
        }
        if (ty === "delete" && (deletepage === undefined || isNaN(deletepage))) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "deletepage is required and must be a valid number for delete operation"));
        }
        try {
            if (ty === "add") {
                // Add page: increment totalpage
                yield Form_model_1.default.updateOne({ _id: formId }, { $inc: { totalpage: 1 } });
            }
            else if (ty === "delete") {
                // Delete page: fetch content IDs, update form, and delete content
                const toBeDeleteContent = yield Content_model_1.default.find({ page: deletepage })
                    .select("_id")
                    .lean();
                yield Form_model_1.default.updateOne({ _id: formId }, {
                    $inc: { totalpage: -1 },
                    $pull: { contentIds: { $in: toBeDeleteContent.map((i) => i._id) } },
                });
                yield Content_model_1.default.deleteMany({ page: deletepage });
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Success"));
        }
        catch (error) {
            console.error("PageHandler Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function EditForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const _a = req.body.data, { _id, setting } = _a, updateData = __rest(_a, ["_id", "setting"]);
        try {
            // Validate _id
            if (!_id)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Form ID"));
            // Construct update query dynamically
            const updateQuery = Object.assign({}, updateData);
            if (setting) {
                Object.keys(setting).forEach((key) => {
                    updateQuery[`setting.${key}`] = setting[key]; // Use dot notation
                });
            }
            // Update the form
            const updatedForm = yield Form_model_1.default.findByIdAndUpdate(_id, { $set: updateQuery }, // Apply update query
            { new: true, projection: "_id" } // Return `_id` for confirmation
            );
            // Handle not found
            if (!updatedForm) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Form Updated"));
        }
        catch (error) {
            console.error("Edit Form Error:", error.message);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function DeleteForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Invalid request: No IDs provided"));
            }
            const { deletedCount } = yield Form_model_1.default.deleteMany({ _id: { $in: ids } });
            if (deletedCount === 0) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "No forms found to delete"));
            }
            return res
                .status(200)
                .json((0, helper_1.ReturnCode)(200, `${deletedCount} forms deleted successfully`));
        }
        catch (error) {
            console.error("Delete Form Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function GetAllForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { limit = "5", page = "1" } = req.query;
            const p = Number(page);
            const lt = Number(limit);
            const allForm = yield Form_model_1.default.find()
                .skip((p - 1) * lt)
                .limit(lt);
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: allForm }));
        }
        catch (error) {
            console.log("Get All Form", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function GetFilterForm(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const { ty, q, page = "1", limit = "5", } = req.query;
            if (!ty) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid type or query"));
            }
            const p = Number(page);
            const lt = Number(limit);
            // Early validation for query parameter
            if ([
                "detail",
                "solution",
                "setting",
                "search",
                "type",
                "createddate",
                "modifieddate",
                "preview",
                "hidecond",
                "total",
                "response",
            ].includes(ty) &&
                !q) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid query"));
            }
            // Cache commonly used projections
            const basicProjection = "title type createdAt updatedAt";
            switch (ty) {
                case "detail":
                case "solution":
                case "response":
                case "hidecond": {
                    const query = (0, mongoose_1.isValidObjectId)(q) ? { _id: q } : { title: q };
                    const detailForm = yield Form_model_1.default.findOne(query)
                        .select(`${basicProjection} totalpage setting contentIds`)
                        .lean();
                    if (!detailForm) {
                        return res.status(400).json((0, helper_1.ReturnCode)(400, "No Form Found"));
                    }
                    const resultContent = yield Content_model_1.default.find({
                        $and: [
                            {
                                _id: { $in: detailForm.contentIds },
                            },
                            { page: p },
                        ],
                    })
                        .select(`_id idx title type text multiple checkbox range numrange date require page conditional parentcontent ${ty === "solution" ? "answer score hasAnswer isValidated" : ""}`)
                        .lean()
                        .sort({ idx: 1 });
                    // Add validation summary for solution tab
                    let validationSummary = null;
                    if (ty === "solution") {
                        try {
                            validationSummary = yield SolutionValidationService_1.default.validateForm(q);
                        }
                        catch (error) {
                            console.error("Validation error:", error);
                        }
                    }
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, detailForm), { contents: resultContent.map((content) => {
                                var _a;
                                return (Object.assign(Object.assign({}, content), { parentcontent: ((_a = content.parentcontent) === null || _a === void 0 ? void 0 : _a.qId) === content._id.toString()
                                        ? undefined
                                        : content.parentcontent }));
                            }) || [], contentIds: undefined, validationSummary }) }));
                }
                case "total": {
                    const formdata = yield Form_model_1.default.findById(q)
                        .select("totalpage totalscore contentIds")
                        .lean();
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: {
                            totalpage: (_a = formdata === null || formdata === void 0 ? void 0 : formdata.totalpage) !== null && _a !== void 0 ? _a : 0,
                            totalscore: (_b = formdata === null || formdata === void 0 ? void 0 : formdata.totalscore) !== null && _b !== void 0 ? _b : 0,
                            totalquestion: (_c = formdata === null || formdata === void 0 ? void 0 : formdata.contentIds) === null || _c === void 0 ? void 0 : _c.length,
                        } }));
                }
                case "setting": {
                    const form = yield Form_model_1.default.findById(q)
                        .select("_id title type setting")
                        .lean();
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: form }));
                }
                case "user": {
                    const user = req.user;
                    if (!user) {
                        return res.status(401).json((0, helper_1.ReturnCode)(401));
                    }
                    const userForms = yield Form_model_1.default.find({ user: user.id })
                        .skip((p - 1) * lt)
                        .limit(lt)
                        .select(basicProjection)
                        .populate({ path: "responses", select: "_id" })
                        .lean();
                    const formattedForms = userForms.map((form) => (Object.assign(Object.assign({}, form), { updatedAt: form.updatedAt
                            ? (0, helper_1.FormatToGeneralDate)(form.updatedAt)
                            : undefined, createdAt: form.createdAt
                            ? (0, helper_1.FormatToGeneralDate)(form.createdAt)
                            : undefined })));
                    return res
                        .status(200)
                        .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: formattedForms }));
                }
                default: {
                    // Handle search, type, createddate, modifieddate cases
                    const conditions = {
                        search: { title: { $regex: q, $options: "i" } },
                        type: { type: q },
                        createddate: { createdAt: new Date(q) },
                        modifieddate: { updatedAt: new Date(q) },
                    }[ty] || {};
                    const forms = yield Form_model_1.default.find(conditions)
                        .skip((p - 1) * lt)
                        .limit(lt)
                        .select(basicProjection)
                        .lean();
                    return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: forms }));
                }
            }
        }
        catch (error) {
            console.error("Error in GetFilterForm:", error instanceof Error ? error.message : error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal Server Error"));
        }
    });
}
function ValidateFormBeforeAction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId, action } = req.query;
        if (!formId || typeof formId !== "string") {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
        }
        try {
            const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
            const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
            // Different validation requirements based on action
            let canProceed = true;
            let warnings = [];
            switch (action) {
                case "save":
                    // Allow saving even with missing answers/scores, just provide warnings
                    canProceed = true;
                    warnings = errors;
                    break;
                case "next_page":
                case "switch_tab":
                    // Allow navigation with warnings
                    canProceed = true;
                    warnings = errors;
                    break;
                case "send_form":
                    // Strict validation for sending form
                    canProceed = errors.length === 0;
                    break;
                default:
                    canProceed = errors.length === 0;
            }
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors,
                    warnings,
                    canProceed,
                    action }) }));
        }
        catch (error) {
            console.error("Validate Form Before Action Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
        }
    });
}
