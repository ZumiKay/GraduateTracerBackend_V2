import { Types } from "mongoose";
import FormResponse, {
  ResponseSetType,
  FormResponseType,
  ScoringMethod,
  RespondentType,
  SubmitionProcessionReturnType,
  ResponseCompletionStatus,
  ResponseAnswerType,
  UpdateResponseScoretype,
} from "../model/Response.model";
import Content, { ContentType, QuestionType } from "../model/Content.model";
import Form, { FormType, returnscore } from "../model/Form.model";
import SolutionValidationService from "./SolutionValidationService";
import EmailService from "./EmailService";
import User from "../model/User.model";
import { FingerprintService } from "../utilities/fingerprint";
import { Request } from "express";
import { RespondentTrackingService } from "./RespondentTrackingService";

interface ValidateResultReturnType {
  errormess?: string;
  content?: string;
}

interface submissionDataType {
  formId: string;
  responseSet: ResponseSetType[];
  respondentEmail?: string;
  respondentName?: string;
  userId?: string;
  req?: Request;
  returnResponse?: boolean;
}

interface AddScoreReturnType {
  response: Array<ResponseSetType>;
  isNonScore?: boolean;
}

export class ResponseProcessingService {
  static async processNormalFormSubmission({
    formId,
    responseSet,
    respondentEmail,
    respondentName,
    req,
  }: submissionDataType) {
    const form = await Form.findById(formId).select("_id setting");

    if (!form) throw new Error("Form not found");

    let browserfingerprinting: string | undefined = undefined;
    let respodnentIp: string | undefined = undefined;

    //Save anonoymus fingerprinting for form that doesn't require email
    if (!form.setting?.email && req) {
      const anoynomusTrackingData =
        FingerprintService.generateTrackingData(req);
      browserfingerprinting = anoynomusTrackingData.fingerprint;
      respodnentIp = anoynomusTrackingData.ip;
    }

    if (form.setting?.email && !respondentEmail) {
      throw new Error("Email is required for this form");
    }

    let isUser: Types.ObjectId | undefined = undefined;

    if (respondentEmail) {
      isUser = (await User.findOne({ email: respondentEmail }))?._id;
    }

    //Verify if user already responded for single response form
    if (form.setting?.submitonce && req) {
      const trackingResult =
        await RespondentTrackingService.checkRespondentExists(formId, req);

      if (trackingResult.hasResponded) {
        throw new Error("Form already submitted");
      }
    }

    //Check response format

    const contents = await Content.find({ formId: formId }).lean();

    contents.forEach((question) => {
      const response = responseSet.find(
        (i) => i.question === question._id.toString()
      );

      //Verify required question
      if (question.require) {
        if (
          !response ||
          SolutionValidationService.isAnswerisempty(
            response.response as ResponseAnswerType
          )
        )
          throw new Error("Require");
      }

      if (!response) {
        throw new Error("Question not found");
      }
      const toverify = SolutionValidationService.validateAnswerFormat(
        question.type,
        response.response as ResponseAnswerType,
        question
      );

      if (!toverify.isValid) throw new Error("Format");
    });

    //Save response

    await FormResponse.create({
      formId: new Types.ObjectId(formId),
      responseset: responseSet,
      submittedAt: new Date(),
      completionStatus: ResponseCompletionStatus.completed,
      respondentFingerprint: browserfingerprinting,
      respondentIP: respodnentIp,
      ...(form.setting?.email && {
        respondentEmail,
        respondentName,
        respondentType: isUser ? RespondentType.user : RespondentType.guest,
      }),
      userId: isUser,
    });

    return {
      message: "Form Submitted",
    };
  }

