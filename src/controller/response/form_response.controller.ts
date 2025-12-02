import Zod from "zod";

export { FormResponseQueryController } from "./form_response.query.controller";
export { FormResponseScoringController } from "./form_response.scoring.controller";
export { FormResponseSubmissionController } from "./form_response.submission.controller";
export { FormResponseUtilityController } from "./form_response.utility.controller";

import FormResponseQueryController from "./form_response.query.controller";
import FormResponseScoringController from "./form_response.scoring.controller";
import FormResponseSubmissionController from "./form_response.submission.controller";
import FormResponseUtilityController from "./form_response.utility.controller";

class FormResponseController {
  // Query methods
  public GetResponseByFormId = FormResponseQueryController.GetResponseByFormId;
  public GetResponseByUser = FormResponseQueryController.GetResponseByUser;
  public GetResponsesInfo = FormResponseQueryController.GetResponsesInfo;
  public GetResponsesWithFilters =
    FormResponseQueryController.GetResponsesWithFilters;
  public GetResponseByID = FormResponseQueryController.GetResponseByID;
  public GetUserResponses = FormResponseQueryController.GetUserResponses;
  public DeleteResponse = FormResponseQueryController.DeleteResponse;
  public BulkDeleteResponses = FormResponseQueryController.BulkDeleteResponses;
  public GetResponseAnalytics =
    FormResponseQueryController.GetResponseAnalytics;
  public GetChoiceQuestionAnalytics =
    FormResponseQueryController.GetChoiceQuestionAnalytics;
  public GetFormAnalytics = FormResponseQueryController.GetFormAnalytics;
  public ExportAnalytics = FormResponseQueryController.ExportAnalytics;

  // Scoring methods
  public UpdateResponseScore =
    FormResponseScoringController.UpdateResponseScore;
  public UpdateQuestionScore =
    FormResponseScoringController.UpdateQuestionScore;
  public BatchUpdateScores = FormResponseScoringController.BatchUpdateScores;
  public RecalculateResponseScore =
    FormResponseScoringController.RecalculateResponseScore;

  // Submission methods
  public GetFormForRespondent =
    FormResponseSubmissionController.GetFormForRespondent;
  public SubmitFormResponse =
    FormResponseSubmissionController.SubmitFormResponse;
  public GetInititalFormData =
    FormResponseSubmissionController.GetInititalFormData;
  public GetPublicFormData = FormResponseSubmissionController.GetPublicFormData;

  // Utility methods
  public ValidateFormForSubmission =
    FormResponseUtilityController.ValidateFormForSubmission;
  public SendFormLinks = FormResponseUtilityController.SendFormLinks;
  public GenerateFormLink = FormResponseUtilityController.GenerateFormLink;
  public SendResponseCardEmail =
    FormResponseUtilityController.SendResponseCardEmail;
  public ExportResponsePDF = FormResponseUtilityController.ExportResponsePDF;

  // Static validators
  static publicSubmitValidate = Zod.object({
    body: Zod.object({
      formId: Zod.string().min(1, "Form is required"),
      respondentEmail: Zod.string().email().optional(),
      respondentName: Zod.string().optional(),
    }),
  });

  static sendResponseCardEmailValidate = Zod.object({
    body: Zod.object({
      responseId: Zod.string().min(1, "Response ID is required"),
      recipientEmail: Zod.string().email("Valid email is required"),
    }),
  });
}

export default new FormResponseController();
export { FormResponseController };
