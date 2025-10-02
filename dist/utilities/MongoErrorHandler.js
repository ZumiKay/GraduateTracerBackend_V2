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
exports.MongoErrorHandler = void 0;
exports.handleMongoError = handleMongoError;
exports.generateOperationId = generateOperationId;
exports.handleDatabaseError = handleDatabaseError;
const helper_1 = require("./helper");
/**
 * Centralized MongoDB error handler for consistent error management across controllers
 * Handles common MongoDB errors with appropriate HTTP status codes and user-friendly messages
 */
class MongoErrorHandler {
    /**
     * Handle MongoDB errors and return appropriate HTTP responses
     * @param error - The error object to handle
     * @param res - Express response object
     * @param options - Configuration options for error handling
     * @returns MongoErrorResponse indicating if error was handled
     */
    static handleMongoError(error, res, options = {}) {
        const { operationId = `op_${Date.now()}`, customMessage, includeErrorDetails = false, logLevel = "error", } = options;
        // Check if it's a MongoDB error
        if (!this.isMongoError(error)) {
            return { handled: false };
        }
        const errorInfo = this.categorizeMongoError(error);
        const logMessage = `[${operationId}] MongoDB Error - ${errorInfo.category}: ${error.message}`;
        // Log based on specified level
        switch (logLevel) {
            case "error":
                console.error(logMessage, Object.assign({ errorCode: error.code, errorName: error.name, operationId }, (includeErrorDetails && { stack: error.stack })));
                break;
            case "warn":
                console.warn(logMessage);
                break;
            case "info":
                console.info(logMessage);
                break;
        }
        // Prepare response
        const baseResponse = this.getBaseResponse(errorInfo.statusCode, customMessage || errorInfo.message);
        const response = Object.assign(Object.assign(Object.assign(Object.assign({}, baseResponse), { operationId, errorCategory: errorInfo.category }), (includeErrorDetails && {
            errorCode: error.code,
            mongoErrorName: error.name,
        })), (errorInfo.retryAfter && { retryAfter: errorInfo.retryAfter }));
        res.status(errorInfo.statusCode).json(response);
        return {
            handled: true,
            statusCode: errorInfo.statusCode,
            response,
        };
    }
    /**
     * Get base response object with fallback for unsupported status codes
     */
    static getBaseResponse(statusCode, message) {
        // Use ReturnCode for supported status codes
        const supportedCodes = [200, 201, 400, 401, 403, 404, 500];
        if (supportedCodes.includes(statusCode)) {
            const result = (0, helper_1.ReturnCode)(statusCode, message);
            return result || { code: statusCode, message };
        }
        // Fallback for unsupported status codes
        return {
            code: statusCode,
            message: message,
        };
    }
    /**
     * Check if an error is a MongoDB-related error
     */
    static isMongoError(error) {
        var _a;
        if (!error)
            return false;
        const mongoErrorNames = [
            "MongoError",
            "MongoServerError",
            "MongoNetworkError",
            "MongoParseError",
            "MongoWriteConcernError",
            "MongoBulkWriteError",
            "MongoTimeoutError",
            "MongoTopologyClosedError",
            "ValidationError", // Mongoose validation errors
            "CastError", // Mongoose cast errors
            "DocumentNotFoundError",
            "OverwriteModelError",
            "MissingSchemaError",
        ];
        return (mongoErrorNames.includes(error.name) ||
            ((_a = error.name) === null || _a === void 0 ? void 0 : _a.startsWith("Mongo")) ||
            error.code !== undefined); // MongoDB errors typically have error codes
    }
    /**
     * Categorize MongoDB errors and determine appropriate response
     */
    static categorizeMongoError(error) {
        var _a;
        const errorCode = error.code;
        const errorName = error.name;
        const errorMessage = ((_a = error.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
        // Network and connection errors (503 - Service Unavailable)
        if (errorName === "MongoNetworkError" ||
            errorName === "MongoTimeoutError" ||
            errorName === "MongoTopologyClosedError" ||
            errorCode === 11000 || // Network timeout
            errorMessage.includes("timeout") ||
            errorMessage.includes("connection") ||
            errorMessage.includes("network")) {
            return {
                category: "CONNECTION_ERROR",
                statusCode: 503,
                message: "Database service temporarily unavailable",
                retryAfter: 30,
            };
        }
        // Authentication errors (401 - Unauthorized)
        if (errorCode === 18 || // AuthenticationFailed
            errorCode === 13 || // Unauthorized
            errorMessage.includes("authentication") ||
            errorMessage.includes("unauthorized")) {
            return {
                category: "AUTHENTICATION_ERROR",
                statusCode: 401,
                message: "Database authentication failed",
            };
        }
        // Duplicate key errors (409 - Conflict)
        if (errorCode === 11000 || // Duplicate key error
            errorMessage.includes("duplicate") ||
            errorMessage.includes("unique")) {
            return {
                category: "DUPLICATE_KEY_ERROR",
                statusCode: 409,
                message: "Resource already exists",
            };
        }
        // Validation errors (400 - Bad Request)
        if (errorName === "ValidationError" ||
            errorName === "CastError" ||
            errorCode === 121 || // Document validation failure
            errorMessage.includes("validation") ||
            errorMessage.includes("cast") ||
            errorMessage.includes("invalid")) {
            return {
                category: "VALIDATION_ERROR",
                statusCode: 400,
                message: "Invalid data provided",
            };
        }
        // Document not found errors (404 - Not Found)
        if (errorName === "DocumentNotFoundError" ||
            errorMessage.includes("not found")) {
            return {
                category: "NOT_FOUND_ERROR",
                statusCode: 404,
                message: "Resource not found",
            };
        }
        // Write concern errors (503 - Service Unavailable)
        if (errorName === "MongoWriteConcernError" ||
            errorMessage.includes("write concern")) {
            return {
                category: "WRITE_CONCERN_ERROR",
                statusCode: 503,
                message: "Database write operation failed",
                retryAfter: 60,
            };
        }
        // Bulk write errors (400 - Bad Request)
        if (errorName === "MongoBulkWriteError") {
            return {
                category: "BULK_WRITE_ERROR",
                statusCode: 400,
                message: "Bulk operation failed",
            };
        }
        // Parse errors (400 - Bad Request)
        if (errorName === "MongoParseError" ||
            errorMessage.includes("parse") ||
            errorMessage.includes("syntax")) {
            return {
                category: "PARSE_ERROR",
                statusCode: 400,
                message: "Invalid query or data format",
            };
        }
        // Schema errors (500 - Internal Server Error)
        if (errorName === "MissingSchemaError" ||
            errorName === "OverwriteModelError" ||
            errorMessage.includes("schema")) {
            return {
                category: "SCHEMA_ERROR",
                statusCode: 500,
                message: "Database schema error",
            };
        }
        // Generic MongoDB server errors (500 - Internal Server Error)
        if (errorName === "MongoServerError" || errorName === "MongoError") {
            return {
                category: "SERVER_ERROR",
                statusCode: 500,
                message: "Database server error",
            };
        }
        // Unknown MongoDB error (500 - Internal Server Error)
        return {
            category: "UNKNOWN_MONGO_ERROR",
            statusCode: 500,
            message: "An unexpected database error occurred",
        };
    }
    /**
     * Create a standardized operation ID for tracking
     */
    static generateOperationId(prefix = "mongo") {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    /**
     * Handle async MongoDB operations with automatic error handling
     * @param operation - Async operation to execute
     * @param res - Express response object
     * @param options - Error handling options
     * @returns Promise that resolves to operation result or null if error occurred
     */
    static executeWithErrorHandling(operation_1, res_1) {
        return __awaiter(this, arguments, void 0, function* (operation, res, options = {}) {
            try {
                return yield operation();
            }
            catch (error) {
                const result = this.handleMongoError(error, res, options);
                if (result.handled) {
                    return null;
                }
                // Re-throw if not a MongoDB error
                throw error;
            }
        });
    }
}
exports.MongoErrorHandler = MongoErrorHandler;
/**
 * Convenience function for quick MongoDB error handling
 * @param error - Error to handle
 * @param res - Express response object
 * @param operationId - Optional operation identifier
 * @returns boolean indicating if error was handled
 */
function handleMongoError(error, res, operationId) {
    const result = MongoErrorHandler.handleMongoError(error, res, {
        operationId,
    });
    return result.handled;
}
/**
 * Quick helper for generating operation IDs
 * @param prefix - Prefix for the operation ID
 * @returns Generated operation ID
 */
function generateOperationId(prefix = "op") {
    return MongoErrorHandler.generateOperationId(prefix);
}
/**
 * Enhanced error handler with custom logging
 * @param error - Error to handle
 * @param res - Express response object
 * @param operation - Operation description
 * @param customMessage - Custom user message
 * @returns boolean indicating if error was handled
 */
function handleDatabaseError(error, res, operation, customMessage) {
    const operationId = generateOperationId(operation);
    console.error(`[${operationId}] Database error in ${operation}:`, error);
    const result = MongoErrorHandler.handleMongoError(error, res, {
        operationId,
        customMessage: customMessage || `Failed to complete ${operation}`,
        includeErrorDetails: process.env.NODE_ENV === "DEV",
    });
    return result.handled;
}
exports.default = MongoErrorHandler;
