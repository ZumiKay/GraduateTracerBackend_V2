import { RequestHandler, Router } from "express";
import FormResponseController from "../controller/response/form_response.controller";
import UserMiddleware from "../middleware/User.middleware";
import form_responseController from "../controller/response/form_response.controller";
import { GetFilledForm } from "../controller/form/form.controller";
import FormsessionMiddleware from "../middleware/Formsession.middleware";
import { ResponseQueryService } from "../services/ResponseQueryService";
import FormsessionService from "../controller/form/formsession.controller";
import form_response_returnController from "../controller/response/form_response_return.controller";
import analyticsController from "../controller/analytics/analytics.controller";

const ResponseRouter = Router();

//Form session management
ResponseRouter.post(
  "/respondentlogin",
  FormsessionService.RespondentLogin as unknown as RequestHandler
);

ResponseRouter.get(
  "/verifyformsession/:formId",
  FormsessionService.SessionVerification as unknown as RequestHandler
);

ResponseRouter.patch(
  "/sessionremoval/:code",
  FormsessionService.ReplaceSession as unknown as RequestHandler
);

ResponseRouter.delete(
  "/sessionlogout/:formId",
  FormsessionMiddleware.VerifyFormsession as unknown as RequestHandler,
  FormsessionService.SignOut as unknown as RequestHandler
);

//Fetch selected user response
ResponseRouter.get(
  "/getuserresponses/:formId/:page/:resIdx/:userId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ResponseQueryService.getUserResponses as unknown as RequestHandler
);

// Get list of respondent by formId

ResponseRouter.get(
  "/getrespondents/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponsesInfo as unknown as RequestHandler
);

// Get responses with filters and pagination
ResponseRouter.get(
  "/getresponselist",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponsesWithFilters as unknown as RequestHandler
);

//Get response by id
ResponseRouter.get(
  "/getresponseById/:id/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponseByID as unknown as RequestHandler
);

//Validate Form data before submission

ResponseRouter.get(
  "/validate",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.ValidateFormForSubmission as unknown as RequestHandler
);

// Send form links via email
ResponseRouter.post(
  "/send-links",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.SendFormLinks as unknown as RequestHandler
);

// Generate form link
ResponseRouter.post(
  "/generate-link",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GenerateFormLink as unknown as RequestHandler
);

//Get Respondent Form
ResponseRouter.get(
  "/form/:formId",
  FormsessionMiddleware.VerifyRespondentFormSessionData as unknown as RequestHandler,
  FormResponseController.GetFormForRespondent as unknown as RequestHandler
);

// Submit form response for registered user
ResponseRouter.post(
  "/submit-response/:formId",
  FormsessionMiddleware.VerifyFormsession as unknown as RequestHandler,
  FormResponseController.SubmitFormResponse as unknown as RequestHandler
);

// Manual scoring for responses
ResponseRouter.put(
  "/update-score",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.UpdateResponseScore as unknown as RequestHandler
);

// Update individual question score
ResponseRouter.put(
  "/update-question-score",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.UpdateQuestionScore as unknown as RequestHandler
);

// Batch update scores for multiple responses
ResponseRouter.put(
  "/batch-update-scores",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.BatchUpdateScores as unknown as RequestHandler
);

// Recalculate total score for a response
ResponseRouter.put(
  "/recalculate-score",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.RecalculateResponseScore as unknown as RequestHandler
);

// Delete a response
ResponseRouter.delete(
  "/:responseId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.DeleteResponse as unknown as RequestHandler
);

// Bulk delete responses
ResponseRouter.delete(
  "/bulk/delete",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.BulkDeleteResponses as unknown as RequestHandler
);

// Send response as card email
ResponseRouter.post(
  "/send-card-email",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.SendResponseCardEmail as unknown as RequestHandler
);

//Return Response to user through email
ResponseRouter.post(
  "/return",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_response_returnController.ReturnResponse as unknown as RequestHandler
);

ResponseRouter.get(
  "/:formId/:responseId/export/pdf",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.ExportResponsePDF as unknown as RequestHandler
);

// Get filled form data with user responses (protected route)
ResponseRouter.get(
  "/filled-form/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  GetFilledForm as unknown as RequestHandler
);

ResponseRouter.get(
  "/filled-form/:formId/:responseId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  GetFilledForm as unknown as RequestHandler
);

//Analytics routes
ResponseRouter.get(
  "/getanalytics",
  UserMiddleware.VerifyToken,
  analyticsController.GetAnalyticsData as unknown as RequestHandler
);

export default ResponseRouter;
