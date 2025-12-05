import { Request, Response } from "express";
import { AddQuestionNumbering, ReturnCode } from "../../utilities/helper";
import { getLastQuestionIdx } from "../../utilities/formHelpers";
import Content, {
  AnswerKey,
  ConditionalType,
  ContentType,
} from "../../model/Content.model";
import Form from "../../model/Form.model";
import mongoose, { Types } from "mongoose";

interface SaveQuestionPayload {
  data: Array<ContentType>;
  formId: string;
  page?: number;
}

interface DeleteOperationResult {
  operations: Promise<any>[];
  deletedIds: Types.ObjectId[];
}

class QuestionController {
  private comparisonCache = new Map<string, boolean>();
  private readonly CACHE_SIZE_LIMIT = 1000;

  /**
   * Save Question Handler
   *
   * Features:
   * - Question creation and update
   * - Conditional question processing
   * - Score calculation
   * - Automatic cleanup of deleted questions
   */
  public SaveQuestion = async (req: Request, res: Response) => {
    try {
      const payload = req.body as SaveQuestionPayload;

      // Step 1: Validate request
      const validationError = this.validateSaveQuestionPayload(payload);
      if (validationError) {
        return res.status(400).json(ReturnCode(400, validationError));
      }

      const { formId, page } = payload;
      let { data } = payload;

      // Step 2: Normalize date fields
      data = this.normalizeDateFields(data);

      // Step 3: Fetch existing content and check for changes
      const existingContent = await this.fetchExistingContent(formId, page!);

      if (this.efficientChangeDetection(existingContent, data)) {
        this.logDev("⚡ No changes detected - skipping database operations");
        return res.status(200).json(ReturnCode(200, "No changes detected"));
      }

      // Step 4: Generate IDs for new questions
      const { questionIdMap, newIds } = this.generateNewQuestionIds(data);

      // Step 5: Validate child question scores
      const scoreValidationError = this.validateChildQuestionScores(
        data,
        existingContent
      );
      if (scoreValidationError) {
        return res.status(400).json(ReturnCode(400, scoreValidationError));
      }

      // Step 6: Build bulk operations for upsert
      const bulkOps = this.buildBulkOperations(
        data,
        questionIdMap,
        formId,
        page!
      );

      // Step 7: Handle deletions
      const idsToKeep = this.extractIdsToKeep(data);
      const deleteResult = await this.handleDeletions(
        formId,
        page!,
        idsToKeep,
        existingContent
      );

      // Step 8: Execute all database operations
      await this.executeOperations(
        bulkOps,
        newIds,
        formId,
        deleteResult.operations
      );

      // Step 9: Initialize totalscore
      const form = await Form.findById(formId).select("totalscore");
      if (!form?.totalscore) {
        // Calculate total score of all questions
        const computedTotalScore = await this.calculateFormTotalScore(formId);
        await Form.updateOne(
          { _id: formId },
          { totalscore: computedTotalScore }
        );
      } else {
        // Update total score based on changes in current page
        await this.updateTotalScoreIfChanged(data, existingContent, formId);
      }

      // Step 10: Return updated content
      const updatedContent = await this.fetchUpdatedContent(formId, page!);

      // Get cumulative question count from previous pages for proper numbering
      const lastQuestionIdx = await getLastQuestionIdx(formId, page!);

      return res.status(200).json({
        ...ReturnCode(200, "Saved successfully"),
        data: AddQuestionNumbering({
          questions: updatedContent,
          lastIdx: lastQuestionIdx,
        }),
      });
    } catch (error) {
      return this.handleSaveQuestionError(error, res);
    }
  };

  // ==================== Helper Methods for SaveQuestion ====================

  /**
   * Validates the request payload for SaveQuestion
   */
  private validateSaveQuestionPayload(
    payload: SaveQuestionPayload
  ): string | null {
    const { data, formId, page } = payload;

    if (!Array.isArray(data) || !formId || page === undefined) {
      return "Invalid request payload";
    }

    return null;
  }

  /**
   * Normalizes date and rangedate fields in the data array
   */
  private normalizeDateFields(data: ContentType[]): ContentType[] {
    if (!data.some((i) => i.date || i.rangedate)) {
      return data;
    }

    return data.map((item) => {
      const date = item.date
        ? this.convertStringToDate(String(item.date))
        : undefined;

      let rangedate;
      if (item.rangedate) {
        const start = this.convertStringToDate(String(item.rangedate.start));
        const end = this.convertStringToDate(String(item.rangedate.end));

        if (start && end) {
          rangedate = { start, end };
        }
      }

      return { ...item, date, rangedate };
    });
  }

