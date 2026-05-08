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
exports.UserValidate = void 0;
exports.GetRespondentProfile = GetRespondentProfile;
exports.GetUserProfile = GetUserProfile;
exports.RegisterUser = RegisterUser;
exports.EditUser = EditUser;
exports.DeleteUser = DeleteUser;
const helper_1 = require("../../utilities/helper");
const zod_1 = require("zod");
const User_model_1 = __importStar(require("../../model/User.model"));
const email_1 = __importDefault(require("../../utilities/email"));
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.UserValidate = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Email is required"),
        name: zod_1.z.string().optional(),
        password: zod_1.z
            .string()
            .refine((pass) => (0, helper_1.ValidatePassword)(pass), "Some Data Has Invalid Format"),
        role: zod_1.z.nativeEnum(User_model_1.ROLE).optional(),
    }),
});
async function GetRespondentProfile(req, res) {
    const data = req.body;
    try {
        const profile = await User_model_1.default.findOne({ email: data.email })
            .select("_id")
            .lean();
        if (profile) {
            return res.status(200).json({ ...(0, helper_1.ReturnCode)(200), data: profile });
        }
        return res.status(404).json((0, helper_1.ReturnCode)(404, "No User Found"));
    }
    catch (error) {
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
async function GetUserProfile(req, res) {
    const user = req.user;
    if (!user)
        return res.status(403).json((0, helper_1.ReturnCode)(403));
    try {
        const userProfile = await User_model_1.default.findById(user.sub)
            .select("email name role")
            .lean();
        if (!userProfile)
            return res.status(404).json((0, helper_1.ReturnCode)(404, "Can't find user"));
        return res.status(200).json({ data: userProfile });
    }
    catch (error) {
        console.log("Get User Profile", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
async function RegisterUser(req, res) {
    const data = req.body;
    try {
        const isUser = await User_model_1.default.findOne({
            $and: [{ email: data.email }, { name: data.name }],
        });
        if (isUser)
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Username or email already exist"));
        const password = (0, helper_1.hashedPassword)(data.password);
        await User_model_1.default.create({
            ...data,
            role: User_model_1.ROLE.USER,
            password,
        });
        return res.status(201).json((0, helper_1.ReturnCode)(201, "User registered"));
    }
    catch (error) {
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
async function EditUser(req, res) {
    const edituserdata = req.body;
    try {
        if (!edituserdata._id || !edituserdata.edittype)
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        if (edituserdata.edittype === "name") {
            const isName = await User_model_1.default.findOne({ name: edituserdata.name }).lean();
            if (isName) {
                return res.status(400).json((0, helper_1.ReturnCode)(400, "Username already exist"));
            }
            await User_model_1.default.updateOne({ _id: edituserdata._id }, { name: edituserdata.name });
        }
        if (edituserdata.edittype === "email") {
            switch (edituserdata.type) {
                case "vfy":
                    {
                        let generateCode = (0, helper_1.RandomNumber)(6);
                        let isUnqiue = false;
                        while (!isUnqiue) {
                            const isCode = await User_model_1.default.findOne({ code: generateCode });
                            if (!isCode) {
                                isUnqiue = true;
                            }
                            generateCode = (0, helper_1.RandomNumber)(6);
                        }
                        await User_model_1.default.findByIdAndUpdate(edituserdata._id, {
                            code: generateCode,
                        });
                        //Send Code Email
                        const sendemail = await (0, email_1.default)(edituserdata.email, "Confirm Email Address", "Email Address Confirmation", "");
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
                        const isUser = await User_model_1.default.findOne({ code: edituserdata.code });
                        if (!isUser)
                            return res.status(400).json((0, helper_1.ReturnCode)(400, "Invalid Code"));
                        await User_model_1.default.findByIdAndUpdate(edituserdata._id, { code: null });
                    }
                    break;
                case "edit":
                    {
                        const updateUser = await User_model_1.default.findByIdAndUpdate(edituserdata._id, {
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
        else if (edituserdata.edittype === "password") {
            const user = await User_model_1.default.findById(edituserdata._id);
            if (!edituserdata.password || !edituserdata.newpassword || !user)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            const isPassword = bcrypt_1.default.compareSync(edituserdata.password, user.password);
            if (!isPassword)
                return res.status(400).json((0, helper_1.ReturnCode)(400));
            const updatedPassowrd = (0, helper_1.hashedPassword)(edituserdata.newpassword);
            await User_model_1.default.findByIdAndUpdate(edituserdata._id, {
                password: updatedPassowrd,
            });
        }
        return res.status(200).json((0, helper_1.ReturnCode)(200));
    }
    catch (error) {
        console.log("Edit User", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
async function DeleteUser(req, res) {
    const id = req.body;
    try {
        if (!id)
            return res.status(400).json((0, helper_1.ReturnCode)(400));
        await User_model_1.default.findByIdAndDelete(id);
        return res.status(200).json((0, helper_1.ReturnCode)(200, "User Deleted"));
    }
    catch (error) {
        console.log("Delete User", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
