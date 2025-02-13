import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Content, { AnswerKey, ContentType } from "../model/Content.model";
import Form from "../model/Form.model";
import mongoose, { SchemaType, SchemaTypes, Types } from "mongoose";

class QuestionController {
  public SaveQuestion = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    try {
      const { data, formId, page } = req.body as {
        data: Array<ContentType>;
        formId: string;
        page?: number;
      };

      // Validate input
      if (!Array.isArray(data) || !formId || !page) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      // Extract valid IDs once
      const idsToKeep = data.map((item) => item._id).filter(Boolean);

      // Optimize query with projection and index utilization
      const existingContent = await Content.find(
        { formId, page },
        { _id: 1, formId: 1, page: 1 }, // Project only necessary fields
        { lean: true, maxTimeMS: 5000 } // Add query timeout
      );

      // Efficient change detection
      if (await this.efficientChangeDetection(existingContent, data)) {
        return res.status(200).json(ReturnCode(200, "No changes detected"));
      }

      // Start transaction
      session.startTransaction();

      // Delete unnecessary content
      if (page) {
        await Content.deleteMany(
          { _id: { $nin: idsToKeep }, page },
          { session }
        );
      }

      // Bulk write with proper upsert handling
      if (data.length > 0) {
        const bulkWriteResult = await Content.bulkWrite(
          data.map(({ _id, ...rest }) => ({
            updateOne: {
              filter: { _id: _id || new Types.ObjectId() },
              update: {
                $set: { ...rest, formId, updatedAt: new Date() },
              },
              upsert: true,
            },
          })),
          { ordered: false, session, writeConcern: { w: 1 } }
        );

        // Update form references if new content was created
        const upsertedIds = Object.values(bulkWriteResult.upsertedIds);
        if (upsertedIds.length > 0) {
          await Form.findByIdAndUpdate(
            formId,
            {
              $addToSet: { contentIds: { $each: upsertedIds } },
              $set: { updatedAt: new Date() },
            },
            { session, new: true }
          );
        }
      }

      // Commit transaction
      await session.commitTransaction();
      return res.status(200).json(ReturnCode(200, "Saved successfully"));
    } catch (error) {
      console.error("SaveQuestion Error:", error);

      // Handle Mongoose-specific errors
      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json(ReturnCode(400, "Validation Error"));
      }
      if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json(ReturnCode(400, "Invalid ID Format"));
      }

      // Rollback transaction on failure
      await session.abortTransaction();
      return res.status(500).json(ReturnCode(500, "Internal Server Error"));
    } finally {
      session.endSession(); // Ensure session ends in all cases
    }
  };
  public handleCondition = async (req: Request, res: Response) => {
    try {
      const { contentId, key, newContent, formId } = req.body as {
        contentId: Types.ObjectId;
        key: Types.ObjectId;
        newContent: ContentType;
        formId: string;
      };

      if (!contentId || key === undefined || !newContent || !formId) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      const newContentId = new Types.ObjectId();

      // Perform both operations in parallel
      const [newContentCreated, updateResult] = await Promise.all([
        Content.create({
          ...newContent,
          _id: newContentId,
          formId,
          conditional: [],
        }),
        Content.updateOne(
          { _id: contentId },
          {
            $push: { conditional: { key, contentId: newContentId } },
          }
        ),
        Form.updateOne(
          { _id: formId },
          { $push: { contentIds: newContentId } }
        ),
      ]);

      if (!updateResult.modifiedCount) {
        return res.status(400).json(ReturnCode(400, "Content not found"));
      }

      return res
        .status(200)
        .json({ ...ReturnCode(200), data: { newContentId } });
    } catch (error) {
      console.error("Add Condition Error:", error);
      return res.status(500).json(ReturnCode(500, "Internal Server Error"));
    }
  };

  public async DeleteQuestion(req: Request, res: Response) {
    try {
      const { id, formId }: { id: string; formId: string } = req.body;

      if (!id || !formId) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      const tobeDelete = await Content.findById(id)
        .select("conditional")
        .lean();

      if (!tobeDelete) return res.status(400).json(ReturnCode(400));

      //Check if the question is linked
      await Content.updateMany(
        { "conditional.contentId": id },
        { $pull: { conditional: { contentId: id } } }
      );

      //Delete Condition Questions
      if (tobeDelete?.conditional) {
        await Content.deleteMany({
          _id: { $in: tobeDelete.conditional.map((con) => con.contentId) },
        });
      }

      const deleteContent = Content.deleteOne({ _id: id });
      const updateForm = Form.updateOne(
        { _id: formId },
        { $pull: { contentIds: id } }
      );

      await Promise.all([deleteContent, updateForm]);

      return res.status(200).json(ReturnCode(200, "Question Deleted"));
    } catch (error) {
      console.error("Delete Question Error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Error occurred while deleting question"));
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
  private async efficientChangeDetection(
    existing: any[],
    incoming: any[]
  ): Promise<boolean> {
    if (existing.length !== incoming.length) return false;

    const existingMap = new Map(
      existing.map((item) => [item._id.toString(), item])
    );
    return incoming.every((item) => {
      const existingItem = existingMap.get(item._id?.toString());
      return (
        existingItem &&
        JSON.stringify(existingItem) ===
          JSON.stringify({ ...item, _id: existingItem._id })
      );
    });
  }
}

export default new QuestionController();
