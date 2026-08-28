"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESPONSES = void 0;
//Error formatted for middleware
exports.RESPONSES = {
    missingCookieConfig: () => ({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_COOKIE_CONFIG",
    }),
    invalidFormId: () => ({
        success: false,
        status: 400,
        message: "Invalid or missing form ID",
        error: "INVALID_FORM_ID",
    }),
    formClosed: () => ({
        success: false,
        status: 403,
        message: "Form is closed",
        error: "FORM_CLOSED",
    }),
    missingSessionToken: () => ({
        success: false,
        status: 401,
        message: "Session token required",
        error: "MISSING_SESSION_TOKEN",
    }),
    invalidSessionToken: () => ({
        success: false,
        status: 401,
        message: "Invalid session token",
        error: "INVALID_SESSION_TOKEN",
    }),
    sessionNotFound: () => ({
        success: false,
        status: 401,
        message: "Session not found",
        error: "SESSION_NOT_FOUND",
    }),
    sessionExpired: () => ({
        success: false,
        status: 401,
        message: "Session expired",
        error: "SESSION_EXPIRED",
    }),
    invalidAccessToken: () => ({
        success: false,
        status: 401,
        message: "Invalid Session",
        error: "INVALID_ACCESS_TOKEN",
    }),
    tokenRenewalError: () => ({
        success: false,
        status: 500,
        message: "Token renewal failed",
        error: "TOKEN_RENEWAL_ERROR",
    }),
    internalServerError: () => ({
        success: false,
        status: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
    }),
    missingFormId: () => ({
        success: false,
        status: 400,
        message: "Form ID is missing",
        error: "MISSING_FORM_ID",
    }),
    invalidRequestType: () => ({
        success: false,
        status: 400,
        message: "Invalid request type",
        error: "INVALID_REQUEST_TYPE",
    }),
    missingRefreshTokenConfig: () => ({
        success: false,
        status: 500,
        message: "Server configuration error",
        error: "MISSING_REFRESH_TOKEN_CONFIG",
    }),
};
