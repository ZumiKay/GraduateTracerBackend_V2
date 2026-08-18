import { Router, RequestHandler } from "express";
import ConditionQuestionValidator from "../middleware/ConditionValidator";
import TrafficControl from "../middleware/Traffic.middleware";
import {
  CreateForm,
  DeleteForm,
  EditForm,
  GetFilterForm,
  PageHandler,
  RemoveSelfFromForm,
  GetFormCollaborators,
  ChangePrimaryOwner,
  ManageFormCollaborator,
  GetFormDetails,
  ResendPendingInvitation,
  DeletePendingCollaborator,
} from "../controller/form/form.controller";
import { createFormValidate } from "../model/Form.model";
import { validate } from "../middleware/Validatetor";
import authenicationController from "../controller/auth/authenication.controller";
import UserMiddleware from "../middleware/User.middleware";
import {
  DeleteUser,
  EditUser,
  GetUserProfile,
  RegisterUser,
  UserValidate,
} from "../controller/auth/user.controller";
import form_responseController from "../controller/response/form_response.controller";
import questionController from "../controller/form/question.controller";
import VerifyRecaptcha from "../controller/utils/recaptcha.controller";
import {
  ConfirmAddCollaborator,
  ConfirmOwnershipTransfer,
  CancelOwnershipTransfer,
} from "../controller/form/form.collaborator.controller";
import { FormValidationService } from "../services/FormValidationService";

const UserRoute = Router();

//Get User Profile
UserRoute.get(
  "/user/profile",
  UserMiddleware.VerifyToken,
  GetUserProfile as unknown as RequestHandler,
);

//RegisterUser
UserRoute.post(
  "/registeruser",
  TrafficControl.ApiRateLimit as unknown as RequestHandler,
  validate(UserValidate) as unknown as RequestHandler,
  RegisterUser as unknown as RequestHandler,
);
//User Management
UserRoute.put(
  "/edituser",
  UserMiddleware.VerifyToken,
  EditUser as unknown as RequestHandler,
);
UserRoute.delete(
  "/deleteuser",
  UserMiddleware.VerifyToken,
  DeleteUser as unknown as RequestHandler,
);

//Authentication
UserRoute.post(
  "/login",
  TrafficControl.LoginRateLimit as unknown as RequestHandler,
  validate(UserValidate) as unknown as RequestHandler,
  authenicationController.Login as unknown as RequestHandler,
);
UserRoute.get(
  "/checksession",
  authenicationController.CheckSession as unknown as RequestHandler,
);
UserRoute.delete(
  "/logout",
  authenicationController.Logout as unknown as RequestHandler,
);
UserRoute.post(
  "/refreshtoken",
  UserMiddleware.VerifyRefreshToken as unknown as RequestHandler,
  authenicationController.RefreshToken as unknown as RequestHandler,
);
UserRoute.put(
  "/forgotpassword",
  TrafficControl.PasswordResetRateLimit as unknown as RequestHandler,
  authenicationController.ForgotPassword as unknown as RequestHandler,
);

//Recaptcha
UserRoute.post(
  "/recaptchaverify",
  VerifyRecaptcha as unknown as RequestHandler,
);

//Form Modification Routes
UserRoute.post(
  "/createform",
  [
    UserMiddleware.VerifyToken as unknown as RequestHandler,
    validate(createFormValidate) as unknown as RequestHandler,
  ],
  CreateForm as unknown as RequestHandler,
);

UserRoute.put(
  "/editform",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  EditForm as unknown as RequestHandler,
);

UserRoute.delete(
  "/deleteform",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  DeleteForm as unknown as RequestHandler,
);

//Fetch form for users
UserRoute.get(
  "/filteredform",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  GetFilterForm as unknown as RequestHandler,
);

//Form page mutations
UserRoute.put(
  "/modifypage",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  PageHandler as unknown as RequestHandler,
);

// Get Form Details with Access Verification (for ViewResponsePage)
UserRoute.get(
  "/form/details/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  GetFormDetails as unknown as RequestHandler,
);

//Form Owner Management Routes
UserRoute.post(
  "/addformowner",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ManageFormCollaborator as unknown as RequestHandler,
);
UserRoute.delete(
  "/removeformowner",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ManageFormCollaborator as unknown as RequestHandler,
);
UserRoute.post(
  "/collaborator/confirm",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ConfirmAddCollaborator as unknown as RequestHandler,
);
UserRoute.get(
  "/getformowners/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  GetFormCollaborators as unknown as RequestHandler,
);
UserRoute.delete(
  "/removeselfform/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  RemoveSelfFromForm as unknown as RequestHandler,
);

UserRoute.put(
  "/transferuser",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ChangePrimaryOwner as unknown as RequestHandler,
);

// Ownership transfer confirmation and cancellation
UserRoute.post(
  "/ownership/confirm",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ConfirmOwnershipTransfer as unknown as RequestHandler,
);
UserRoute.delete(
  "/ownership/cancel",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  CancelOwnershipTransfer as unknown as RequestHandler,
);

// Pending collaborator management
UserRoute.post(
  "/resendpending",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ResendPendingInvitation as unknown as RequestHandler,
);
UserRoute.delete(
  "/deletepending",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  DeletePendingCollaborator as unknown as RequestHandler,
);

//Form Content Routes

UserRoute.put(
  "/savecontent",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  questionController.SaveQuestion as unknown as RequestHandler,
);

UserRoute.delete(
  "/deletecontent",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  questionController.DeleteQuestion as unknown as RequestHandler,
);

//Question mutations
UserRoute.post(
  "/savequestion",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  ConditionQuestionValidator.validateConditionMiddleware as unknown as RequestHandler,
  questionController.SaveQuestion as unknown as RequestHandler,
);

//Validate form contents
UserRoute.get(
  "/validateform",
  UserMiddleware.VerifyToken,
  FormValidationService.validationFormHandler as unknown as RequestHandler,
);

// Response Management Routes
UserRoute.post(
  "/response/send-links",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.SendFormLinks as unknown as RequestHandler,
);
UserRoute.post(
  "/response/generate-link",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.GenerateFormLink as unknown as RequestHandler,
);
UserRoute.put(
  "/response/update-score",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.UpdateResponseScore as unknown as RequestHandler,
);

// Analytics Routes
UserRoute.get(
  "/response/analytics/:formId",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.GetFormAnalytics as unknown as RequestHandler,
);
UserRoute.get(
  "/response/analytics/:formId/export",
  UserMiddleware.VerifyToken as unknown as RequestHandler,
  form_responseController.ExportAnalytics as unknown as RequestHandler,
);

export default UserRoute;
