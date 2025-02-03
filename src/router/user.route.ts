import { Router } from "express";

import {
  CreateForm,
  DeleteForm,
  EditForm,
  GetAllForm,
  GetFilterForm,
} from "../controller/form.controller";
import {
  AddFormContent,
  ContentValidate,
  DeleteContent,
  EditFormContent,
} from "../controller/content.controller";
import { createFormValidate } from "../model/Form.model";
import { validate } from "../middleware/Validatetor";
import authenicationController from "../controller/authenication.controller";
import UserMiddleware from "../middleware/User.middleware";
import {
  DeleteUser,
  EditUser,
  RegisterUser,
  UserValidate,
} from "../controller/user.controller";
import form_responseController from "../controller/form_response.controller";
import VerifyRecaptcha from "../controller/recaptcha.controller";
import TrafficMiddleware from "../middleware/Traffic.middleware";
import questionController from "../controller/question.controller";

const UserRoute = Router();

//RegisterUser
UserRoute.post(
  "/registeruser",
  validate(UserValidate) as any,
  RegisterUser as any
);
UserRoute.put("/edituser", UserMiddleware.VerifyToken as any, EditUser as any);
UserRoute.delete(
  "/deleteuser",
  UserMiddleware.VerifyToken as any,
  DeleteUser as any
);

//Authentication
UserRoute.post(
  "/login",
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
UserRoute.put("/forgotpassword", authenicationController.ForgotPassword as any);

//Recaptcha
UserRoute.post("/recaptchaverify", VerifyRecaptcha as any);

//Form Routes
UserRoute.post(
  "/createform",
  [UserMiddleware.VerifyToken, validate(createFormValidate) as any],
  CreateForm as any
);
UserRoute.put("/editform", UserMiddleware.VerifyToken as any, EditForm as any);
UserRoute.delete(
  "/deleteform",
  UserMiddleware.VerifyToken as any,
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
  DeleteContent as any
);

//Form Response Route
UserRoute.post("/submitform", form_responseController.SubmitResponse);
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
  "/getguestresponse",
  UserMiddleware.VerifyToken as any,
  form_responseController.GetGuestResponse as any
);

export default UserRoute;
