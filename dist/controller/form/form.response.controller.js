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
exports.validateFormResponses = exports.GetFormDetails = exports.GetFilledForm = void 0;
const helper_1 = require("../../utilities/helper");
const Form_model_1 = __importStar(require("../../model/Form.model"));
const mongoose_1 = require("mongoose");
const formHelpers_1 = require("../../utilities/formHelpers");
const Response_model_1 = __importStar(require("../../model/Response.model"));
const GetFilledForm = async (req, res) => {
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
        const form = await Form_model_1.default.findById(formObjectId).lean();
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
        const userResponses = await Response_model_1.default.find({
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
        const isManualScoring = form.setting?.returnscore === Form_model_1.returnscore.manual;
        const isOwnerOrEditor = (0, formHelpers_1.hasFormAccess)(form, userObjectId);
        const formatResponseData = (response) => {
            const hideScore = isManualScoring && !response.isReturned && !isOwnerOrEditor;
            return {
                ...response,
                totalScore: hideScore ? undefined : response.totalScore,
                extraScore: hideScore ? undefined : response.extraScore,
                isScoreReleased: !hideScore,
                responseset: hideScore
                    ? response.responseset?.map((r) => ({
                        ...r,
                        score: undefined,
                        comment: undefined,
                    }))
                    : response.responseset,
                updatedAt: response.updatedAt
                    ? (0, helper_1.FormatToGeneralDate)(response.updatedAt)
                    : undefined,
            };
        };
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
        return res.status(200).json({
            ...(0, helper_1.ReturnCode)(200, "Filled form data retrieved successfully"),
            data: responseData,
        });
    }
    catch (error) {
        console.error("Get Filled Form Error:", error);
        return res
            .status(500)
            .json((0, helper_1.ReturnCode)(500, "Failed to retrieve filled form data"));
    }
};
exports.GetFilledForm = GetFilledForm;
/**
 * Get Form Details with Access Verification
 * Used by ViewResponsePage to fetch form data
 * Verifies that the user has access to the form before returning details
 */
const GetFormDetails = async (req, res) => {
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
        const form = await Form_model_1.default.findById(formId).populate("contentIds").lean();
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
        return res.status(200).json({
            ...(0, helper_1.ReturnCode)(200, "Form details retrieved successfully"),
            data: formData,
        });
    }
    catch (error) {
        console.error("Get Form Details Error:", error);
        return res
            .status(500)
            .json((0, helper_1.ReturnCode)(500, "Failed to retrieve form details"));
    }
};
exports.GetFormDetails = GetFormDetails;
const validateFormResponses = async (req, res) => {
    const { formId } = req.params;
    if (!formId)
        return res.status(400).json((0, helper_1.ReturnCode)(400));
    try {
        const isForm = await Form_model_1.default.findById(formId).select("type setting.acceptResponses user editors owners");
        if (!isForm || !(0, formHelpers_1.hasFormAccess)(isForm, new mongoose_1.Types.ObjectId(req.user?.sub)))
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        const allResponse = await Response_model_1.default.find({ formId })
            .select("completionStatus submittedAt ")
            .lean();
        if (!allResponse || allResponse.length === 0)
            return res.status(200).json((0, helper_1.ReturnCode)(200));
        //Process form responses summary
        const summaryResult = {
            toScore: 0,
            completed: 0,
            submitted: 0,
        };
        allResponse.forEach((response) => {
            if (response.completionStatus === Response_model_1.ResponseCompletionStatus.submitted) {
                summaryResult.submitted += 1;
                if (isForm.type === Form_model_1.TypeForm.Quiz)
                    summaryResult.toScore += 1;
            }
            else if (response.completionStatus === Response_model_1.ResponseCompletionStatus.completed) {
                summaryResult.completed += 1;
            }
        });
        return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: summaryResult });
    }
    catch (error) {
        console.log("validateFormRespones", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
};
exports.validateFormResponses = validateFormResponses;
