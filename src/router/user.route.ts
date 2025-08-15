import { Router } from "express";
import ConditionQuestionValidator from "../middleware/ConditionValidator";
import TrafficControl from "../middleware/Traffic.middleware";
import {
  CreateForm,
  DeleteForm,
  EditForm,
  GetAllForm,
  GetFilterForm,
  PageHandler,
  ValidateFormBeforeAction,
  AddFormOwner,
  RemoveFormOwner,
  GetFormOwners,
  RemoveSelfFromForm,
} from "../controller/form.controller";
import {
  AddFormContent,
  ContentValidate,
  EditFormContent,
  ValidateFormContent,
} from "../controller/content.controller";
import { createFormValidate } from "../model/Form.model";
import { validate } from "../middleware/Validatetor";
import authenicationController from "../controller/authenication.controller";
import UserMiddleware from "../middleware/User.middleware";
import {
  DeleteUser,
  EditUser,
  GetRespondentProfile,
  RegisterUser,
  UserValidate,
} from "../controller/user.controller";
import form_responseController, {
  FormResponseController,
} from "../controller/form_response.controller";
import VerifyRecaptcha from "../controller/recaptcha.controller";
import questionController from "../controller/question.controller";

const UserRoute = Router();

//Get User Profile
UserRoute.get("/user/profile", GetRespondentProfile as any);

//RegisterUser
UserRoute.post(
  "/registeruser",
  TrafficControl.ApiRateLimit as any,
  validate(UserValidate) as any,
  RegisterUser as any
);
//User Management - Enhanced Security for Profile Operations
UserRoute.put(
  "/edituser",
  UserMiddleware.VerifyTokenAndSession as any,
  EditUser as any
);
UserRoute.delete(
  "/deleteuser",
  UserMiddleware.VerifyTokenAndSession as any,
  DeleteUser as any
);

//Authentication
UserRoute.post(
  "/login",
  TrafficControl.LoginRateLimit as any,
  validate(UserValidate) as any,
  authenicationController.Login as any
);
UserRoute.get(
  "/checksession",
  UserMiddleware.VerifyToken as any,
  UserMiddleware.VerifyRefreshToken as any,
  authenicationController.CheckSession as any
);
UserRoute.delete("/logout", authenicationController.Logout as any);
UserRoute.post(
  "/refreshtoken",
  UserMiddleware.VerifyRefreshToken as any,
  authenicationController.RefreshToken as any
);
UserRoute.put(
  "/forgotpassword",
  TrafficControl.PasswordResetRateLimit as any,
  authenicationController.ForgotPassword as any
);

//Recaptcha
UserRoute.post("/recaptchaverify", VerifyRecaptcha as any);

//Form Routes - Enhanced Security for Sensitive Operations
UserRoute.post(
  "/createform",
  [UserMiddleware.VerifyTokenAndSession, validate(createFormValidate) as any],
  CreateForm as any
);
UserRoute.put(
  "/editform",
  UserMiddleware.VerifyTokenAndSession as any,
  EditForm as any
);
UserRoute.delete(
  "/deleteform",
  UserMiddleware.VerifyTokenAndSession as any,
  DeleteForm as any
);
UserRoute.get(
  "/getallform",
  UserMiddleware.VerifyToken as any,
  GetAllForm as any
);
UserRoute.get(
  "/filteredform",
  UserMiddleware.VerifyToken as any,
  GetFilterForm as any
);
UserRoute.put(
  "/modifypage",
  UserMiddleware.VerifyToken as any,
  PageHandler as any
);

// Public Form Access Route (no authentication required)
UserRoute.get(
  "/form/:formId",
  form_responseController.GetPublicFormData as any
);

//Form Owner Management Routes
UserRoute.post(
  "/addformowner",
  UserMiddleware.VerifyToken as any,
  AddFormOwner as any
);
UserRoute.delete(
  "/removeformowner",
  UserMiddleware.VerifyToken as any,
  RemoveFormOwner as any
);
UserRoute.get(
  "/getformowners/:formId",
  UserMiddleware.VerifyToken as any,
  GetFormOwners as any
);
UserRoute.delete(
  "/removeselfform",
  UserMiddleware.VerifyToken as any,
  RemoveSelfFromForm as any
);

//Form Validation Routes
UserRoute.get(
  "/validateform",
  UserMiddleware.VerifyToken as any,
  ValidateFormBeforeAction as any
);
UserRoute.get(
  "/validatecontent",
  UserMiddleware.VerifyToken as any,
  ValidateFormContent as any
);

//Form Content Routes

UserRoute.post(
  "/addcontent",
  [UserMiddleware.VerifyToken as any, validate(ContentValidate) as any],
  AddFormContent as any
);
UserRoute.put(
  "/savecontent",
  UserMiddleware.VerifyToken as any,
  questionController.SaveQuestion as any
);
UserRoute.put(
  "/editcontent",
  UserMiddleware.VerifyToken as any,
  EditFormContent as any
);
UserRoute.delete(
  "/deletecontent",
  UserMiddleware.VerifyToken as any,
  questionController.DeleteQuestion as any
);

// Question Routes - Get questions
UserRoute.get(
  "/question/getAllQuestion",
  questionController.GetAllQuestion as any
);

UserRoute.post(
  "/handlecondition",
  UserMiddleware.VerifyToken as any,
  ConditionQuestionValidator.validateConditionCreationMiddleware as any,
  questionController.handleCondition as any
);

UserRoute.post(
  "/savequestion",
  UserMiddleware.VerifyToken as any,
  ConditionQuestionValidator.validateConditionMiddleware as any,
  questionController.SaveQuestion as any
);

UserRoute.post(
  "/editcontent",
  UserMiddleware.VerifyToken as any,
  ConditionQuestionValidator.validateConditionMiddleware as any,
  EditFormContent as any
);

//Form Response Route
UserRoute.post("/submitform", form_responseController.SubmitResponse as never);
UserRoute.get(
  "/validateformsubmission",
  UserMiddleware.VerifyToken as any,
  form_responseController.ValidateFormForSubmission as any
);
UserRoute.get(
  "/getresponsebyform",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetResponseByFormId as any
);
UserRoute.get(
  "/getresponse",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetResponseByUserId as any
);
UserRoute.get(
  "/getuserresponses",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetUserResponses as any
);
UserRoute.get(
  "/getguestresponse",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetGuestResponse as any
);

// Public Form Access Routes (no authentication required)
UserRoute.post(
  "/response/submit-response",
  validate(FormResponseController.publicSubmitValidate) as any,
  form_responseController.SubmitPublicResponse as any
);

// Response Management Routes
UserRoute.post(
  "/response/send-links",
  UserMiddleware.VerifyToken as any,
  form_responseController.SendFormLinks as any
);
UserRoute.post(
  "/response/generate-link",
  UserMiddleware.VerifyToken as any,
  form_responseController.GenerateFormLink as any
);
UserRoute.put(
  "/response/update-score",
  UserMiddleware.VerifyToken as any,
  form_responseController.UpdateResponseScore as any
);

// Analytics Routes
UserRoute.get(
  "/response/analytics/:formId",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetFormAnalytics as any
);
UserRoute.get(
  "/response/analytics/:formId/export",
  UserMiddleware.VerifyToken as any,
  form_responseController.ExportAnalytics as any
);

export default UserRoute;
