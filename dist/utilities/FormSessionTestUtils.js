"use strict";
/**
 * Test Utilities for Form Session Token Renewal
 * ==============================================
 *
 * Helper functions for testing the enhanced VerifyFormSession middleware
 */
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
exports.exampleTests = exports.FormSessionTestUtils = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helper_1 = require("../utilities/helper");
const Formsession_model_1 = __importDefault(require("../model/Formsession.model"));
class FormSessionTestUtils {
    /**
     * Create a test form session with specific token and database expiration times
     */
    static createTestSession(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, formId, tokenExpiresInMinutes = 60, // Default: 1 hour
            dbExpiresInHours = 24, // Default: 24 hours
            isGuest = false, } = options;
            if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
                throw new Error("RESPONDENT_TOKEN_JWT_SECRET not configured");
            }
            // Create JWT token with specific expiration
            const tokenPayload = {
                email,
                timestamp: Date.now(),
                random: Math.random(),
            };
            const sessionId = (0, helper_1.GenerateToken)(tokenPayload, `${tokenExpiresInMinutes}m`, process.env.RESPONDENT_TOKEN_JWT_SECRET);
            // Create database session with different expiration
            const dbExpiredAt = new Date();
            dbExpiredAt.setHours(dbExpiredAt.getHours() + dbExpiresInHours);
            const formsession = yield Formsession_model_1.default.create({
                form: formId,
                session_id: sessionId,
                expiredAt: dbExpiredAt,
                respondentEmail: email,
                isGuest,
            });
            return {
                sessionId,
                formsession,
                tokenExpiry: new Date(Date.now() + tokenExpiresInMinutes * 60 * 1000),
                dbExpiry: dbExpiredAt,
            };
        });
    }
    /**
     * Create an expired JWT token for testing
     */
    static createExpiredToken(email) {
        if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
            throw new Error("RESPONDENT_TOKEN_JWT_SECRET not configured");
        }
        const tokenPayload = {
            email,
            timestamp: Date.now(),
            random: Math.random(),
            exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
        };
        return jsonwebtoken_1.default.sign(tokenPayload, process.env.RESPONDENT_TOKEN_JWT_SECRET, {
            algorithm: "HS256",
        });
    }
    /**
     * Create a token that expires within the 5-minute buffer
     */
    static createNearExpirySession(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createTestSession(Object.assign(Object.assign({}, options), { tokenExpiresInMinutes: 3, dbExpiresInHours: 24 }));
        });
    }
    /**
     * Check if a JWT token is expired
     */
    static isTokenExpired(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp)
                return true;
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp < now;
        }
        catch (_a) {
            return true;
        }
    }
    /**
     * Check if a token expires within the given minutes
     */
    static isTokenNearExpiry(token, bufferMinutes = 5) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp)
                return true;
            const now = Math.floor(Date.now() / 1000);
            const bufferSeconds = bufferMinutes * 60;
            return decoded.exp < now + bufferSeconds;
        }
        catch (_a) {
            return true;
        }
    }
    /**
     * Clean up test sessions
     */
    static cleanupTestSessions(email) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Formsession_model_1.default.deleteMany({ respondentEmail: email });
        });
    }
    /**
     * Verify that a session was renewed by checking if session_id changed
     */
    static verifySessionRenewed(originalSessionId, email) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield Formsession_model_1.default.findOne({ respondentEmail: email });
            return session ? session.session_id !== originalSessionId : false;
        });
    }
    /**
     * Get the current session_id for an email
     */
    static getCurrentSessionId(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield Formsession_model_1.default.findOne({ respondentEmail: email });
            return (session === null || session === void 0 ? void 0 : session.session_id) || null;
        });
    }
}
exports.FormSessionTestUtils = FormSessionTestUtils;
/**
 * Example Test Cases
 * ==================
 */
exports.exampleTests = {
    // Test token renewal workflow
    testTokenRenewal: () => __awaiter(void 0, void 0, void 0, function* () {
        const email = "test@example.com";
        const formId = "64f123456789012345678901"; // Example ObjectId
        try {
            // 1. Create session with token expiring soon
            const session = yield FormSessionTestUtils.createNearExpirySession({
                email,
                formId,
            });
            console.log("Created test session:", {
                sessionId: session.sessionId,
                tokenExpiry: session.tokenExpiry,
                dbExpiry: session.dbExpiry,
                isNearExpiry: FormSessionTestUtils.isTokenNearExpiry(session.sessionId),
            });
            // 2. Simulate middleware processing
            // (You would make an actual HTTP request here in real tests)
            // 3. Verify renewal occurred
            const renewed = yield FormSessionTestUtils.verifySessionRenewed(session.sessionId, email);
            console.log("Session renewed:", renewed);
            // 4. Cleanup
            yield FormSessionTestUtils.cleanupTestSessions(email);
        }
        catch (error) {
            console.error("Test failed:", error);
            yield FormSessionTestUtils.cleanupTestSessions(email);
        }
    }),
    // Test expired session cleanup
    testExpiredSessionCleanup: () => __awaiter(void 0, void 0, void 0, function* () {
        const email = "expired@example.com";
        const formId = "64f123456789012345678901";
        try {
            // Create session with both token and DB expired
            const session = yield FormSessionTestUtils.createTestSession({
                email,
                formId,
                tokenExpiresInMinutes: -60, // Expired 1 hour ago
                dbExpiresInHours: -1, // DB also expired 1 hour ago
            });
            console.log("Created expired session");
            // After middleware processes this, session should be deleted
            // (You would make HTTP request here and verify 401 response)
            // Verify session was cleaned up
            const currentSession = yield FormSessionTestUtils.getCurrentSessionId(email);
            console.log("Session after cleanup:", currentSession); // Should be null
        }
        catch (error) {
            console.error("Test failed:", error);
        }
    }),
};
exports.default = FormSessionTestUtils;
