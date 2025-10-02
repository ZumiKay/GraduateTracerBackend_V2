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
exports.ContentValidate = void 0;
exports.AddFormContent = AddFormContent;
exports.EditFormContent = EditFormContent;
exports.DeleteContent = DeleteContent;
exports.ValidateFormContent = ValidateFormContent;
const zod_1 = require("zod");
const Content_model_1 = __importStar(require("../model/Content.model"));
const helper_1 = require("../utilities/helper");
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
const Form_model_1 = __importDefault(require("../model/Form.model"));
const SolutionValidationService_1 = __importDefault(require("../services/SolutionValidationService"));
exports.ContentValidate = zod_1.z.object({
    body: zod_1.z.object({
        formId: zod_1.z.string().min(1, "Form is required"),
        contents: zod_1.z.object({
            title: zod_1.z.string().min(1, "Question is required"),
            type: zod_1.z.nativeEnum(Content_model_1.QuestionType),
            text: zod_1.z.string().optional(),
            socre: zod_1.z.number().optional(),
            require: zod_1.z.boolean(),
        }),
    }),
});
function AddFormContent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        const operationId = MongoErrorHandler_1.MongoErrorHandler.generateOperationId("add_content");
        try {
            const AddContent = yield Content_model_1.default.create(data.contents);
            const AddedContentIds = AddContent.id;
            //Assign to form
            const updateForm = yield Form_model_1.default.updateOne({ _id: data.formId }, { contentIds: AddedContentIds });
            if (updateForm.modifiedCount === 0) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
            }
            return res.status(201).json((0, helper_1.ReturnCode)(201, "Form Updated"));
        }
        catch (error) {
            console.error(`[${operationId}] Add Form Content error:`, error);
            const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
                operationId,
                customMessage: "Failed to add content to form",
            });
            if (!mongoErrorHandled.handled) {
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        }
    });
}
function EditFormContent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { contents } = req.body;
        try {
            // Validate input
            if (!contents || !contents._id) {
                return res
                    .status(400)
                    .json((0, helper_1.ReturnCode)(400, "Invalid content data provided"));
            }
            // Add validation flags
            const validationResult = SolutionValidationService_1.default.validateContent(contents);
            const updatedContent = Object.assign(Object.assign({}, contents), { hasAnswer: !!contents.answer, isValidated: validationResult.isValid });
            // Update content
            const updatedContentResult = yield Content_model_1.default.findByIdAndUpdate(contents._id, updatedContent, {
                new: true, // Return the updated document
                runValidators: true, // Run schema validations
            });
            // Check if the content was found and updated
            if (!updatedContentResult) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Content not found"));
            }
            // Return validation warnings if any
            const response = Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Content updated successfully")), { validationWarnings: validationResult.warnings, validationErrors: validationResult.errors });
            return res.status(200).json(response);
        }
        catch (error) {
            console.error("Edit Form Content Error:", error.message || error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
        }
    });
}
function DeleteContent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id, formId } = req.body;
        try {
            if (!id || !formId)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            const deletedContent = yield Content_model_1.default.findByIdAndDelete(id);
            if (!deletedContent) {
                return res.status(404).json((0, helper_1.ReturnCode)(404, "Content not found"));
            }
            // Update the Form by removing the deleted content's ID
            if (formId) {
                yield Form_model_1.default.updateOne({ _id: formId }, { $pull: { contentIds: id } } // Remove the ID from the contentIds array
                );
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200, "Content Deleted"));
        }
        catch (error) {
            console.log("Delete Content", error);
            return res.status(200).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function ValidateFormContent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { formId } = req.query;
        if (!formId || typeof formId !== "string") {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Form ID is required"));
        }
        try {
            const validationSummary = yield SolutionValidationService_1.default.validateForm(formId);
            const errors = yield SolutionValidationService_1.default.getFormValidationErrors(formId);
            return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: Object.assign(Object.assign({}, validationSummary), { errors, canSubmit: errors.length === 0 }) }));
        }
        catch (error) {
            console.error("Validate Form Content Error:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500, "Failed to validate form"));
        }
    });
}
