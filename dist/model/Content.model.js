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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionType = void 0;
const mongoose_1 = require("mongoose");
var QuestionType;
(function (QuestionType) {
    QuestionType["MultipleChoice"] = "multiple";
    QuestionType["CheckBox"] = "checkbox";
    QuestionType["Text"] = "texts";
    QuestionType["Number"] = "number";
    QuestionType["Date"] = "date";
    QuestionType["RangeDate"] = "rangedate";
    QuestionType["Selection"] = "selection";
    QuestionType["RangeNumber"] = "rangenumber";
    QuestionType["ShortAnswer"] = "shortanswer";
    QuestionType["Paragraph"] = "paragraph";
})(QuestionType || (exports.QuestionType = QuestionType = {}));
//Sub Documents
const CheckboxQuestionSchema = new mongoose_1.Schema({
    idx: {
        type: Number,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
});
const RangeSchema = new mongoose_1.Schema({
    start: {
        type: mongoose_1.Schema.Types.Mixed, // Can handle Date or Number
        required: true,
    },
    end: {
        type: mongoose_1.Schema.Types.Mixed, // Can handle Date or Number
        required: true,
    },
});
const ConditionalSchema = new mongoose_1.Schema({
    key: {
        type: "Number",
        required: true,
    },
    contentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Content",
        required: true,
    },
});
const AnswerKeySchema = new mongoose_1.Schema({
    answer: {
        type: mongoose_1.Schema.Types.Mixed, // Handles string, number, date, ranges, arrays
        required: true,
    },
    isCorrect: {
        type: Boolean,
        default: true,
    },
});
const TitleSchema = new mongoose_1.Schema({
    type: {
        type: String,
        required: true,
    },
    content: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
});
//Parent Document
const ContentSchema = new mongoose_1.Schema({
    formId: {
        type: mongoose_1.Schema.ObjectId,
        required: true,
    },
    title: {
        type: TitleSchema,
        required: true,
    },
    type: {
        type: "string",
        enum: Object.values(QuestionType),
        required: true,
    },
    text: {
        type: "string",
    },
    checkbox: {
        type: [CheckboxQuestionSchema],
    },
    multiple: {
        type: [CheckboxQuestionSchema],
    },
    range: {
        type: RangeSchema,
    },
    numrange: {
        type: RangeSchema,
    },
    date: {
        type: Date,
    },
    answer: {
        type: AnswerKeySchema,
    },
    conditional: {
        type: [ConditionalSchema],
    },
    parentcontent: {
        type: Object,
        required: false,
    },
    score: {
        type: Number,
        default: 0,
    },
    require: {
        type: Boolean,
        default: false,
    },
    page: {
        type: Number,
        default: 1,
    },
    hasAnswer: {
        type: Boolean,
        default: false,
    },
    isValidated: {
        type: Boolean,
        default: false,
    },
});
//Pre-save middleware to update form total score
ContentSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const Form = require("./Form.model").default;
            // Calculate total score for all contents in this form
            const allContents = yield Content.find({ formId: this.formId });
            const totalScore = allContents.reduce((sum, content) => {
                return sum + (content.score || 0);
            }, 0) + (this.score || 0);
            // Update the form's total score
            yield Form.findByIdAndUpdate(this.formId, { totalscore: totalScore });
            next();
        }
        catch (error) {
            next(error);
        }
    });
});
//Pre-remove middleware to update form total score
ContentSchema.pre("deleteOne", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const Form = require("./Form.model").default;
            const contentToDelete = yield this.model.findOne(this.getQuery());
            if (contentToDelete) {
                const remainingContents = yield Content.find({
                    formId: contentToDelete.formId,
                    _id: { $ne: contentToDelete._id },
                });
                const totalScore = remainingContents.reduce((sum, content) => {
                    return sum + (content.score || 0);
                }, 0);
                yield Form.findByIdAndUpdate(contentToDelete.formId, {
                    totalscore: totalScore,
                });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
});
//Indexes
ContentSchema.index({ formId: 1, page: 1 });
ContentSchema.index({ idx: 1 });
const Content = (0, mongoose_1.model)("Content", ContentSchema);
exports.default = Content;