  static async processFormSubmission(
    submissionData: submissionDataType,
    form: FormType
  ): Promise<SubmitionProcessionReturnType> {
    const { formId, responseSet, respondentEmail, respondentName } =
      submissionData;

    if (form.setting?.email && !respondentEmail) {
      throw new Error("Email is required for this form");
    }

    //Verify if user alr respond for single response form
    if (form.setting?.submitonce) {
      const hasResponse = await FormResponse.findOne({
        respondentEmail,
        formId,
      });

      if (hasResponse) {
        throw new Error("Form already exisited");
      }
    }

    const user = await User.findOne({
      email: submissionData.respondentEmail,
    })
      .lean()
      .select("_id email");

    //*Score calculate process

    let scoredResponses: ResponseSetType[] = [];
    let totalScore = 0;
    let isAutoScored = false;
    let isNonScore = false;

    // Auto-score
    if (form.setting?.returnscore === returnscore.partial) {
      const addscore = await this.addScore(responseSet);
      isAutoScored = true;
      // Check if all questions have no score
      isNonScore = addscore.isNonScore || false;
      scoredResponses = addscore.response;
    } else {
      const contents = await Content.find({ formId: formId }).lean();

      contents.forEach((question) => {
        const response = responseSet.find(
          (i) => i.question === question._id.toString()
        );

        //Verify required question
        if (question.require) {
          if (
            !response ||
            SolutionValidationService.isAnswerisempty(
              response.response as ResponseAnswerType
            )
          )
            throw new Error("Require");
        }

        if (!response) {
          throw new Error("Question not found");
        }
        const toverify = SolutionValidationService.validateAnswerFormat(
          question.type,
          response.response as ResponseAnswerType,
          question
        );

        if (!toverify.isValid) throw new Error("Format");
      });
    }

    // Calculate total score
    totalScore =
      SolutionValidationService.calcualteResponseTotalScore(scoredResponses);

    // Determine completion status based on auto-scoring and scoring method
    let completionStatus = ResponseCompletionStatus.submitted;
    if (isNonScore) {
      completionStatus = ResponseCompletionStatus.noscore;
    } else if (isAutoScored) {
      // Check if there are any manual scoring responses
      const hasManualScoring = scoredResponses.some(
        (i) => i.scoringMethod === ScoringMethod.MANUAL
      );
      completionStatus = hasManualScoring
        ? ResponseCompletionStatus.partial
        : ResponseCompletionStatus.autoscore;
    }

    // Create response data
    const responseData: Partial<FormResponseType> = {
      formId: new Types.ObjectId(formId),
      responseset: scoredResponses,
      maxScore: form.totalscore,
      totalScore,
      submittedAt: new Date(),
      completionStatus: completionStatus,
      respondentType: user ? RespondentType.user : RespondentType.guest,
      respondentEmail: user ? user.email : respondentEmail,
      respondentName: respondentName,
      userId: user?._id,
    };

    if (user?._id) {
      responseData.userId = new Types.ObjectId(user._id);
    }

    const savedResponse = await FormResponse.create(responseData);

    // Send results email if auto-scored
    if (isAutoScored && respondentEmail && !isNonScore) {
      const emailService = new EmailService();
      const email = user ? user.email : respondentEmail;
      if (email) {
        await emailService.sendResponseResults({
          to: email,
          formTitle: form.title,
          totalScore,
          maxScore: form.totalscore || 0,
          responseId: savedResponse._id.toString(),
          isAutoScored: true,
        });
      }
    }

    const isHavePartialScore =
      scoredResponses.some((i) => i.scoringMethod === ScoringMethod.MANUAL) ||
      isNonScore;

    return {
      isNonScore,
      totalScore,
      respondentEmail,
      maxScore: form.totalscore || 0,
      message: !isAutoScored
        ? "Score will be return by form owner"
        : isHavePartialScore
        ? "Totalscore is partial only might change when form owner return your score."
        : "This your final score",
    };
  }

  /**
   *Add Score Method //
   *Verify answer format //
   *If all question have no score return isNonScore //
   *Only avaliable if form returntype is PARTIAL
   */
  static async addScore(
    response: Array<ResponseSetType>
  ): Promise<AddScoreReturnType> {
    if (response.length === 0) {
      return { response };
    }
    try {
      //Fetch all content responsible in the qids
      const content = await Content.find({
        _id: {
          $in: response.map((i) => new Types.ObjectId(i.question as string)),
        },
      })
        .lean()
        .exec();

      if (content.length === 0) {
        return { response };
      }

      let result: Array<ResponseSetType> = [];
      let hasAnyScore = false;

      //Scoring process
      for (let i = 0; i < content.length; i++) {
        const question = content[i];
        const userresponse = response.find((resp) =>
          question._id.equals(new Types.ObjectId(resp.question.toString()))
        );

        if (!userresponse) {
          throw new Error("Question not found");
        }

        //verify requried question
        if (question.require) {
          if (
            !userresponse ||
            SolutionValidationService.isAnswerisempty(
              userresponse.response as ResponseAnswerType
            )
          ) {
            throw new Error("Require");
          }
        }

        //Verify answer format and validity
        const isVerify = SolutionValidationService.validateAnswerFormat(
          question.type,
          userresponse.response as ResponseAnswerType,
          question
        );

        if (!isVerify.isValid) {
          throw new Error(isVerify.errors.join("||"));
        }

        const maxScore = question.score || 0;

        // Track if any question has a score
        if (maxScore > 0) {
          hasAnyScore = true;
        }

        //Automically Score All Scoreable Questions
        if (question.answer && question.answer?.answer) {
          const partialScored =
            SolutionValidationService.calculateResponseScore(
              userresponse.response as ResponseAnswerType,
              question.answer.answer,
              question.type,
              maxScore
            );

          result.push({
            ...userresponse,
            score: partialScored,
            scoringMethod: ScoringMethod.AUTO,
          });
        }
        //If unscoreable mark to score manually
        else
          result.push({
            ...userresponse,
            scoringMethod: ScoringMethod.MANUAL,
          });
      }

      // isNonScore is true when NO questions have scores (all maxScore = 0)
      const isNonScore = !hasAnyScore;
      return { response: result, isNonScore };
    } catch (error) {
      console.error("AddScore Error:", error);
      return { response };
    }
  }

