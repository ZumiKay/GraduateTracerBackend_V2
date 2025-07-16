"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ConditionValidator_1 = __importDefault(require("../middleware/ConditionValidator"));
const Traffic_middleware_1 = __importDefault(require("../middleware/Traffic.middleware"));
const form_controller_1 = require("../controller/form.controller");
const content_controller_1 = require("../controller/content.controller");
const Form_model_1 = require("../model/Form.model");
const Validatetor_1 = require("../middleware/Validatetor");
const authenication_controller_1 = __importDefault(require("../controller/authenication.controller"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const user_controller_1 = require("../controller/user.controller");
const form_response_controller_1 = __importStar(require("../controller/form_response.controller"));
const recaptcha_controller_1 = __importDefault(require("../controller/recaptcha.controller"));
const question_controller_1 = __importDefault(require("../controller/question.controller"));
const UserRoute = (0, express_1.Router)();
//RegisterUser
UserRoute.post("/registeruser", Traffic_middleware_1.default.ApiRateLimit, (0, Validatetor_1.validate)(user_controller_1.UserValidate), user_controller_1.RegisterUser);
UserRoute.put("/edituser", User_middleware_1.default.VerifyToken, user_controller_1.EditUser);
UserRoute.delete("/deleteuser", User_middleware_1.default.VerifyToken, user_controller_1.DeleteUser);
//Authentication
UserRoute.post("/login", Traffic_middleware_1.default.LoginRateLimit, (0, Validatetor_1.validate)(user_controller_1.UserValidate), authenication_controller_1.default.Login);
UserRoute.get("/checksession", User_middleware_1.default.VerifyToken, User_middleware_1.default.VerifyRefreshToken, authenication_controller_1.default.CheckSession);
UserRoute.delete("/logout", authenication_controller_1.default.Logout);
UserRoute.post("/refreshtoken", User_middleware_1.default.VerifyRefreshToken, authenication_controller_1.default.RefreshToken);
UserRoute.put("/forgotpassword", Traffic_middleware_1.default.PasswordResetRateLimit, authenication_controller_1.default.ForgotPassword);
//Recaptcha
UserRoute.post("/recaptchaverify", recaptcha_controller_1.default);
//Form Routes
UserRoute.post("/createform", [User_middleware_1.default.VerifyToken, (0, Validatetor_1.validate)(Form_model_1.createFormValidate)], form_controller_1.CreateForm);
UserRoute.put("/editform", User_middleware_1.default.VerifyToken, form_controller_1.EditForm);
UserRoute.delete("/deleteform", User_middleware_1.default.VerifyToken, form_controller_1.DeleteForm);
UserRoute.get("/getallform", User_middleware_1.default.VerifyToken, form_controller_1.GetAllForm);
UserRoute.get("/filteredform", User_middleware_1.default.VerifyToken, form_controller_1.GetFilterForm);
UserRoute.put("/modifypage", User_middleware_1.default.VerifyToken, form_controller_1.PageHandler);
//Form Validation Routes
UserRoute.get("/validateform", User_middleware_1.default.VerifyToken, form_controller_1.ValidateFormBeforeAction);
UserRoute.get("/validatecontent", User_middleware_1.default.VerifyToken, content_controller_1.ValidateFormContent);
//Form Content Routes
UserRoute.post("/addcontent", [User_middleware_1.default.VerifyToken, (0, Validatetor_1.validate)(content_controller_1.ContentValidate)], content_controller_1.AddFormContent);
UserRoute.put("/savecontent", User_middleware_1.default.VerifyToken, question_controller_1.default.SaveQuestion);
UserRoute.put("/editcontent", User_middleware_1.default.VerifyToken, content_controller_1.EditFormContent);
UserRoute.delete("/deletecontent", User_middleware_1.default.VerifyToken, question_controller_1.default.DeleteQuestion);
UserRoute.post("/handlecondition", User_middleware_1.default.VerifyToken, ConditionValidator_1.default.validateConditionCreationMiddleware, question_controller_1.default.handleCondition);
UserRoute.post("/savequestion", User_middleware_1.default.VerifyToken, ConditionValidator_1.default.validateConditionMiddleware, question_controller_1.default.SaveQuestion);
UserRoute.post("/editcontent", User_middleware_1.default.VerifyToken, ConditionValidator_1.default.validateConditionMiddleware, content_controller_1.EditFormContent);
//Form Response Route
UserRoute.post("/submitform", form_response_controller_1.default.SubmitResponse);
UserRoute.get("/validateformsubmission", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ValidateFormForSubmission);
UserRoute.get("/getresponsebyform", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseByFormId);
UserRoute.get("/getresponse", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetResponseByUserId);
UserRoute.get("/getguestresponse", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetGuestResponse);
// Public Form Access Routes (no authentication required)
UserRoute.get("/response/form/:formId", form_response_controller_1.default.GetPublicFormData);
UserRoute.post("/response/submit-response", (0, Validatetor_1.validate)(form_response_controller_1.FormResponseController.publicSubmitValidate), form_response_controller_1.default.SubmitPublicResponse);
// Response Management Routes
UserRoute.post("/response/send-links", User_middleware_1.default.VerifyToken, form_response_controller_1.default.SendFormLinks);
UserRoute.post("/response/generate-link", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GenerateFormLink);
UserRoute.put("/response/update-score", User_middleware_1.default.VerifyToken, form_response_controller_1.default.UpdateResponseScore);
// Analytics Routes
UserRoute.get("/response/analytics/:formId", User_middleware_1.default.VerifyToken, form_response_controller_1.default.GetFormAnalytics);
UserRoute.get("/response/analytics/:formId/export", User_middleware_1.default.VerifyToken, form_response_controller_1.default.ExportAnalytics);
exports.default = UserRoute;
