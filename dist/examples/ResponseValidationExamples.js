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
exports.ExampleUsageController = void 0;
const ResponseValidationService_1 = require("../services/ResponseValidationService");
/**
 * Example controller demonstrating the improved hasRespondent method
 */
class ExampleUsageController {
    /**
     * Example 1: Check duplicate submission in form submission endpoint
     */
    static submitFormResponse(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const formId = req.params.formId;
                // Use the convenient helper method to check from request
                const duplicateCheck = yield ResponseValidationService_1.ResponseValidationService.hasRespondentFromRequest(formId, req, {
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
                            submittedAt: (_a = duplicateCheck.metadata) === null || _a === void 0 ? void 0 : _a.submittedAt,
                        },
                    });
                }
                // Continue with form submission...
                res.json({
                    success: true,
                    message: "Response submitted successfully",
                    trackingInfo: {
                        fingerprint: (_b = duplicateCheck.metadata) === null || _b === void 0 ? void 0 : _b.fingerprint,
                        method: "none", // No previous response found
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to process form submission",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Example 2: Manual tracking data check (direct method usage)
     */
    static checkRespondentStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { formId } = req.params;
                const { fingerprint, ipAddress, userId, guestEmail } = req.body;
                // Direct usage with specific options
                const result = yield ResponseValidationService_1.ResponseValidationService.hasRespondent(formId, {
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
                            submittedAt: (_a = result.metadata) === null || _a === void 0 ? void 0 : _a.submittedAt,
                            fingerprintStrength: (_b = result.metadata) === null || _b === void 0 ? void 0 : _b.fingerprintStrength,
                        }
                        : null,
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to check respondent status",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Example 3: High-security check (authenticated users only)
     */
    static checkAuthenticatedUserResponse(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { formId } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id.toString();
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: "Authentication required",
                    });
                }
                // High-confidence check for authenticated users
                const result = yield ResponseValidationService_1.ResponseValidationService.hasRespondent(formId, {
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
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to check user response status",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Example 4: Guest user with email verification
     */
    static checkGuestUserResponse(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
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
                const trackingOptions = ResponseValidationService_1.ResponseValidationService.extractTrackingOptions(req, {
                    guestEmail: email,
                });
                const result = yield ResponseValidationService_1.ResponseValidationService.hasRespondent(formId, trackingOptions);
                res.json({
                    hasResponded: result.hasResponded,
                    trackingMethod: result.trackingMethod,
                    confidence: result.confidence,
                    metadata: {
                        email: (_a = result.metadata) === null || _a === void 0 ? void 0 : _a.guestEmail,
                        fingerprint: (_b = result.metadata) === null || _b === void 0 ? void 0 : _b.fingerprint,
                        ipAddress: (_c = result.metadata) === null || _c === void 0 ? void 0 : _c.ipAddress,
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to check guest user response",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.ExampleUsageController = ExampleUsageController;
