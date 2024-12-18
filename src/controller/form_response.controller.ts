import { Response } from "express";
import { ReturnCode } from "../utilities/helper";
import FormResponse, { FormResponseType } from "../model/Response.model";
import Zod from "zod";
import { CustomRequest } from "../types/customType";

class FormResponseController {
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 5;

  static responseValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      responseset: Zod.array(
        Zod.object({
          questionId: Zod.string().min(1, "Question is required"),
          response: Zod.any(),
        })
      ).nonempty("Responseset cannot be empty"),
    }),
  });

  public SubmitResponse = async (req: CustomRequest, res: Response) => {
    const submitdata = req.body as FormResponseType;

    try {
      await FormResponse.create({
        ...submitdata,
        userId: req.user?.id, // Optional chaining for safety
      });

      res.status(200).json(ReturnCode(200, "Form Submitted"));
    } catch (error) {
      console.error("Submit Response Error:", { error, body: req.body });
      res.status(500).json(ReturnCode(500, "Failed to submit the form"));
    }
  };

  public GetResponseByFormId = async (req: CustomRequest, res: Response) => {
    const id = req.query.id as string;
    const page = Number(req.query.p) || FormResponseController.DEFAULT_PAGE;
    const limit = Number(req.query.lt) || FormResponseController.DEFAULT_LIMIT;

    if (!id) {
      return res.status(400).json(ReturnCode(400, "Form ID is required"));
    }

    try {
      const responses = await FormResponse.find({ formId: id })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).json({ ...ReturnCode(200), data: responses });
    } catch (error) {
      console.error("Get Response By FormId Error:", {
        error,
        query: req.query,
      });
      res.status(500).json(ReturnCode(500, "Failed to retrieve responses"));
    }
  };

  public GetResponseByUserId = async (req: CustomRequest, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json(ReturnCode(400, "User ID is required"));
    }

    try {
      const response = await FormResponse.findOne({ userId });
      res.status(200).json({ ...ReturnCode(200), data: response });
    } catch (error) {
      console.error("Get Response By UserId Error:", {
        error,
        query: req.query,
      });
      res.status(500).json(ReturnCode(500, "Failed to retrieve response"));
    }
  };
  public GetGuestResponse = async (req: CustomRequest, res: Response) => {
    const { formId } = req.query;
    try {
      const response = await FormResponse.find({
        $and: [{ formId }, { userId: null }],
      });
      return res.status(200).json({ ...ReturnCode(200), data: response });
    } catch (error) {
      console.log("Get Guest Response", error);
      return res.status(500).json(ReturnCode(500));
    }
  };
}

export default new FormResponseController();
