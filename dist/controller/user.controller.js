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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidate = void 0;
exports.GetRespondentProfile = GetRespondentProfile;
exports.RegisterUser = RegisterUser;
exports.EditUser = EditUser;
exports.DeleteUser = DeleteUser;
const helper_1 = require("../utilities/helper");
const MongoErrorHandler_1 = require("../utilities/MongoErrorHandler");
const zod_1 = require("zod");
const User_model_1 = __importStar(require("../model/User.model"));
const email_1 = __importDefault(require("../utilities/email"));
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.UserValidate = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Email is required"),
        password: zod_1.z
            .string()
            .refine((pass) => (0, helper_1.ValidatePassword)(pass), "Invalid Password"),
        role: zod_1.z.nativeEnum(User_model_1.ROLE).optional(),
    }),
});
function GetRespondentProfile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        const operationId = MongoErrorHandler_1.MongoErrorHandler.generateOperationId("get_profile");
        try {
            const profile = yield User_model_1.default.findOne({ email: data.email })
                .select("_id")
                .lean();
            if (profile) {
                return res.status(200).json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(200)), { data: profile }));
            }
            return res.status(404).json((0, helper_1.ReturnCode)(404, "No User Found"));
        }
        catch (error) {
            const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
                operationId,
                customMessage: "Failed to retrieve user profile",
            });
            if (!mongoErrorHandled.handled) {
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        }
    });
}
function RegisterUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        const operationId = MongoErrorHandler_1.MongoErrorHandler.generateOperationId("register_user");
        try {
            const isUser = yield User_model_1.default.findOne({ email: data.email });
            if (isUser)
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Email already exist"));
            const password = (0, helper_1.hashedPassword)(data.password);
            yield User_model_1.default.create(Object.assign(Object.assign({}, data), { role: User_model_1.ROLE.USER, password }));
            return res.status(201).json((0, helper_1.ReturnCode)(201, "User registered"));
        }
        catch (error) {
            console.log(`[${operationId}] Register User Error:`, error);
            const mongoErrorHandled = MongoErrorHandler_1.MongoErrorHandler.handleMongoError(error, res, {
                operationId,
                customMessage: "Failed to register user",
            });
            if (!mongoErrorHandled.handled) {
                return res.status(500).json((0, helper_1.ReturnCode)(500));
            }
        }
    });
}
function EditUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const edituserdata = req.body;
        try {
            if (!edituserdata._id || !edituserdata.edittype)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            if (edituserdata.edittype === "email") {
                switch (edituserdata.type) {
                    case "vfy":
                        {
                            let generateCode = (0, helper_1.RandomNumber)(6);
                            let isUnqiue = false;
                            while (!isUnqiue) {
                                const isCode = yield User_model_1.default.findOne({ code: generateCode });
                                if (!isCode) {
                                    isUnqiue = true;
                                }
                                generateCode = (0, helper_1.RandomNumber)(6);
                            }
                            yield User_model_1.default.findByIdAndUpdate(edituserdata._id, {
                                code: generateCode,
                            });
                            //Send Code Email
                            const sendemail = yield (0, email_1.default)(edituserdata.email, "Confirm Email Address", "Email Address Confirmation", "");
                            if (!sendemail.success) {
                                return res.status(500).json((0, helper_1.ReturnCode)(500));
                            }
                        }
                        break;
                    case "confirm":
                        {
                            if (!edituserdata.code) {
                                return res.status(400).json((0, helper_1.ReturnCode)(400));
                            }
                            const isUser = yield User_model_1.default.findOne({ code: edituserdata.code });
                            if (!isUser)
                                return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Code"));
                            yield User_model_1.default.findByIdAndUpdate(edituserdata._id, { code: null });
                        }
                        break;
                    case "edit":
                        {
                            const updateUser = yield User_model_1.default.findByIdAndUpdate(edituserdata._id, {
                                email: edituserdata.email,
                            });
                            if (!updateUser)
                                return res.status(400).json((0, helper_1.ReturnCode)(400));
                        }
                        break;
                    default:
                        break;
                }
            }
            else {
                const user = yield User_model_1.default.findById(edituserdata._id);
                if (!edituserdata.password || !edituserdata.newpassword || !user)
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                const isPassword = bcrypt_1.default.compareSync(edituserdata.password, user.password);
                if (!isPassword)
                    return res.status(400).json((0, helper_1.ReturnCode)(400));
                const updatedPassowrd = (0, helper_1.hashedPassword)(edituserdata.newpassword);
                yield User_model_1.default.findByIdAndUpdate(edituserdata._id, {
                    password: updatedPassowrd,
                });
            }
            return res.status(200).json((0, helper_1.ReturnCode)(200));
        }
        catch (error) {
            console.log("Edit User", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
function DeleteUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = req.body;
        try {
            if (!id)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            yield User_model_1.default.findByIdAndDelete(id);
            return res.status(200).json((0, helper_1.ReturnCode)(200, "User Deleted"));
        }
        catch (error) {
            console.log("Delete User", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
