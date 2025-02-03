import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Content, { AnswerKey, ContentType } from "../model/Content.model";
import Form from "../model/Form.model";
import { Types } from "mongoose";

class QuestionController {
  public async SaveQuestion(req: Request, res: Response) {
    try {
      const data = req.body as Array<ContentType>;

      // 1. Data preparation optimization
      const operations = data.map((question) => {
        const updateDoc = { ...question };
        const filter = { _id: updateDoc._id || new Types.ObjectId() };

        delete updateDoc._id;

        return {
          updateOne: {
            filter,
            update: { $set: updateDoc },
            upsert: true,
          },
        };
      });

      const result = await Content.bulkWrite(operations, {
        ordered: false, // Allow parallel execution
        writeConcern: { w: 1 }, // Faster acknowledgement
        bypassDocumentValidation: false, // Maintain schema validation
      });

      return res.status(200).json({
        success: true,
        inserted: result.upsertedCount,
        modified: result.modifiedCount,
        message: "Questions saved successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("SaveQuestion Error:", errorMessage);

      return res.status(500).json({
        success: false,
        error: "Internal server error",
        reference: Date.now().toString(36), // Unique error reference
      });
    }
  }
  public async DeleteQuestion(req: Request, res: Response) {
    try {
      const id = req.body;

      if (!id) return res.status(400).json(ReturnCode(400));
      await Content.deleteOne({ _id: id });

      return res.status(200).json(ReturnCode(200, "Question Deleted"));
    } catch (error) {
      console.log("Delete Question", error);
      return res.status(500).json(ReturnCode(500));
    }
  }

  public async GetAllQuestion(req: Request, res: Response) {
    try {
      const { formid, page } = req.query;

      if (!formid) return res.status(400).json(ReturnCode(400));

      const response = await Form.findById(formid)
        .populate("contentIds")
        .where("page")
        .equals(page)
        .exec();

      return res.status(200).json({ ...ReturnCode(200), data: response });
    } catch (error) {
      console.log("Get All Question", error);
      return res.status(500).json(ReturnCode(500));
    }
  }

  public async SaveSolution(req: Request, res: Response) {
    try {
      const data = req.body as Array<AnswerKey>;

      if (!data || data.length === 0)
        return res.status(400).json(ReturnCode(400));

      //save answer key
      await Form.bulkWrite(
        data.map((solution) => ({
          updateOne: {
            filter: { _id: solution._id }, // search query
            update: { $set: { answer: solution } }, // field:values to update ,
            upsert: true, // insert the data if not exist
          },
        }))
      );
      return res.status(200).json(ReturnCode(200, "Solution Saved"));
    } catch (error) {
      console.log("Save Solution", error);
      return res.status(500).json(ReturnCode(500));
    }
  }
}

export default new QuestionController();
