"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredefinedErrorMessage = exports.ValidationErrorCodeEnum = void 0;
var ValidationErrorCodeEnum;
(function (ValidationErrorCodeEnum) {
    ValidationErrorCodeEnum["format"] = "FORMAT";
    ValidationErrorCodeEnum["answerformat"] = "ANSFORMAT";
    ValidationErrorCodeEnum["score"] = "SCORE";
    ValidationErrorCodeEnum["type"] = "TYPE";
    ValidationErrorCodeEnum["default"] = "DEFAULT";
    ValidationErrorCodeEnum["invalid"] = "INVALID";
    ValidationErrorCodeEnum["warning"] = "WARNING";
})(ValidationErrorCodeEnum || (exports.ValidationErrorCodeEnum = ValidationErrorCodeEnum = {}));
const PredefinedErrorMessage = (custom = {}) => {
    const errors = {
        [ValidationErrorCodeEnum.default]: {
            name: ValidationErrorCodeEnum.default,
            message: "Default Content Detected",
        },
        [ValidationErrorCodeEnum.format]: {
            name: ValidationErrorCodeEnum.format,
            message: "Invalid Format",
        },
        [ValidationErrorCodeEnum.answerformat]: {
            name: ValidationErrorCodeEnum.answerformat,
            message: "Invalid answer key",
        },
        [ValidationErrorCodeEnum.invalid]: {
            name: ValidationErrorCodeEnum.invalid,
            message: "Invalid Question",
        },
        [ValidationErrorCodeEnum.type]: {
            name: ValidationErrorCodeEnum.type,
            message: "Wrong Question Type",
        },
        [ValidationErrorCodeEnum.score]: {
            name: ValidationErrorCodeEnum.score,
            message: "Invalid Score",
        },
        [ValidationErrorCodeEnum.warning]: {
            name: ValidationErrorCodeEnum.warning,
            message: "Warning",
        },
    };
    if (custom.target && custom.customMess) {
        errors[custom.target] = {
            name: custom.target,
            message: custom.customMess,
        };
    }
    return errors;
};
exports.PredefinedErrorMessage = PredefinedErrorMessage;