  /**
   * Fetches existing content from the database
   */
  private async fetchExistingContent(
    formId: string,
    page: number
  ): Promise<ContentType[]> {
    return Content.find({ formId, page }, null, {
      lean: true,
      maxTimeMS: 5000,
    });
  }

  /**
   * Generates new ObjectIds for questions that don't have one
   */
  private generateNewQuestionIds(data: ContentType[]): {
    questionIdMap: Map<number, Types.ObjectId>;
    newIds: Types.ObjectId[];
  } {
    const questionIdMap = new Map<number, Types.ObjectId>();
    const newIds: Types.ObjectId[] = [];

    data.forEach((item, index) => {
      if (!item._id) {
        const newId = new Types.ObjectId();
        questionIdMap.set(index, newId);
        newIds.push(newId);
      }
    });

    return { questionIdMap, newIds };
  }

  /**
   * Validates that child question scores don't exceed parent scores
   */
  private validateChildQuestionScores(
    data: ContentType[],
    existingContent: ContentType[]
  ): string | null {
    for (const item of data) {
      if (!item.parentcontent || !item.score) continue;

      const parent = existingContent.find(
        (par) =>
          (par._id?.toString() || par.qIdx) ===
          (item.parentcontent?.qId || item.parentcontent?.qIdx)
      );

      if (parent?.score && item.score > parent.score) {
        return `Condition of ${parent.qIdx} has wrong score`;
      }
    }

    return null;
  }

  /**
   * Processes conditional references to resolve contentIdx to contentId
   */
  private processConditionals(
    conditional: ConditionalType[] | undefined,
    data: ContentType[],
    questionIdMap: Map<number, Types.ObjectId>
  ): ConditionalType[] | undefined {
    if (!conditional) return undefined;

    return conditional
      .map((cond) => {
        if (!cond.contentId && cond.contentIdx !== undefined) {
          const referencedId =
            data[cond.contentIdx]?._id || questionIdMap.get(cond.contentIdx);

          if (referencedId) {
            return { ...cond, contentId: referencedId };
          }
        }
        return cond;
      })
      .filter(
        (cond) => cond.contentId || cond.contentIdx !== undefined
      ) as ConditionalType[];
  }

  /**
   * Builds bulk write operations for upserting questions
   */
  private buildBulkOperations(
    data: ContentType[],
    questionIdMap: Map<number, Types.ObjectId>,
    formId: string,
    page: number
  ): any[] {
    return data.map((item, index) => {
      const { _id, ...rest } = item;
      const documentId = _id || questionIdMap.get(index);
      const processedConditional = this.processConditionals(
        rest.conditional,
        data,
        questionIdMap
      );

      return {
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
      };
    });
  }

  /**
   * Extracts IDs of questions to keep (not delete)
   */
  private extractIdsToKeep(data: ContentType[]): (Types.ObjectId | string)[] {
    return data
      .map((item) => item._id)
      .filter((id) => id && id.toString().length > 0) as (
      | Types.ObjectId
      | string
    )[];
  }

  /**
   * Handles deletion of questions that are no longer in the data
   */
  private async handleDeletions(
    formId: string,
    page: number,
    idsToKeep: (Types.ObjectId | string)[],
    existingContent: ContentType[]
  ): Promise<DeleteOperationResult> {
    const operations: Promise<any>[] = [];
    const deletedIds: Types.ObjectId[] = [];

    const toBeDeleted = await Content.find(
      { formId, page, _id: { $nin: idsToKeep } },
      { _id: 1, score: 1, conditional: 1, qIdx: 1, parentcontent: 1 },
      { lean: true }
    );

    if (toBeDeleted.length === 0) {
      return { operations, deletedIds };
    }

    // Collect all IDs to delete (including conditional children)
    const deleteIds = toBeDeleted.map(({ _id }) => _id);
    const conditionalIds = toBeDeleted
      .flatMap((item) => item.conditional?.map((con) => con.contentId) || [])
      .filter(Boolean);
    const allDeleteIds = [...deleteIds, ...conditionalIds];

    // Calculate deleted score
    const deletedScore = toBeDeleted
      .filter((i) => !i.parentcontent)
      .reduce((sum, { score = 0 }) => sum + score, 0);

    // Add delete operations
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

    // Update qIdx for remaining questions
    const deletedIdx = toBeDeleted
      .map((i) => i.qIdx || 0)
      .sort((a, b) => a - b);
    const qIdxUpdateOps = this.buildQIdxUpdateOperations(
      existingContent,
      idsToKeep,
      deletedIdx
    );
    operations.push(...qIdxUpdateOps);

    return { operations, deletedIds: allDeleteIds as Types.ObjectId[] };
  }

