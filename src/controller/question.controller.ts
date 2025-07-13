import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";
import Content, {
  AnswerKey,
  ConditionalType,
  ContentType,
} from "../model/Content.model";
import Form from "../model/Form.model";
import mongoose, { Types } from "mongoose";

class QuestionController {
  public SaveQuestion = async (req: Request, res: Response) => {
    try {
      const { data, formId, page } = req.body as {
        data: Array<ContentType>;
        formId: string;
        page?: number;
      };

      // Validate input
      if (!Array.isArray(data) || !formId || page === undefined) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      // Extract valid IDs and get existing content in parallel
      const idsToKeep = data
        .map((item) => item._id)
        .filter((id) => id && id.length > 0);

      const existingContent = await Content.find({ formId, page }, null, {
        lean: true,
        maxTimeMS: 5000,
      });

      // Early return if no changes
      if (await this.efficientChangeDetection(existingContent, data)) {
        return res.status(200).json(ReturnCode(200, "No changes detected"));
      }

      // Prepare bulk operations
      const bulkOps = [];
      const newIds: Array<Types.ObjectId | string> = [];
      const hasConditions = data.some((item) => item.conditional);

      // Create a map to track new IDs for questions that need them
      const questionIdMap = new Map<number, Types.ObjectId>();

      // Pre-generate IDs for questions that don't have them
      data.forEach((item, index) => {
        if (!item._id) {
          const newId = new Types.ObjectId();
          questionIdMap.set(index, newId);
          newIds.push(newId);
        }
      });

      // Process data and create bulk operations
      for (let i = 0; i < data.length; i++) {
        const { _id, ...rest } = data[i];
        const documentId = _id || questionIdMap.get(i);

        // Process conditional questions - update contentId references
        let processedConditional = rest.conditional;
        if (rest.conditional) {
          processedConditional = rest.conditional
            .map((cond) => {
              // If contentId is missing but contentIdx is provided, use the mapped ID
              if (!cond.contentId && cond.contentIdx !== undefined) {
                const referencedId =
                  data[cond.contentIdx]?._id ||
                  questionIdMap.get(cond.contentIdx);
                return {
                  ...cond,
                  contentId: referencedId,
                };
              }
              return cond;
            })
            .filter((cond) => cond.contentId) as ConditionalType[]; // Only keep conditions with valid contentId
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: documentId },
            update: {
              $set: {
                ...rest,
                conditional: processedConditional,
                formId,
                page,
                updatedAt: new Date(),
              },
            },
            upsert: true,
            setDefaultsOnInsert: true,
          },
        });
      }

      // Execute operations in parallel
      const operations = [];

      // Delete unnecessary content
      if (idsToKeep.length >= 0) {
        const toBeDeleted = await Content.find(
          { formId, page, _id: { $nin: idsToKeep } },
          { _id: 1, score: 1, conditional: 1 },
          { lean: true }
        );

        if (toBeDeleted.length) {
          const deleteIds = toBeDeleted.map(({ _id }) => _id);
          const deletedScore = toBeDeleted.reduce(
            (sum, { score = 0 }) => sum + score,
            0
          );

          // Get all conditional content IDs that need to be deleted
          const conditionalIds = toBeDeleted
            .flatMap(
              (item) => item.conditional?.map((con) => con.contentId) || []
            )
            .filter(Boolean);

          const allDeleteIds = [...deleteIds, ...conditionalIds];

          operations.push(
            Content.deleteMany({ _id: { $in: allDeleteIds } }),
            Form.updateOne(
              { _id: formId },
              {
                $pull: { contentIds: { $in: allDeleteIds } },
                ...(deletedScore && { $inc: { totalscore: -deletedScore } }),
              }
            ),
            // Remove references to deleted content in other conditionals
            Content.updateMany(
              { "conditional.contentId": { $in: allDeleteIds } },
              { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }
            )
          );
        }
      }

      // Bulk write content
      if (bulkOps.length > 0) {
        operations.push(Content.bulkWrite(bulkOps, { ordered: false }));
      }

      // Update form with new content IDs
      if (newIds.length > 0) {
        operations.push(
          Form.updateOne(
            { _id: formId },
            {
              $addToSet: { contentIds: { $each: newIds } },
              $set: { updatedAt: new Date() },
            }
          )
        );
      }

      await Promise.all(operations);

      // Handle parent-child relationships for conditional questions
      if (hasConditions) {
        const finalData = data.map((item, index) => ({
          ...item,
          _id: item._id || questionIdMap.get(index),
        }));

        const handledConditionData = this.handleUpdateCondition(
          finalData as Array<ContentType>
        );

        const conditionUpdates = handledConditionData
          .filter(
            (newItem, index) =>
              JSON.stringify(newItem.parentcontent) !==
              JSON.stringify(finalData[index].parentcontent)
          )
          .map(({ _id, parentcontent }) => ({
            updateOne: {
              filter: { _id },
              update: { $set: { parentcontent } },
            },
          }));

        if (conditionUpdates.length > 0) {
          await Content.bulkWrite(conditionUpdates, { ordered: false });
        }
      }

      // Update total score if changed
      const newScore = this.isScoreHasChange(data, existingContent);
      if (newScore !== null) {
        await Form.updateOne(
          { _id: formId },
          { $set: { totalscore: newScore } }
        );
      }

      // Get final updated content
      const updatedContent = await Content.find({ formId, page }, null, {
        lean: true,
      });

      return res.status(200).json({
        ...ReturnCode(200, "Saved successfully"),
        data: updatedContent,
      });
    } catch (error) {
      console.error("SaveQuestion Error:", error);

      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json(ReturnCode(400, "Validation Error"));
      }
      if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json(ReturnCode(400, "Invalid ID Format"));
      }

      return res.status(500).json(ReturnCode(500, "Internal Server Error"));
    }
  };

  public handleCondition = async (req: Request, res: Response) => {
    try {
      const { content, key, newContent, formId } = req.body as {
        content: { id: string; idx: number };
        key: Types.ObjectId;
        newContent: ContentType;
        formId: string;
      };

      if (!content || key === undefined || !newContent || !formId) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      const newContentId = new Types.ObjectId();

      // Perform operations in parallel
      const [newContentCreated, updateResult] = await Promise.all([
        Content.create({
          ...newContent,
          _id: newContentId,
          formId,
          conditional: [],
          parentcontent: { qIdx: content.idx, optIdx: key },
        }),
        Content.updateOne(
          { _id: content.id },
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
        .json({ ...ReturnCode(200), data: newContentCreated._id });
    } catch (error) {
      console.error("Add Condition Error:", error);
      return res.status(500).json(ReturnCode(500, "Internal Server Error"));
    }
  };

  public removeCondition = async (req: Request, res: Response) => {
    try {
      const { formId, contentId } = req.body as {
        formId: string;
        contentId: string;
      };

      if (!formId || !contentId) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      // Remove the conditional content and update parent
      const [deleteResult] = await Promise.all([
        Content.deleteOne({ _id: contentId }),
        Content.updateMany(
          { "conditional.contentId": contentId },
          { $pull: { conditional: { contentId } } }
        ),
        Form.updateOne({ _id: formId }, { $pull: { contentIds: contentId } }),
      ]);

      if (!deleteResult.deletedCount) {
        return res.status(400).json(ReturnCode(400, "Content not found"));
      }

      return res.status(200).json(ReturnCode(200, "Condition removed"));
    } catch (error) {
      console.log("Remove Condition", error);
      return res.status(500).json(ReturnCode(500));
    }
  };

  public async DeleteQuestion(req: Request, res: Response) {
    try {
      const { id, formId }: { id: string; formId: string } = req.body;

      if (!id || !formId) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      const tobeDelete = await Content.findById(id)
        .select("conditional score")
        .lean();

      if (!tobeDelete) {
        return res.status(400).json(ReturnCode(400, "Content not found"));
      }

      const conditionalIds =
        tobeDelete.conditional?.map((con) => con.contentId) || [];

      // Perform all operations in parallel
      const operations = [
        Content.deleteOne({ _id: id }),
        Form.updateOne(
          { _id: formId },
          {
            $pull: { contentIds: id },
            $inc: { totalscore: -(tobeDelete.score || 0) },
          }
        ),
      ];

      // Remove references to this content in other conditionals
      operations.push(
        Content.updateMany(
          { "conditional.contentId": id },
          { $pull: { conditional: { contentId: id } } }
        ) as never
      );

      // Delete conditional questions if they exist
      if (conditionalIds.length > 0) {
        operations.push(
          Content.deleteMany({ _id: { $in: conditionalIds } }),
          Form.updateOne(
            { _id: formId },
            { $pull: { contentIds: { $in: conditionalIds } } }
          ) as never
        );
      }

      await Promise.all(operations);

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

      if (!formid) {
        return res.status(400).json(ReturnCode(400, "Form ID is required"));
      }

      const query =
        page !== undefined ? { formId: formid, page } : { formId: formid };
      const questions = await Content.find(query).lean();

      return res.status(200).json({ ...ReturnCode(200), data: questions });
    } catch (error) {
      console.log("Get All Question", error);
      return res.status(500).json(ReturnCode(500));
    }
  }

  public async SaveSolution(req: Request, res: Response) {
    try {
      const data = req.body as Array<AnswerKey>;

      if (!data || data.length === 0) {
        return res
          .status(400)
          .json(ReturnCode(400, "No solution data provided"));
      }

      // Save answer key
      await Form.bulkWrite(
        data.map((solution) => ({
          updateOne: {
            filter: { _id: solution._id },
            update: { $set: { answer: solution } },
            upsert: true,
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
      if (!item._id) return false;
      const existingItem = existingMap.get(item._id.toString());
      if (!existingItem) return false;

      const { _id, updatedAt, ...existingData } = existingItem;
      const { _id: incomingId, ...incomingData } = item;

      return JSON.stringify(existingData) === JSON.stringify(incomingData);
    });
  }

  private isScoreHasChange(
    incoming: ContentType[],
    prevContent: ContentType[]
  ): number | null {
    const calculateTotal = (items: Array<ContentType>) => {
      const seen = new Set<string>();
      return items
        .filter((item) => {
          const key = item._id?.toString() || "";
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .reduce((total, { score = 0 }) => total + score, 0);
    };

    const incomingTotal = calculateTotal(incoming);
    const prevTotal = calculateTotal(prevContent);

    return incomingTotal !== prevTotal ? incomingTotal : null;
  }

  private handleUpdateCondition(data: Array<ContentType>) {
    if (!data || data.length === 0) return data;

    // Create a map for quick lookup of questions by index
    const dataMap = new Map<number, string>();
    data.forEach((q, idx) => {
      if (q.conditional) {
        q.conditional.forEach((cond) => {
          if (cond.contentIdx !== undefined) {
            dataMap.set(cond.contentIdx, data[cond.contentIdx]?._id as string);
          }
        });
      }
    });

    // First pass: Update conditional contentIds
    const updatedData = data.map((question) => {
      if (!question.conditional) return question;

      return {
        ...question,
        conditional: question.conditional.map((cond) => ({
          ...cond,
          contentId: dataMap.get(cond.contentIdx!) || cond.contentId,
          contentIdx: undefined,
        })),
      };
    });

    // Create a parent mapping
    const parentMap = new Map<string, string>();
    updatedData.forEach((q) => {
      if (q.conditional) {
        q.conditional.forEach((cond) => {
          if (cond.contentId) {
            parentMap.set(cond.contentId as string, q._id as string);
          }
        });
      }
    });

    // Second pass: Update parentcontent
    return updatedData.map((question) => {
      if (!question._id) return question;

      const parentId = parentMap.get(question._id);
      return parentId
        ? {
            ...question,
            parentcontent: { ...(question.parentcontent || {}), qId: parentId },
          }
        : question;
    });
  }
}

export default new QuestionController();
