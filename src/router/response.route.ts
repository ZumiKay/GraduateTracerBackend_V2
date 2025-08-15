import { Router } from "express";
import FormResponseController from "../controller/form_response.controller";
import UserMiddleware from "../middleware/User.middleware";

const ResponseRouter = Router();

// Existing routes
ResponseRouter.post(
  "/submit",
  UserMiddleware.VerifyToken as any,
  FormResponseController.SubmitResponse as any
);

ResponseRouter.get(
  "/getbyformid",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetResponseByFormId as any
);

ResponseRouter.get(
  "/getbyuserid",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetResponseByUserId as any
);

// Get all responses by current user
ResponseRouter.get(
  "/user-responses",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetUserResponses as any
);

ResponseRouter.get(
  "/guest",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetGuestResponse as any
);

ResponseRouter.get(
  "/validate",
  UserMiddleware.VerifyToken as any,
  FormResponseController.ValidateFormForSubmission as any
);

// New routes for enhanced response functionality

// Send form links via email
ResponseRouter.post(
  "/send-links",
  UserMiddleware.VerifyToken as any,
  FormResponseController.SendFormLinks as any
);

// Generate form link
ResponseRouter.post(
  "/generate-link",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GenerateFormLink as any
);

// Get form for respondent (public access) - Note: Duplicate of user route, keeping for backward compatibility
ResponseRouter.get(
  "/form/:formId",
  FormResponseController.GetFormForRespondent as any
);

// Submit form response (for respondents)
ResponseRouter.post(
  "/submit-response",
  FormResponseController.SubmitFormResponse as any
);

// Get responses with filters and pagination
ResponseRouter.get(
  "/responses",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetResponsesWithFilters as any
);

// Manual scoring for responses
ResponseRouter.put(
  "/score",
  UserMiddleware.VerifyToken as any,
  FormResponseController.UpdateResponseScore as any
);

// Get response analytics for charts
ResponseRouter.get(
  "/analytics",
  UserMiddleware.VerifyToken as any,
  FormResponseController.GetResponseAnalytics as any
);

export default ResponseRouter;
