"use strict";
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
exports.createFormValidate = exports.DashboardTabType = exports.CollaboratorType = exports.returnscore = exports.TypeForm = exports.SubmitType = void 0;
const mongoose_1 = require("mongoose");
const zod_1 = __importDefault(require("zod"));
const Response_model_1 = __importDefault(require("./Response.model"));
var SubmitType;
(function (SubmitType) {
    SubmitType["Once"] = "ONCE";
    SubmitType["Multiple"] = "MULTIPLE";
})(SubmitType || (exports.SubmitType = SubmitType = {}));
var TypeForm;
(function (TypeForm) {
    TypeForm["Normal"] = "NORMAL";
    TypeForm["Quiz"] = "QUIZ";
})(TypeForm || (exports.TypeForm = TypeForm = {}));
var returnscore;
(function (returnscore) {
    returnscore["partial"] = "PARTIAL";
    returnscore["manual"] = "MANUAL";
})(returnscore || (exports.returnscore = returnscore = {}));
var CollaboratorType;
(function (CollaboratorType) {
    CollaboratorType["owner"] = "OWNER";
    CollaboratorType["editor"] = "EDITOR";
    CollaboratorType["creator"] = "CREATOR";
})(CollaboratorType || (exports.CollaboratorType = CollaboratorType = {}));
var DashboardTabType;
(function (DashboardTabType) {
    DashboardTabType["all"] = "all";
    DashboardTabType["filledform"] = "filledForm";
    DashboardTabType["myform"] = "myForm";
    DashboardTabType["otherform"] = "otherForm";
})(DashboardTabType || (exports.DashboardTabType = DashboardTabType = {}));
const FormSettingSchema = new mongoose_1.Schema({
    qcolor: {
        type: String,
        default: "#000000",
    },
    bg: {
        type: String,
        default: "#fff",
    },
    navbar: {
        type: String,
        default: null,
    },
    text: {
        type: String,
        default: "#000000",
    },
    submitonce: {
        type: Boolean,
        default: false,
    },
    email: { type: Boolean, default: false },
    returnscore: {
        type: String,
        enum: Object.values(returnscore),
        default: null,
        required: false,
    },
    autosave: {
        type: Boolean,
        default: false,
    },
    acceptResponses: {
        type: Boolean,
        default: true,
    },
});
const FormSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(TypeForm),
    },
    contentIds: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: "Content", // Reference to the related collection
        required: false,
    },
    setting: FormSettingSchema,
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User", // Reference to the related collection
        required: true,
    },
    owners: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: "User",
        default: [],
        required: false,
    },
    editors: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: "User",
        default: null,
        required: false,
    },
    totalpage: {
        type: Number,
        default: 1,
        required: false,
    },
    totalscore: {
        type: Number,
        required: false,
    },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
FormSchema.index({ user: 1 });
FormSchema.index({ owners: 1 });
FormSchema.index({ editors: 1 });
FormSchema.index({ type: 1 });
FormSchema.index({ title: "text" }); // If full-text search is needed
FormSchema.index({ _id: 1, responses: 1 });
//Pre-remove Hook
FormSchema.pre("deleteOne", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const formId = this.getQuery()._id;
        yield Response_model_1.default.deleteMany({ formId });
        next();
    });
});
const Form = (0, mongoose_1.model)("Form", FormSchema);
exports.default = Form;
exports.createFormValidate = zod_1.default.object({
    body: zod_1.default.object({
        title: zod_1.default.string().min(1, "Name is required"),
        type: zod_1.default.nativeEnum(TypeForm),
        contentIds: zod_1.default.array(zod_1.default.string()).optional(),
    }),
});