  static async updateResponseScores({
    responseId,
    scores,
  }: UpdateResponseScoretype) {
    // Validate input
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      throw new Error("Invalid scores data");
    }

    // Find response - not using lean() to maintain _id on subdocuments
    const response = await FormResponse.findById(responseId).select(
      "responseset totalScore maxScore formId"
    );

    if (!response) {
      throw new Error("Response not found");
    }

    // Create a map for efficient lookup
    const [questionScoreMap, questionCommentMap] = [
      new Map(scores.map((s) => [s.questionId.toString(), s.score])),
      new Map(scores.map((c) => [c.questionId.toString(), c.comment])),
    ];

    let updatedTotalScore = 0;
    let updatedCount = 0;

    // Update scores and comment in the responseset array
    response.responseset.forEach((responseItem) => {
      const questionId =
        typeof responseItem.question === "string"
          ? responseItem.question
          : (responseItem.question as Types.ObjectId).toString();

      const newScore = questionScoreMap.get(questionId);
      const newComment = questionCommentMap.get(questionId);

      if (newScore !== undefined || newComment) {
        if (newScore !== undefined) {
          responseItem.score = newScore;
          responseItem.scoringMethod = ScoringMethod.MANUAL;
        }
        if (newComment) responseItem.comment = newComment;
        updatedCount++;
      }

      // Calculate new total score
      updatedTotalScore += responseItem.score || 0;
    });

    if (updatedCount === 0) {
      return {
        success: true,
        message: "No matching questions found to update",
      };
    }

    // Update totalScore and completionStatus
    response.totalScore = updatedTotalScore;
    response.completionStatus = ResponseCompletionStatus.completed;

    // Save all changes in a single operation with optimized write concern
    await response.save({ validateBeforeSave: false });

