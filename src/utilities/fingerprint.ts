import crypto from "crypto";
import { Request } from "express";

export interface BrowserFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  screen?: string;
  timezone?: string;
  platform?: string;
}

export class FingerprintService {
  static generateFingerprint(data: BrowserFingerprint): string {
    const fingerprint = [
      data.userAgent || "",
      data.acceptLanguage || "",
      data.acceptEncoding || "",
      data.screen || "",
      data.timezone || "",
      data.platform || "",
    ].join("|");

    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  static extractFingerprintFromRequest(req: Request): BrowserFingerprint {
    const getHeaderValue = (header: string | string[] | undefined): string => {
      if (Array.isArray(header)) {
        return header.join(", ");
      }
      return header || "";
    };

    return {
      userAgent: getHeaderValue(req.headers["user-agent"]),
      acceptLanguage: getHeaderValue(req.headers["accept-language"]),
      acceptEncoding: getHeaderValue(req.headers["accept-encoding"]),
      screen: getHeaderValue(req.headers["x-screen-resolution"]),
      timezone: getHeaderValue(req.headers["x-timezone"]),
      platform: getHeaderValue(req.headers["x-platform"]),
    };
  }

  static getClientIP(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"] as string;
    const realIP = req.headers["x-real-ip"] as string;

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    return (
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req as any).ip ||
      "unknown"
    );
  }

  static generateTrackingData(req: Request): {
    fingerprint: string;
    ip: string;
    deviceInfo: BrowserFingerprint;
    sessionId?: string;
  } {
    const clientIP = this.getClientIP(req);
    const browserFingerprint = this.extractFingerprintFromRequest(req);
    const fingerprintHash = this.generateFingerprint(browserFingerprint);

    return {
      fingerprint: fingerprintHash,
      ip: clientIP,
      deviceInfo: browserFingerprint,
      sessionId: (req as any).session?.id || (req as any).sessionID,
    };
  }

  static validateFingerprint(fingerprint: BrowserFingerprint): boolean {
    // Basic validation - ensure we have some identifying information
    const hasUserAgent =
      fingerprint.userAgent && fingerprint.userAgent.length > 10;
    const hasLanguage =
      fingerprint.acceptLanguage && fingerprint.acceptLanguage.length > 0;
    const hasEncoding =
      fingerprint.acceptEncoding && fingerprint.acceptEncoding.length > 0;

    return Boolean(hasUserAgent && (hasLanguage || hasEncoding));
  }

  static getFingerprintStrength(fingerprint: BrowserFingerprint): number {
    let score = 0;

    // User agent contributes 30 points
    if (fingerprint.userAgent && fingerprint.userAgent.length > 10) {
      score += 30;
    }

    // Language contributes 15 points
    if (fingerprint.acceptLanguage && fingerprint.acceptLanguage.length > 0) {
      score += 15;
    }

    // Encoding contributes 10 points
    if (fingerprint.acceptEncoding && fingerprint.acceptEncoding.length > 0) {
      score += 10;
    }

    // Screen resolution contributes 20 points
    if (fingerprint.screen && fingerprint.screen.includes("x")) {
      score += 20;
    }

    // Timezone contributes 15 points
    if (fingerprint.timezone && fingerprint.timezone.length > 0) {
      score += 15;
    }

    // Platform contributes 10 points
    if (fingerprint.platform && fingerprint.platform.length > 0) {
      score += 10;
    }

    return Math.min(score, 100);
  }
}
