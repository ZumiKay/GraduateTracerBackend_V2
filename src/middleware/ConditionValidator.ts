/**
 * Backend middleware to validate condition questions
 * Ensures that condition questions are only allowed for checkbox and multiple choice questions
 */

import { Request, Response, NextFunction } from "express";
import { ContentType, QuestionType } from "../model/Content.model";
import { ReturnCode } from "../utilities/helper";

export interface ConditionValidationRequest extends Request {
  body: {
    content?: ContentType;
    contents?: ContentType;
    data?: ContentType[];
    formId?: string;
    key?: number;
    newContent?: ContentType;
  };
}

export class ConditionQuestionValidator {
  /**
   * Validates that condition questions are only allowed for checkbox and multiple choice questions
   */
  static validateConditionQuestionTypes(question: ContentType): {
    isValid: boolean;
    error?: string;
  } {
    if (!question.conditional || question.conditional.length === 0) {
      return { isValid: true };
    }

    const allowedTypes = [QuestionType.CheckBox, QuestionType.MultipleChoice];

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
  static validateConditionKeys(question: ContentType): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!question.conditional || question.conditional.length === 0) {
      return { isValid: true, errors };
    }

    const options =
      question.type === QuestionType.MultipleChoice
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

      const optionExists = options.some(
        (option) => option.idx === condition.key
      );
      if (!optionExists) {
        errors.push(
          `Condition ${conditionIndex} references non-existent option key: ${condition.key}`
        );
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates a single content item for condition compliance
   */
  static validateSingleContent(content: ContentType): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if question type supports conditions
    const typeValidation = this.validateConditionQuestionTypes(content);
    if (!typeValidation.isValid) {
      errors.push(typeValidation.error!);
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
  static validateMultipleContent(contents: ContentType[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

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

  /**
   * Middleware to validate condition questions on content creation/update
   */
  static validateConditionMiddleware = (
    req: ConditionValidationRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    try {
      const { content, contents, data } = req.body;

      let validationResult: { isValid: boolean; errors: string[] };

      if (content) {
        // Single content validation
        validationResult =
          ConditionQuestionValidator.validateSingleContent(content);
      } else if (contents) {
        // Single content validation (alternative field name)
        validationResult =
          ConditionQuestionValidator.validateSingleContent(contents);
      } else if (data && Array.isArray(data)) {
        // Multiple content validation
        validationResult =
          ConditionQuestionValidator.validateMultipleContent(data);
      } else {
        // No content to validate, proceed
        return next();
      }

      if (!validationResult.isValid) {
        return res
          .status(400)
          .json(
            ReturnCode(
              400,
              `Invalid condition question configuration: ${validationResult.errors.join(
                ", "
              )}`
            )
          );
      }

      next();
    } catch (error) {
      console.error("Condition validation middleware error:", error);
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  };

  /**
   * Middleware specifically for handling condition creation
   */
  static validateConditionCreationMiddleware = (
    req: ConditionValidationRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    try {
      const { content, key, newContent } = req.body;

      if (!content || !content._id) {
        return res
          .status(400)
          .json(
            ReturnCode(
              400,
              "Parent content ID is required for condition creation"
            )
          );
      }

      if (key === undefined || key === null) {
        return res
          .status(400)
          .json(ReturnCode(400, "Condition key is required"));
      }

      if (!newContent) {
        return res
          .status(400)
          .json(
            ReturnCode(400, "New content is required for condition creation")
          );
      }

      // The validation of the parent question's type will be handled by the main controller
      // since we need to fetch the parent question from the database
      next();
    } catch (error) {
      console.error("Condition creation validation middleware error:", error);
      return res.status(500).json(ReturnCode(500, "Internal server error"));
    }
  };
}

export default ConditionQuestionValidator;
