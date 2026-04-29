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
exports.GetFormDetails = exports.GetFilledForm = void 0;
const helper_1 = require("../../utilities/helper");
const Form_model_1 = __importDefault(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const formHelpers_1 = require("../../utilities/formHelpers");
const Response_model_1 = __importDefault(require("../../model/Response.model"));
const GetFilledForm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { formId, responseId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        if (!(0, formHelpers_1.isValidObjectIdString)(formId)) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid form ID"));
        }
        const formObjectId = new mongoose_1.Types.ObjectId(formId);
        const userObjectId = new mongoose_1.Types.ObjectId(user.sub);
        const form = yield Form_model_1.default.findById(formObjectId).lean();
        if (!form) {
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        }
        const responseQuery = {
            formId: formObjectId,
            userId: userObjectId,
        };
        if (responseId && (0, formHelpers_1.isValidObjectIdString)(responseId)) {
            responseQuery._id = new mongoose_1.Types.ObjectId(responseId);
        }
        //Get User Response
        const userResponses = yield Response_model_1.default.find({
            $and: [
                { formId: responseQuery.formId },
                { userId: responseQuery.userId },
            ],
        })
            .populate({
            path: "responseset.question",
            select: "-hasAnswer -isValidated -page -require",
        })
            .sort({ submittedAt: -1 }) // get in descending order
            .lean();
        if (userResponses.length === 0) {
            return res
                .status(404)
                .json((0, helper_1.ReturnCode)(404, "No responses found for this form"));
        }
        //Data mutation
        let currentResponse = userResponses[0];
        if (responseId && (0, formHelpers_1.isValidObjectIdString)(responseId)) {
            const specificResponse = userResponses.find((resp) => resp._id.toString() === responseId);
            if (specificResponse) {
                currentResponse = specificResponse;
            }
        }
        const formatResponseData = (response) => (Object.assign(Object.assign({}, response), { updatedAt: response.updatedAt
                ? (0, helper_1.FormatToGeneralDate)(response.updatedAt)
                : undefined }));
        console.log(form.totalscore);
        const responseData = {
            form: {
                _id: form._id,
                title: form.title,
                type: form.type,
                totalscore: form.totalscore,
            },
            response: formatResponseData(currentResponse),
            //All user responses with full data
            userResponses: userResponses.map((resp) => formatResponseData(resp)),
        };
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Filled form data retrieved successfully")), { data: responseData }));
    }
    catch (error) {
        console.error("Get Filled Form Error:", error);
        return res
            .status(500)
            .json((0, helper_1.ReturnCode)(500, "Failed to retrieve filled form data"));
    }
});
exports.GetFilledForm = GetFilledForm;
/**
 * Get Form Details with Access Verification
 * Used by ViewResponsePage to fetch form data
 * Verifies that the user has access to the form before returning details
 */
const GetFormDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { formId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json((0, helper_1.ReturnCode)(401, "Unauthorized"));
        }
        // Validate form ID format
        const validation = (0, formHelpers_1.validateFormRequest)(formId);
        if (!validation.isValid) {
            return res.status(400).json((0, helper_1.ReturnCode)(400, validation.error));
        }
        // Fetch form with necessary populated fields
        const form = yield Form_model_1.default.findById(formId).populate("contentIds").lean();
        if (!form) {
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Form not found"));
        }
        // Verify user has access to the form
        const userObjectId = new mongoose_1.Types.ObjectId(user.sub);
        const { hasAccess, isCreator, isOwner, isEditor } = (0, formHelpers_1.validateAccess)(form, userObjectId);
        if (!hasAccess) {
            return res
                .status(403)
                .json((0, helper_1.ReturnCode)(403, "Access denied. You don't have permission to view this form."));
        }
        // Format the response data
        const formData = {
            _id: form._id,
            title: form.title,
            type: form.type,
            setting: form.setting,
            totalpage: form.totalpage,
            totalscore: form.totalscore,
            contentIds: form.contentIds,
            requiredemail: form.requiredemail,
            submittype: form.submittype,
            createdAt: form.createdAt
                ? (0, helper_1.FormatToGeneralDate)(form.createdAt)
                : undefined,
            updatedAt: form.updatedAt
                ? (0, helper_1.FormatToGeneralDate)(form.updatedAt)
                : undefined,
            // Include access information for the requesting user
            userAccess: {
                isCreator,
                isOwner,
                isEditor,
            },
        };
        return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200, "Form details retrieved successfully")), { data: formData }));
    }
    catch (error) {
        console.error("Get Form Details Error:", error);
        return res
            .status(500)
            .json((0, helper_1.ReturnCode)(500, "Failed to retrieve form details"));
    }
});
exports.GetFormDetails = GetFormDetails;