  /**
   * Builds operations to update qIdx after deletions
   */
  private buildQIdxUpdateOperations(
    existingContent: ContentType[],
    idsToKeep: (Types.ObjectId | string)[],
    deletedIdx: number[]
  ): Promise<any>[] {
    const operations: Promise<any>[] = [];

    const remainingQuestions = existingContent.filter(
      (item) => item._id && idsToKeep.includes(item._id)
    );

    for (const item of remainingQuestions) {
      const currentIdx = item.qIdx || 0;
      const deletedBeforeCurrent = deletedIdx.filter(
        (delIdx) => delIdx < currentIdx
      ).length;

      if (deletedBeforeCurrent > 0) {
        const newIdx = currentIdx - deletedBeforeCurrent;
        operations.push(
          Content.updateOne({ _id: item._id }, { $set: { qIdx: newIdx } })
        );
      }
    }

    return operations;
  }

  /**
   * Executes all database operations in parallel
   */
  private async executeOperations(
    bulkOps: any[],
    newIds: Types.ObjectId[],
    formId: string,
    deleteOperations: Promise<any>[]
  ): Promise<void> {
    const operations = [...deleteOperations];

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
  }

  /**
   * Updates total score if it has changed
   * Calculates the score difference for current page and applies it to form's totalscore
   */
  private async updateTotalScoreIfChanged(
    data: ContentType[],
    existingContent: ContentType[],
    formId: string
  ): Promise<void> {
    const scoreDiff = this.calculateScoreDifference(data, existingContent);

    if (scoreDiff !== 0) {
      await Form.updateOne(
        { _id: formId },
        { $inc: { totalscore: scoreDiff } }
      );
    }
  }

  /**
   * Fetches the updated content after save
   */
  private async fetchUpdatedContent(
    formId: string,
    page: number
  ): Promise<ContentType[]> {
    return Content.find({ formId, page }, null, {
      lean: true,
      sort: { qIdx: 1 },
    });
  }

  /**
   * Handles errors from SaveQuestion
   */
  private handleSaveQuestionError(error: unknown, res: Response) {
    console.error("SaveQuestion Error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json(ReturnCode(400, "Validation Error"));
    }
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json(ReturnCode(400, "Invalid ID Format"));
    }

    return res.status(500).json(ReturnCode(500, "Internal Server Error"));
  }

  /**
   * Logs message only in development environment
   */
  private logDev(message: string): void {
    if (process.env.NODE_ENV === "DEV") {
      console.log(message);
    }
  }

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

  /**
   * Calculate the total score for a set of questions
   * Excludes conditional/child questions (parentcontent) to avoid double counting
   */
  private calculateTotalScore(items: Array<ContentType>): number {
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
  }

  /**
   * Calculate the total score for all questions in a form
   * Fetches all content from the database and calculates total
   * Excludes conditional/child questions to avoid double counting
   */
  private async calculateFormTotalScore(formId: string): Promise<number> {
    const allContent = await Content.find(
      { formId, parentcontent: { $exists: false } },
      { score: 1 },
      { lean: true }
    );

    return allContent.reduce((total, { score = 0 }) => total + score, 0);
  }

  /**
   * Calculate the difference in score between incoming and existing content
   * @Returns the difference (positive if score increased, negative if decreased)
   */
  private calculateScoreDifference(
    incoming: ContentType[],
    prevContent: ContentType[]
  ): number {
    const incomingTotal = this.calculateTotalScore(incoming);
    const prevTotal = this.calculateTotalScore(prevContent);

    return incomingTotal - prevTotal;
  }

  /**
   * @deprecated Use calculateScoreDifference instead
   * Kept for backward compatibility
   */
  private isScoreHasChange(
    incoming: ContentType[],
    prevContent: ContentType[]
  ): number | null {
    const incomingTotal = this.calculateTotalScore(incoming);
    const prevTotal = this.calculateTotalScore(prevContent);

    return incomingTotal !== prevTotal ? incomingTotal : null;
  }
}

export default new QuestionController();
