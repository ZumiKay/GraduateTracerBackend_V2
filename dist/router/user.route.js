"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ConditionValidator_1 = __importDefault(require("../middleware/ConditionValidator"));
const Traffic_middleware_1 = __importDefault(require("../middleware/Traffic.middleware"));
const form_controller_1 = require("../controller/form/form.controller");
const content_controller_1 = require("../controller/form/content.controller");
const Form_model_1 = require("../model/Form.model");
const Validatetor_1 = require("../middleware/Validatetor");
const authenication_controller_1 = __importDefault(require("../controller/auth/authenication.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const user_controller_1 = require("../controller/auth/user.controller");
const form_response_controller_1 = __importDefault(require("../controller/response/form_response.controller"));
const question_controller_1 = __importDefault(require("../controller/form/question.controller"));
const recaptcha_controller_1 = __importDefault(require("../controller/utils/recaptcha.controller"));
const form_collaborator_controller_1 = require("../controller/form/form.collaborator.controller");
const UserRoute = (0, express_1.Router)();
//Get User Profile
UserRoute.get("/user/profile", User_middleware_1.default.VerifyToken, user_controller_1.GetUserProfile);
//RegisterUser
UserRoute.post("/registeruser", Traffic_middleware_1.default.ApiRateLimit, (0, Validatetor_1.validate)(user_controller_1.UserValidate), user_controller_1.RegisterUser);
//User Management
UserRoute.put("/edituser", User_middleware_1.default.VerifyToken, user_controller_1.EditUser);
UserRoute.delete("/deleteuser", User_middleware_1.default.VerifyToken, user_controller_1.DeleteUser);
//Authentication
UserRoute.post("/login", Traffic_middleware_1.default.LoginRateLimit, (0, Validatetor_1.validate)(user_controller_1.UserValidate), authenication_controller_1.default.Login);
UserRoute.get("/checksession", authenication_controller_1.default.CheckSession);
UserRoute.delete("/logout", authenication_controller_1.default.Logout);
UserRoute.post("/refreshtoken", User_middleware_1.default.VerifyRefreshToken, authenication_controller_1.default.RefreshToken);
UserRoute.put("/forgotpassword", Traffic_middleware_1.default.PasswordResetRateLimit, authenication_controller_1.default.ForgotPassword);
//Recaptcha
UserRoute.post("/recaptchaverify", recaptcha_controller_1.default);
//Form Routes - Enhanced Security for Sensitive Operations
UserRoute.post("/createform", [
    User_middleware_1.default.VerifyToken,
    (0, Validatetor_1.validate)(Form_model_1.createFormValidate),
], form_controller_1.CreateForm);
UserRoute.put("/editform", User_middleware_1.default.VerifyToken, form_controller_1.EditForm);
UserRoute.delete("/deleteform", User_middleware_1.default.VerifyToken, form_controller_1.DeleteForm);
UserRoute.get("/getallform", User_middleware_1.default.VerifyToken, form_controller_1.GetAllForm);
UserRoute.get("/filteredform", User_middleware_1.default.VerifyToken, form_controller_1.GetFilterForm);
UserRoute.put("/modifypage", User_middleware_1.default.VerifyToken, form_controller_1.PageHandler);
//Respondent Form Authentication
UserRoute.get("/form/:formId", form_response_controller_1.default.GetPublicFormData);
// Get Form Details with Access Verification (for ViewResponsePage)
UserRoute.get("/form/details/:formId", User_middleware_1.default.VerifyToken, form_controller_1.GetFormDetails);
//Form Owner Management Routes
UserRoute.post("/addformowner", User_middleware_1.default.VerifyToken, form_controller_1.ManageFormCollaborator);
UserRoute.delete("/removeformowner", User_middleware_1.default.VerifyToken, form_controller_1.ManageFormCollaborator);
UserRoute.post("/collaborator/confirm", User_middleware_1.default.VerifyToken, form_collaborator_controller_1.ConfirmAddCollaborator);
UserRoute.get("/getformowners/:formId", User_middleware_1.default.VerifyToken, form_controller_1.GetFormCollaborators);
UserRoute.delete("/removeselfform/:formId", User_middleware_1.default.VerifyToken, form_controller_1.RemoveSelfFromForm);
UserRoute.put("/transferuser", User_middleware_1.default.VerifyToken, form_controller_1.ChangePrimaryOwner);
// Ownership transfer confirmation and cancellation
UserRoute.post("/ownership/confirm", User_middleware_1.default.VerifyToken, form_collaborator_controller_1.ConfirmOwnershipTransfer);
UserRoute.delete("/ownership/cancel", User_middleware_1.default.VerifyToken, form_collaborator_controller_1.CancelOwnershipTransfer);
// Pending collaborator management
UserRoute.post("/resendpending", User_middleware_1.default.VerifyToken, form_controller_1.ResendPendingInvitation);
UserRoute.delete("/deletepending", User_middleware_1.default.VerifyToken, form_controller_1.DeletePendingCollaborator);
//Form Validation Routes
UserRoute.get("/validateform", User_middleware_1.default.VerifyToken, form_controller_1.ValidateFormBeforeAction);
UserRoute.get("/validatecontent", User_middleware_1.default.VerifyToken, content_controller_1.ValidateFormContent);
//Form Content Routes
UserRoute.post("/addcontent", [
    User_middleware_1.default.VerifyToken,
    (0, Validatetor_1.validate)(content_controller_1.ContentValidate),
], content_controller_1.AddFormContent);
UserRoute.put("/savecontent", User_middleware_1.default.VerifyToken, question_controller_1.default.SaveQuestion);
UserRoute.put("/editcontent", User_middleware_1.default.VerifyToken, content_controller_1.EditFormContent);
UserRoute.delete("/deletecontent", User_middleware_1.default.VerifyToken, question_controller_1.default.DeleteQuestion);
// Question Routes - Get questions
UserRoute.get("/question/getAllQuestion", question_controller_1.default.GetAllQuestion);
UserRoute.post("/savequestion", User_middleware_1.default.VerifyToken, ConditionValidator_1.default.validateConditionMiddleware, question_controller_1.default.SaveQuestion);
UserRoute.post("/editcontent", User_middleware_1.default.VerifyToken, ConditionValidator_1.default.validateConditionMiddleware, content_controller_1.EditFormContent);
//Validate form contenet
UserRoute.get("/validateformsubmission", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ValidateFormForSubmission);
// Response Management Routes
UserRoute.post("/response/send-links", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendFormLinks);
UserRoute.post("/response/generate-link", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GenerateFormLink);
UserRoute.put("/response/update-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateResponseScore);
// Analytics Routes
UserRoute.get("/response/analytics/:formId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetFormAnalytics);
UserRoute.get("/response/analytics/:formId/export", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ExportAnalytics);
exports.default = UserRoute;
