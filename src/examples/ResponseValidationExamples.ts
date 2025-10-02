// Example usage of the improved hasRespondent method
import { Request, Response } from "express";
import { ResponseValidationService } from "../services/ResponseValidationService";
import { CustomRequest } from "../types/customType";

/**
 * Example controller demonstrating the improved hasRespondent method
 */
export class ExampleUsageController {
  /**
   * Example 1: Check duplicate submission in form submission endpoint
   */
  static async submitFormResponse(req: CustomRequest, res: Response) {
    try {
      const formId = req.params.formId;

      // Use the convenient helper method to check from request
      const duplicateCheck =
        await ResponseValidationService.hasRespondentFromRequest(formId, req, {
          includeFallbackChecks: true, // Enable fallback strategies
        });

      if (duplicateCheck.hasResponded) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted a response for this form",
          details: {
            trackingMethod: duplicateCheck.trackingMethod,
            confidence: duplicateCheck.confidence,
            previousResponseId: duplicateCheck.responseId,
            submittedAt: duplicateCheck.metadata?.submittedAt,
          },
        });
      }

      // Continue with form submission...
      res.json({
        success: true,
        message: "Response submitted successfully",
        trackingInfo: {
          fingerprint: duplicateCheck.metadata?.fingerprint,
          method: "none", // No previous response found
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to process form submission",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Example 2: Manual tracking data check (direct method usage)
   */
  static async checkRespondentStatus(req: Request, res: Response) {
    try {
      const { formId } = req.params;
      const { fingerprint, ipAddress, userId, guestEmail } = req.body;

      // Direct usage with specific options
      const result = await ResponseValidationService.hasRespondent(formId, {
        fingerprint,
        ipAddress,
        userId,
        guestEmail,
        requireExactMatch: false, // Allow fallback strategies
        includeFallbackChecks: true,
      });

      res.json({
        hasResponded: result.hasResponded,
        trackingMethod: result.trackingMethod,
        confidence: result.confidence,
        responseDetails: result.responseId
          ? {
              id: result.responseId,
              submittedAt: result.metadata?.submittedAt,
              fingerprintStrength: result.metadata?.fingerprintStrength,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to check respondent status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Example 3: High-security check (authenticated users only)
   */
  static async checkAuthenticatedUserResponse(
    req: CustomRequest,
    res: Response
  ) {
    try {
      const { formId } = req.params;
      const userId = req.user?.id.toString();

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // High-confidence check for authenticated users
      const result = await ResponseValidationService.hasRespondent(formId, {
        userId,
        requireExactMatch: true, // Only accept exact user ID match
        includeFallbackChecks: false, // No fallback for security
      });

      res.json({
        hasResponded: result.hasResponded,
        confidence: result.confidence,
        responseId: result.responseId,
        trackingMethod: result.trackingMethod,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to check user response status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Example 4: Guest user with email verification
   */
  static async checkGuestUserResponse(req: Request, res: Response) {
    try {
      const { formId } = req.params;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required for guest user verification",
        });
      }

      // Check by guest email with fingerprint as additional verification
      const trackingOptions = ResponseValidationService.extractTrackingOptions(
        req,
        {
          guestEmail: email,
        }
      );

      const result = await ResponseValidationService.hasRespondent(
        formId,
        trackingOptions
      );

      res.json({
        hasResponded: result.hasResponded,
        trackingMethod: result.trackingMethod,
        confidence: result.confidence,
        metadata: {
          email: result.metadata?.guestEmail,
          fingerprint: result.metadata?.fingerprint,
          ipAddress: result.metadata?.ipAddress,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to check guest user response",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
