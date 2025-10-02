/**
 * Test Utilities for Form Session Token Renewal
 * ==============================================
 *
 * Helper functions for testing the enhanced VerifyFormSession middleware
 */

import JWT from "jsonwebtoken";
import { GenerateToken } from "../utilities/helper";
import Formsession from "../model/Formsession.model";

interface CreateTestSessionOptions {
  email: string;
  formId: string;
  tokenExpiresInMinutes?: number;
  dbExpiresInHours?: number;
  isGuest?: boolean;
}

export class FormSessionTestUtils {
  /**
   * Create a test form session with specific token and database expiration times
   */
  static async createTestSession(options: CreateTestSessionOptions) {
    const {
      email,
      formId,
      tokenExpiresInMinutes = 60, // Default: 1 hour
      dbExpiresInHours = 24, // Default: 24 hours
      isGuest = false,
    } = options;

    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET not configured");
    }

    // Create JWT token with specific expiration
    const tokenPayload = {
      email,
      timestamp: Date.now(),
      random: Math.random(),
    };

    const sessionId = GenerateToken(
      tokenPayload,
      `${tokenExpiresInMinutes}m`,
      process.env.RESPONDENT_TOKEN_JWT_SECRET
    );

    // Create database session with different expiration
    const dbExpiredAt = new Date();
    dbExpiredAt.setHours(dbExpiredAt.getHours() + dbExpiresInHours);

    const formsession = await Formsession.create({
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
  }

  /**
   * Create an expired JWT token for testing
   */
  static createExpiredToken(email: string): string {
    if (!process.env.RESPONDENT_TOKEN_JWT_SECRET) {
      throw new Error("RESPONDENT_TOKEN_JWT_SECRET not configured");
    }

    const tokenPayload = {
      email,
      timestamp: Date.now(),
      random: Math.random(),
      exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
    };

    return JWT.sign(tokenPayload, process.env.RESPONDENT_TOKEN_JWT_SECRET, {
      algorithm: "HS256",
    });
  }

  /**
   * Create a token that expires within the 5-minute buffer
   */
  static async createNearExpirySession(
    options: Omit<CreateTestSessionOptions, "tokenExpiresInMinutes">
  ) {
    return this.createTestSession({
      ...options,
      tokenExpiresInMinutes: 3, // Expires in 3 minutes (within 5-minute buffer)
      dbExpiresInHours: 24, // DB session valid for 24 hours
    });
  }

  /**
   * Check if a JWT token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = JWT.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Check if a token expires within the given minutes
   */
  static isTokenNearExpiry(token: string, bufferMinutes: number = 5): boolean {
    try {
      const decoded = JWT.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      const bufferSeconds = bufferMinutes * 60;

      return decoded.exp < now + bufferSeconds;
    } catch {
      return true;
    }
  }

  /**
   * Clean up test sessions
   */
  static async cleanupTestSessions(email: string) {
    await Formsession.deleteMany({ respondentEmail: email });
  }

  /**
   * Verify that a session was renewed by checking if session_id changed
   */
  static async verifySessionRenewed(
    originalSessionId: string,
    email: string
  ): Promise<boolean> {
    const session = await Formsession.findOne({ respondentEmail: email });
    return session ? session.session_id !== originalSessionId : false;
  }

  /**
   * Get the current session_id for an email
   */
  static async getCurrentSessionId(email: string): Promise<string | null> {
    const session = await Formsession.findOne({ respondentEmail: email });
    return session?.session_id || null;
  }
}

/**
 * Example Test Cases
 * ==================
 */

export const exampleTests = {
  // Test token renewal workflow
  testTokenRenewal: async () => {
    const email = "test@example.com";
    const formId = "64f123456789012345678901"; // Example ObjectId

    try {
      // 1. Create session with token expiring soon
      const session = await FormSessionTestUtils.createNearExpirySession({
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
      const renewed = await FormSessionTestUtils.verifySessionRenewed(
        session.sessionId,
        email
      );

      console.log("Session renewed:", renewed);

      // 4. Cleanup
      await FormSessionTestUtils.cleanupTestSessions(email);
    } catch (error) {
      console.error("Test failed:", error);
      await FormSessionTestUtils.cleanupTestSessions(email);
    }
  },

  // Test expired session cleanup
  testExpiredSessionCleanup: async () => {
    const email = "expired@example.com";
    const formId = "64f123456789012345678901";

    try {
      // Create session with both token and DB expired
      const session = await FormSessionTestUtils.createTestSession({
        email,
        formId,
        tokenExpiresInMinutes: -60, // Expired 1 hour ago
        dbExpiresInHours: -1, // DB also expired 1 hour ago
      });

      console.log("Created expired session");

      // After middleware processes this, session should be deleted
      // (You would make HTTP request here and verify 401 response)

      // Verify session was cleaned up
      const currentSession = await FormSessionTestUtils.getCurrentSessionId(
        email
      );
      console.log("Session after cleanup:", currentSession); // Should be null
    } catch (error) {
      console.error("Test failed:", error);
    }
  },
};

export default FormSessionTestUtils;
