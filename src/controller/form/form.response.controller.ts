import { Response } from "express";
import { FormatToGeneralDate, ReturnCode } from "../../utilities/helper";
import Form from "../../model/Form.model";
import { CustomRequest } from "../../types/customType";
import { Types } from "mongoose";
import {
  isValidObjectIdString,
  validateAccess,
  validateFormRequest,
} from "../../utilities/formHelpers";
import FormResponse, { FormResponseType } from "../../model/Response.model";

export const GetFilledForm = async (req: CustomRequest, res: Response) => {
  try {
    const { formId, responseId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    if (!isValidObjectIdString(formId)) {
      return res.status(400).json(ReturnCode(400, "Invalid form ID"));
    }

    const formObjectId = new Types.ObjectId(formId);
    const userObjectId = new Types.ObjectId(user.sub);

    const form = await Form.findById(formObjectId).lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    const responseQuery: Record<string, Types.ObjectId> = {
      formId: formObjectId,
      userId: userObjectId,
    };

    if (responseId && isValidObjectIdString(responseId)) {
      responseQuery._id = new Types.ObjectId(responseId);
    }

    //Get User Response
    const userResponses = await FormResponse.find({
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
        .json(ReturnCode(404, "No responses found for this form"));
    }

    //Data mutation
    let currentResponse = userResponses[0];
    if (responseId && isValidObjectIdString(responseId)) {
      const specificResponse = userResponses.find(
        (resp) => resp._id.toString() === responseId
      );
      if (specificResponse) {
        currentResponse = specificResponse;
      }
    }

    const formatResponseData = (response: FormResponseType) => ({
      ...response,
      updatedAt: response.updatedAt
        ? FormatToGeneralDate(response.updatedAt)
        : undefined,
    });

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

    return res.status(200).json({
      ...ReturnCode(200, "Filled form data retrieved successfully"),
      data: responseData,
    });
  } catch (error) {
    console.error("Get Filled Form Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to retrieve filled form data"));
  }
};

/**
 * Get Form Details with Access Verification
 * Used by ViewResponsePage to fetch form data
 * Verifies that the user has access to the form before returning details
 */
export const GetFormDetails = async (req: CustomRequest, res: Response) => {
  try {
    const { formId } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json(ReturnCode(401, "Unauthorized"));
    }

    // Validate form ID format
    const validation = validateFormRequest(formId);
    if (!validation.isValid) {
      return res.status(400).json(ReturnCode(400, validation.error));
    }

    // Fetch form with necessary populated fields
    const form = await Form.findById(formId).populate("contentIds").lean();

    if (!form) {
      return res.status(404).json(ReturnCode(404, "Form not found"));
    }

    // Verify user has access to the form
    const userObjectId = new Types.ObjectId(user.sub);
    const { hasAccess, isCreator, isOwner, isEditor } = validateAccess(
      form,
      userObjectId
    );

    if (!hasAccess) {
      return res
        .status(403)
        .json(
          ReturnCode(
            403,
            "Access denied. You don't have permission to view this form."
          )
        );
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
        ? FormatToGeneralDate(form.createdAt)
        : undefined,
      updatedAt: form.updatedAt
        ? FormatToGeneralDate(form.updatedAt)
        : undefined,
      // Include access information for the requesting user
      userAccess: {
        isCreator,
        isOwner,
        isEditor,
      },
    };

    return res.status(200).json({
      ...ReturnCode(200, "Form details retrieved successfully"),
      data: formData,
    });
  } catch (error) {
    console.error("Get Form Details Error:", error);
    return res
      .status(500)
      .json(ReturnCode(500, "Failed to retrieve form details"));
  }
};
