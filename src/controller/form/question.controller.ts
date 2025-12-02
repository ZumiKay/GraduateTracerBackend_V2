import { Request, Response } from "express";
import { ReturnCode } from "../../utilities/helper";
import Content, {
  AnswerKey,
  ConditionalType,
  ContentType,
} from "../../model/Content.model";
import Form from "../../model/Form.model";
import mongoose, { Types } from "mongoose";

class QuestionController {
  private comparisonCache = new Map<string, boolean>();
  private readonly CACHE_SIZE_LIMIT = 1000;

  public SaveQuestion = async (req: Request, res: Response) => {
    try {
      let { data, formId, page } = req.body as {
        data: Array<ContentType>;
        formId: string;
        page?: number;
      };

      if (!Array.isArray(data) || !formId || page === undefined) {
        return res.status(400).json(ReturnCode(400, "Invalid request payload"));
      }

      //Orgainize Date
      if (data.some((i) => i.date || i.rangedate)) {
        data = data.map((i) => {
          const date = i.date
            ? this.convertStringToDate(String(i.date))
            : undefined;

          let rangedate;
          if (i.rangedate) {
            const start = this.convertStringToDate(String(i.rangedate.start));
            const end = this.convertStringToDate(String(i.rangedate.end));

            if (start && end) {
              rangedate = { start: start as Date, end: end as Date };
            }
          }

          return { ...i, date, rangedate };
        });
      }

      //Extract Content Not To Delete
      const idsToKeep = data
        .map((item) => item._id)
        .filter((id) => id && id.toString().length > 0);

      const existingContent = await Content.find({ formId, page }, null, {
        lean: true,
        maxTimeMS: 5000,
      });

      if (this.efficientChangeDetection(existingContent, data)) {
        if (process.env.NODE_ENV === "DEV") {
          console.log("⚡ No changes detected - skipping database operations");
        }
        return res.status(200).json(ReturnCode(200, "No changes detected"));
      }

      const bulkOps = [];
      const newIds: Array<Types.ObjectId | string> = [];

      const questionIdMap = new Map<number, Types.ObjectId>();

      // Generate IDs for questions that don't have
      data.forEach((item, index) => {
        if (!item._id) {
          const newId = new Types.ObjectId();
          questionIdMap.set(index, newId);
          newIds.push(newId);
        }
      });

      //Update qIdx and conditoned questions
      for (let i = 0; i < data.length; i++) {
        const { _id, ...rest } = data[i];

        //Validate Child Question Score
        if (rest.parentcontent && rest.score) {
          const parent = existingContent.find(
            (par) =>
              (par._id.toString() || par.qIdx) ===
              (rest.parentcontent?.qId || rest.parentcontent?.qIdx)
          );

          if (parent?.score && rest.score > parent.score) {
            return res
              .status(400)
              .json(
                ReturnCode(400, `Condition of ${parent.qIdx} has wrong score`)
              );
          }
        }

        const documentId = _id || questionIdMap.get(i);

        //Assign correct contentIdx responsible to qIdx
        let processedConditional: ConditionalType[] | undefined;
        if (rest.conditional) {
          processedConditional = rest.conditional
            .map((cond) => {
              if (!cond.contentId && cond.contentIdx !== undefined) {
                const referencedId =
                  data[cond.contentIdx]?._id ||
                  questionIdMap.get(cond.contentIdx);
                if (referencedId) {
                  return {
                    ...cond,
                    contentId: referencedId,
                  };
                }

                return cond;
              }
              return cond;
            })
            .filter(
              (cond) => cond.contentId || cond.contentIdx !== undefined
            ) as ConditionalType[];
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

      const operations = [];

      // Delete content
      if (idsToKeep.length >= 0) {
        const toBeDeleted = await Content.find(
          { formId, page, _id: { $nin: idsToKeep } },
          { _id: 1, score: 1, conditional: 1 },
          { lean: true }
        );

        if (toBeDeleted.length) {
          const deleteIds = toBeDeleted.map(({ _id }) => _id);
          const deletedScore = toBeDeleted
            .filter((i) => !i.parentcontent)
            .reduce((sum, { score = 0 }) => sum + score, 0);

          // Get all conditional content IDs that need to be deleted
          const conditionalIds = toBeDeleted
            .flatMap(
              (item) => item.conditional?.map((con) => con.contentId) || []
            )
            .filter(Boolean);

          const allDeleteIds = [...deleteIds, ...conditionalIds];

          const deletedIdx = toBeDeleted
            .map((i) => i.qIdx || 0)
            .sort((a, b) => a - b);

          operations.push(
            Content.deleteMany({ _id: { $in: allDeleteIds } }),
            Form.updateOne(
              { _id: formId },
              {
                $pull: { contentIds: { $in: allDeleteIds } },
                ...(deletedScore && { $inc: { totalscore: -deletedScore } }),
              }
            ),

            Content.updateMany(
              { "conditional.contentId": { $in: allDeleteIds } },
              { $pull: { conditional: { contentId: { $in: allDeleteIds } } } }
            )
          );

          const remainingQuestions = existingContent.filter((item) =>
            idsToKeep.includes(item._id)
          );

          //Mutation the remainQuestion for saving
          for (let i = 0; i < remainingQuestions.length; i++) {
            const item = remainingQuestions[i];
            const currentIdx = item.qIdx || 0;
            const deletedBeforeCurrent = deletedIdx.filter(
              (delIdx) => delIdx < currentIdx
            ).length;

            //Update question qidx after delete question
            if (deletedBeforeCurrent > 0) {
              const newIdx = currentIdx - deletedBeforeCurrent;
              operations.push(
                Content.updateOne({ _id: item._id }, { $set: { qIdx: newIdx } })
              );
            }
          }
        }
      }

      if (bulkOps.length > 0) {
        operations.push(Content.bulkWrite(bulkOps, { ordered: false }));
      }

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

      const newScore = this.isScoreHasChange(data, existingContent);
      if (newScore !== null) {
        await Form.updateOne(
          { _id: formId },
          { $set: { totalscore: newScore } }
        );
      }

      const updatedContent = await Content.find({ formId, page }, null, {
        lean: true,
        sort: {
          qIdx: 1,
        },
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

  public async DeleteQuestion(req: Request, res: Response) {
    try {
      const { id, formId }: { id: string; formId: string; qIdx: number } =
        req.body;

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

      operations.push(
        Content.updateMany(
          { "conditional.contentId": id },
          { $pull: { conditional: { contentId: id } } }
        ) as never
      );

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

      // Validate formid is a valid ObjectId
      if (!Types.ObjectId.isValid(formid as string)) {
        return res.status(400).json(ReturnCode(400, "Invalid form ID format"));
      }

      // Build query - if page is provided, filter by page, otherwise get all
      const query: any = { formId: new Types.ObjectId(formid as string) };

      if (page !== undefined && page !== null && page !== "") {
        const pageNum = Number(page);
        if (!isNaN(pageNum) && pageNum > 0) {
          query.page = pageNum;
        }
      }

      const questions = await Content.find(query)
        .select(
          "_id idx title type text multiple checkbox rangedate rangenumber date require page conditional parentcontent qIdx"
        )
        .lean()
        .sort({ page: 1, qIdx: 1 }); // Sort by page first, then by question index

      if (process.env.NODE_ENV === "DEV") {
        console.log("GetAllQuestion:", {
          formid,
          page,
          query,
          questionsFound: questions.length,
        });
      }

      return res.status(200).json({ ...ReturnCode(200), data: questions });
    } catch (error) {
      console.error("Get All Question Error:", error);
      return res
        .status(500)
        .json(ReturnCode(500, "Failed to retrieve questions"));
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

  private convertStringToDate(val: string): Date | undefined {
    const date = new Date(val);

    if (isNaN(date.getTime())) {
      return;
    }

    return date;
  }
  //Check for changed key of content
  private efficientChangeDetection(
    existing: ContentType[],
    incoming: ContentType[]
  ): boolean {
    if (existing.length !== incoming.length) {
      if (process.env.NODE_ENV === "DEV") {
        console.log(
          "⚡ Length difference detected:",
          existing.length,
          "vs",
          incoming.length
        );
      }
      return false; // Changes detected
    }

    if (existing.length === 0) return true;

    const existingMap = new Map<string, ContentType>();
    for (const item of existing) {
      if (item._id) {
        existingMap.set(item._id.toString(), item);
      }
    }

    for (const incomingItem of incoming) {
      const { _id, ...incomingData } = incomingItem;

      if (!_id) {
        if (process.env.NODE_ENV === "DEV") {
          console.log("⚡ New item detected without ID");
        }
        return false;
      }

      const existingItem = existingMap.get(_id.toString());
      if (!existingItem) {
        if (process.env.NODE_ENV === "DEV") {
          console.log("⚡ Item not found in existing:", _id.toString());
        }
        return false;
      }

      const {
        _id: existingId,
        createdAt,
        updatedAt,
        ...existingData
      } = existingItem;

      if (!this.deepEqual(existingData, incomingData)) {
        return false;
      }
    }

    // No changes detected
    if (process.env.NODE_ENV === "DEV") {
      console.log("⚡ No changes detected in", existing.length, "items");
    }
    return true;
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    const cacheKey = this.generateCacheKey(obj1, obj2);

    if (this.comparisonCache.has(cacheKey)) {
      return this.comparisonCache.get(cacheKey)!;
    }

    const result = this.performDeepEqual(obj1, obj2);

    this.cacheResult(cacheKey, result);

    return result;
  }

  private generateCacheKey(obj1: any, obj2: any): string {
    try {
      const type1 = typeof obj1;
      const type2 = typeof obj2;
      const isArray1 = Array.isArray(obj1);
      const isArray2 = Array.isArray(obj2);

      return `${type1}_${type2}_${isArray1}_${isArray2}_${
        obj1?.constructor?.name || "none"
      }_${obj2?.constructor?.name || "none"}`;
    } catch {
      return `fallback_${Math.random()}`;
    }
  }

  private cacheResult(key: string, result: boolean): void {
    if (this.comparisonCache.size >= this.CACHE_SIZE_LIMIT) {
      const firstKey = this.comparisonCache.keys().next().value;
      if (firstKey) {
        this.comparisonCache.delete(firstKey);
      }
    }

    this.comparisonCache.set(key, result);
  }

  private performDeepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (obj1 == null || obj2 == null) {
      return obj1 === obj2;
    }

    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (typeof obj1 !== "object") {
      return obj1 === obj2;
    }

    if (obj1 instanceof Date && obj2 instanceof Date) {
      return obj1.getTime() === obj2.getTime();
    }

    if (obj1 instanceof Date || obj2 instanceof Date) {
      return false;
    }

    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return false;
    }

    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) return false;

      for (let i = 0; i < obj1.length; i++) {
        if (!this.performDeepEqual(obj1[i], obj2[i])) {
          return false;
        }
      }
      return true;
    }

    if (
      obj1.toString &&
      obj2.toString &&
      typeof obj1.toString === "function" &&
      typeof obj2.toString === "function"
    ) {
      try {
        const str1 = obj1.toString();
        const str2 = obj2.toString();
        if (str1.length === 24 && str2.length === 24) {
          return str1 === str2;
        }
      } catch {
        // Not ObjectIds, continue with regular comparison
      }
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }

      if (!this.performDeepEqual(obj1[key], obj2[key])) {
        return false;
      }
    }

    return true;
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
        .filter((ques) => !ques.parentcontent)
        .reduce((total, { score = 0 }) => total + score, 0);
    };

    const incomingTotal = calculateTotal(incoming);
    const prevTotal = calculateTotal(prevContent);

    return incomingTotal !== prevTotal ? incomingTotal : null;
  }
}

export default new QuestionController();