    return {
      success: true,
      updatedScores: updatedCount,
      totalScore: updatedTotalScore,
    };
  }

  /**
   * Batch update scores for multiple responses
   * More efficient when updating multiple responses at once
   */
  static async batchUpdateResponseScores(
    updates: Array<{
      responseId: string;
      scores: Array<{ questionId: string; score: number }>;
    }>
  ) {
    const results = await Promise.allSettled(
      updates.map((update) =>
        this.updateResponseScores({
          responseId: update.responseId,
          scores: update.scores,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      success: failed === 0,
      total: updates.length,
      successful,
      failed,
      results: results.map((r, idx) => ({
        responseId: updates[idx].responseId,
        status: r.status,
        data: r.status === "fulfilled" ? r.value : undefined,
        error: r.status === "rejected" ? r.reason?.message : undefined,
      })),
    };
  }

  /**
   * Recalculate total score for a response
   * Useful for fixing inconsistencies or after data migration
   */
  static async recalculateResponseTotalScore(responseId: string) {
    const response = await FormResponse.findById(responseId).select(
      "responseset totalScore"
    );

    if (!response) {
      throw new Error("Response not found");
    }

    const calculatedTotal = response.responseset.reduce(
      (sum, item) => sum + (item.score || 0),
      0
    );

    if (calculatedTotal !== response.totalScore) {
      response.totalScore = calculatedTotal;
      await response.save({ validateBeforeSave: false });

      return {
        success: true,
        previousTotal: response.totalScore,
        newTotal: calculatedTotal,
        corrected: true,
      };
    }

    return {
      success: true,
      totalScore: calculatedTotal,
      corrected: false,
    };
  }

  private static deepEqual(a: any, b: any): boolean {
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

  private static validateResponset({
    responseSet,
    questionSet,
  }: {
    responseSet: Array<ResponseSetType>;
    questionSet: Array<ContentType>;
  }): ValidateResultReturnType | boolean {
    if (responseSet.length === 0 || questionSet.length === 0) {
      return { errormess: "No responses or questions found" };
    }

    for (let i = 0; i < responseSet.length; i++) {
      const response = responseSet[i];
      const question = questionSet.find(
        (i) => i._id?.toString() === response.question.toString()
      );

      //If one of the response question is not found in the question set, return error reponse should alway have response question
      if (!question) {
        return { errormess: "Response format is inccorect" };
      }

      //Required Question

      const isRequired = question.require || false;
      if (isRequired) {
        const isEmptyResponse =
          response.response === null ||
          response.response === undefined ||
          (typeof response.response === "string" &&
            response.response.trim() === "") ||
          (Array.isArray(response.response) && response.response.length === 0);
        if (isEmptyResponse) {
          return {
            errormess: "Missing required question",
          };
        }

        //Verify if the response type matches the question type
        const validationResult = this.validateResponseType(response, question);
        if (validationResult !== true) {
          return validationResult;
        }
      }
    }

    return true;
  }

  private static validateResponseType(
    response: ResponseSetType,
    question: ContentType
  ): ValidateResultReturnType | boolean {
    const { type } = question;
    const responseValue = response.response;

    switch (type) {
      case QuestionType.Text:
      case QuestionType.ShortAnswer:
      case QuestionType.Paragraph:
      case QuestionType.Date:
        if (typeof responseValue !== "string") {
          return {
            errormess: `Invalid response type for ${type} question. Expected string.`,
          };
        }
        break;

      case QuestionType.Number:
        if (typeof responseValue !== "number") {
          return {
            errormess: `Invalid response type for ${type} question. Expected number.`,
          };
        }
        break;

      case QuestionType.MultipleChoice:
      case QuestionType.Selection:
        if (
          typeof responseValue !== "string" &&
          typeof responseValue !== "number"
        ) {
          return {
            errormess: `Invalid response type for ${type} question. Expected string or number.`,
          };
        }
        break;

      case QuestionType.CheckBox:
        if (!Array.isArray(responseValue)) {
          return {
            errormess:
              "Invalid response type for checkbox question. Expected array.",
          };
        }
        break;

      case QuestionType.RangeDate:
        if (
          !Array.isArray(responseValue) ||
          responseValue.length !== 2 ||
          !responseValue.every(
            (val) => typeof val === "string" || (val && typeof val === "object")
          )
        ) {
          return {
            errormess:
              "Invalid response type for date range question. Expected array of 2 dates.",
          };
        }
        break;

      case QuestionType.RangeNumber:
        if (
          !Array.isArray(responseValue) ||
          responseValue.length !== 2 ||
          !responseValue.every((val) => typeof val === "number")
        ) {
          return {
            errormess:
              "Invalid response type for number range question. Expected array of 2 numbers.",
          };
        }
        break;

      default:
        // For any other question types, allow any response
        break;
    }

    return true;
  }

  /**
   * Validates form submission data before processing
   */
  static async validateFormSubmission(submissionData: {
    formId: string;
    responseset: ResponseSetType[];
    userId?: string;
    respondentEmail?: string;
    respondentName?: string;
  }): Promise<ValidateResultReturnType | boolean> {
    const { formId, responseset } = submissionData;

    // Check if form exists
    const form = await Form.findById(formId);
    if (!form) {
      return { errormess: "Form not found" };
    }

    // Check if form accepts responses
    if (!form.setting?.acceptResponses) {
      return { errormess: "Form is no longer accepting responses" };
    }

    // Get form questions
    const questions = await Content.find({ formId }).lean();
    if (!questions || questions.length === 0) {
      return { errormess: "No questions found for this form" };
    }

    // Validate response set
    const validationResult = this.validateResponset({
      responseSet: responseset,
      questionSet: questions,
    });

    return validationResult;
  }

  /**
   * Checks if a response already exists for a user/form combination
   */
  static async checkExistingResponse(
    formId: string,
    userId?: string,
    guestEmail?: string
  ): Promise<any> {
    const query: any = { formId };

    if (userId) {
      query.userId = new Types.ObjectId(userId);
    } else if (guestEmail) {
      query["guest.email"] = guestEmail;
    } else {
      return null;
    }

    return await FormResponse.findOne(query).lean();
  }

  /**
   * Calculates the maximum possible score for a form
   */
  static async getFormMaxScore(formId: string): Promise<number> {
    const questions = await Content.find({ formId }).select("score").lean();
    return questions.reduce(
      (total, question) => total + (question.score || 0),
      0
    );
  }

  /**
   * Gets response statistics for a specific form
   */
  static async getResponseStatistics(formId: string) {
    const totalResponses = await FormResponse.countDocuments({ formId });
    const completedResponses = await FormResponse.countDocuments({
      formId,
      completionStatus: ResponseCompletionStatus.completed,
    });

    const responses = await FormResponse.find({ formId })
      .select("totalScore")
      .lean();
    const scores = responses.map((r) => r.totalScore || 0);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    return {
      totalResponses,
      completedResponses,
      completionRate:
        totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0,
      averageScore,
      maxScore,
      minScore,
    };
  }
}
