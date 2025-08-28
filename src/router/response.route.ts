import { RequestHandler, Router } from "express";
import FormResponseController from "../controller/form_response.controller";
import UserMiddleware from "../middleware/User.middleware";

const ResponseRouter = Router();

// Existing routes
ResponseRouter.post(
  "/submit",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.SubmitResponse as unknown as RequestHandler
);

ResponseRouter.get(
  "/getbyformid",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponseByFormId as unknown as RequestHandler
);

ResponseRouter.get(
  "/getbyuserid",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponseByUserId as unknown as RequestHandler
);

// Get all responses by current user
ResponseRouter.get(
  "/user-responses",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetUserResponses as unknown as RequestHandler
);

ResponseRouter.get(
  "/guest",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetGuestResponse as unknown as RequestHandler
);

ResponseRouter.get(
  "/validate",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.ValidateFormForSubmission as unknown as RequestHandler
);

// New routes for enhanced response functionality

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

// Get form for respondent (public access) - Note: Duplicate of user route, keeping for backward compatibility
ResponseRouter.get(
  "/form/:formId",
  FormResponseController.GetFormForRespondent as unknown as RequestHandler
);

//Public Access Form
ResponseRouter.post(
  "/public-response",
  FormResponseController.SubmitPublicResponse as unknown as RequestHandler
);

// Submit form response for registered user
ResponseRouter.post(
  "/submit-response",
  FormResponseController.SubmitFormResponse as unknown as RequestHandler
);

// Get responses with filters and pagination
ResponseRouter.get(
  "/responses",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponsesWithFilters as unknown as RequestHandler
);

// Manual scoring for responses
ResponseRouter.put(
  "/score",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.UpdateResponseScore as unknown as RequestHandler
);

// Get response analytics for charts
ResponseRouter.get(
  "/analytics",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  FormResponseController.GetResponseAnalytics as unknown as RequestHandler
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

export default ResponseRouter;
