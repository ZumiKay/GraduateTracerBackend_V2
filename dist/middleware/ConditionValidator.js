"use strict";
/**
 * Backend middleware to validate condition questions
 * Ensures that condition questions are only allowed for checkbox and multiple choice questions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConditionQuestionValidator = void 0;
const Content_model_1 = require("../model/Content.model");
const helper_1 = require("../utilities/helper");
class ConditionQuestionValidator {
    /**
     * Validates that condition questions are only allowed for checkbox and multiple choice questions
     */
    static validateConditionQuestionTypes(question) {
        if (!question.conditional || question.conditional.length === 0) {
            return { isValid: true };
        }
        const allowedTypes = [Content_model_1.QuestionType.CheckBox, Content_model_1.QuestionType.MultipleChoice];
        if (!allowedTypes.includes(question.type)) {
            return {
                isValid: false,
                error: `Condition questions are only allowed for checkbox and multiple choice questions. Current type: ${question.type}`,
            };
        }
        return { isValid: true };
    }
    /**
     * Validates that condition keys correspond to valid option indices
     */
    static validateConditionKeys(question) {
        const errors = [];
        if (!question.conditional || question.conditional.length === 0) {
            return { isValid: true, errors };
        }
        const options = question.type === Content_model_1.QuestionType.MultipleChoice
            ? question.multiple
            : question.checkbox;
        if (!options || options.length === 0) {
            errors.push("Question has conditional logic but no options defined");
            return { isValid: false, errors };
        }
        question.conditional.forEach((condition, conditionIndex) => {
            if (condition.key === undefined || condition.key === null) {
                errors.push(`Condition ${conditionIndex} has undefined key`);
                return;
            }
            const optionExists = options.some((option) => option.idx === condition.key);
            if (!optionExists) {
                errors.push(`Condition ${conditionIndex} references non-existent option key: ${condition.key}`);
            }
        });
        return { isValid: errors.length === 0, errors };
    }
    /**
     * Validates a single content item for condition compliance
     */
    static validateSingleContent(content) {
        const errors = [];
        // Check if question type supports conditions
        const typeValidation = this.validateConditionQuestionTypes(content);
        if (!typeValidation.isValid) {
            errors.push(typeValidation.error);
        }
        // Check if condition keys are valid
        const keyValidation = this.validateConditionKeys(content);
        if (!keyValidation.isValid) {
            errors.push(...keyValidation.errors);
        }
        return { isValid: errors.length === 0, errors };
    }
    /**
     * Validates multiple content items for condition compliance
     */
    static validateMultipleContent(contents) {
        const errors = [];
        contents.forEach((content, index) => {
            const validation = this.validateSingleContent(content);
            if (!validation.isValid) {
                validation.errors.forEach((error) => {
                    errors.push(`Content ${index}: ${error}`);
                });
            }
        });
        return { isValid: errors.length === 0, errors };
    }
}
exports.ConditionQuestionValidator = ConditionQuestionValidator;
/**
 * Middleware to validate condition questions on content creation/update
 */
ConditionQuestionValidator.validateConditionMiddleware = (req, res, next) => {
    try {
        const { content, contents, data } = req.body;
        let validationResult;
        if (content) {
            // Single content validation
            validationResult =
                ConditionQuestionValidator.validateSingleContent(content);
        }
        else if (contents) {
            // Single content validation (alternative field name)
            validationResult =
                ConditionQuestionValidator.validateSingleContent(contents);
        }
        else if (data && Array.isArray(data)) {
            // Multiple content validation
            validationResult =
                ConditionQuestionValidator.validateMultipleContent(data);
        }
        else {
            // No content to validate, proceed
            return next();
        }
        if (!validationResult.isValid) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, `Invalid condition question configuration: ${validationResult.errors.join(", ")}`));
        }
        next();
    }
    catch (error) {
        console.error("Condition validation middleware error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
    }
};
/**
 * Middleware specifically for handling condition creation
 */
ConditionQuestionValidator.validateConditionCreationMiddleware = (req, res, next) => {
    try {
        const { content, key, newContent } = req.body;
        if (!content || !content._id) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Parent content ID is required for condition creation"));
        }
        if (key === undefined || key === null) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "Condition key is required"));
        }
        if (!newContent) {
            return res
                .status(400)
                .json((0, helper_1.ReturnCode)(400, "New content is required for condition creation"));
        }
        // The validation of the parent question's type will be handled by the main controller
        // since we need to fetch the parent question from the database
        next();
    }
    catch (error) {
        console.error("Condition creation validation middleware error:", error);
        return res.status(500).json((0, helper_1.ReturnCode)(500, "Internal server error"));
    }
};
exports.default = ConditionQuestionValidator;
