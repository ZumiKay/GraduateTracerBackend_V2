import { Response } from "express";
import { ReturnCode } from "../utilities/helper";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
} from "../model/Response.model";
import Zod from "zod";
import { CustomRequest } from "../types/customType";
import Content from "../model/Content.model";
import { Types } from "mongoose";
import { returnscore } from "../model/Form.model";

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

    let autoscore = null;
    try {
      if (submitdata.returnscore === returnscore.partial) {
        autoscore = await Promise.all(
          submitdata.responseset.map(async (response) => {
            return await this.AddScore(
              new Types.ObjectId(response.questionId),
              response
            );
          })
        );
      }

      await FormResponse.create({
        ...submitdata,
        responseset: autoscore ?? submitdata.responseset,
        userId: req.user?.id,
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

  //Add Score for the response
  public AddScore = async (qid: Types.ObjectId, response: ResponseSetType) => {
    try {
      const content = await Content.findById(qid)
        .select("answer score")
        .lean()
        .exec();

      if (!content?.answer) return null;

      const correctAnswer = content.answer;
      const responseValue = response.response;
      let score = 0;

      switch (true) {
        case typeof responseValue === "boolean":
        case typeof responseValue === "string":
        case typeof responseValue === "number":
          score =
            responseValue === (correctAnswer as any) ? content.score ?? 0 : 0;
          break;

        case responseValue instanceof Date:
          // Compare timestamps instead of Date objects
          score =
            responseValue.getTime() ===
            (correctAnswer as unknown as Date)?.getTime()
              ? content.score ?? 0
              : 0;
          break;

        case typeof responseValue === "object":
          score = this.deepEqual(responseValue, correctAnswer)
            ? content.score ?? 0
            : 0;
          break;

        default:
          score = 0;
      }

      return { ...response, score };
    } catch (error) {
      console.error("AddScore Error:", error);
      return null;
    }
  };

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || !a || !b)
      return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        this.deepEqual(a[key], b[key])
    );
  }
}

export default new FormResponseController();
