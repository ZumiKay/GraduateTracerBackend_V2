import { Request } from "express";
import { FingerprintService } from "../utilities/fingerprint";
import FormResponse from "../model/Response.model";

export interface RespondentTrackingResult {
  hasResponded: boolean;
  trackingMethod: "fingerprint" | "ip" | "none";
  responseId?: string;
  fingerprint?: string;
  ipAddress?: string;
  fingerprintStrength?: number;
  respondentEmail?: string;
}

export interface TrackingData {
  fingerprint: string;
  ip: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    screen: string;
    timezone: string;
    acceptLanguage: string;
    acceptEncoding: string;
  };
  sessionId?: string;
  fingerprintStrength: number;
}

export class RespondentTrackingService {
  static async checkRespondentExists(
    formId: string,
    req: Request,
    respondentEmail?: string
  ): Promise<RespondentTrackingResult> {
    const trackingData = this.generateTrackingData(req);

    // Check by fingerprint first (most reliable for unique identification)

    const existingResponseByFingerprint = await FormResponse.findOne({
      formId,
      respondentFingerprint: trackingData.fingerprint,
    }).lean();

    if (existingResponseByFingerprint) {
      return {
        hasResponded: true,
        trackingMethod: "fingerprint",
        responseId: existingResponseByFingerprint._id.toString(),
        fingerprint: trackingData.fingerprint,
        ipAddress: trackingData.ip,
        fingerprintStrength: trackingData.fingerprintStrength,
        respondentEmail,
      };
    }

    // Fallback to IP address (less reliable but better than nothing)

    const existingResponseByIP = await FormResponse.findOne({
      formId,
      respondentIP: trackingData.ip,
      respondentEmail,
    }).lean();

    if (existingResponseByIP) {
      return {
        hasResponded: true,
        trackingMethod: "ip",
        responseId: existingResponseByIP._id.toString(),
        fingerprint: trackingData.fingerprint,
        ipAddress: trackingData.ip,
        fingerprintStrength: trackingData.fingerprintStrength,
        respondentEmail,
      };
    }

    return {
      hasResponded: false,
      trackingMethod: "none",
      fingerprint: trackingData.fingerprint,
      ipAddress: trackingData.ip,
      fingerprintStrength: trackingData.fingerprintStrength,
    };
  }

  static generateTrackingData(req: Request): TrackingData {
    const clientIP = FingerprintService.getClientIP(req);
    const browserFingerprint =
      FingerprintService.extractFingerprintFromRequest(req);
    const fingerprintHash =
      FingerprintService.generateFingerprint(browserFingerprint);
    const fingerprintStrength =
      FingerprintService.getFingerprintStrength(browserFingerprint);

    return {
      fingerprint: fingerprintHash,
      ip: clientIP,
      deviceInfo: {
        userAgent: browserFingerprint.userAgent,
        platform: browserFingerprint.platform || "",
        screen: browserFingerprint.screen || "",
        timezone: browserFingerprint.timezone || "",
        acceptLanguage: browserFingerprint.acceptLanguage,
        acceptEncoding: browserFingerprint.acceptEncoding,
      },
      sessionId: (req as any).session?.id || (req as any).sessionID,
      fingerprintStrength,
    };
  }

  static isTrackingReliable(trackingData: TrackingData): boolean {
    // Consider tracking reliable if fingerprint strength is above 60
    // and we have at least an IP address
    return (
      trackingData.fingerprintStrength >= 60 &&
      trackingData.ip !== "unknown" &&
      trackingData.ip.length > 0
    );
  }

  static getTrackingDescription(result: RespondentTrackingResult): string {
    switch (result.trackingMethod) {
      case "fingerprint":
        return `Response detected using browser fingerprint (strength: ${result.fingerprintStrength}%)`;
      case "ip":
        return `Response detected using IP address: ${result.ipAddress}`;
      case "none":
        return "No previous response detected";
      default:
        return "Unknown tracking method";
    }
  }

  static createSubmissionWithTracking(baseData: any, req: Request): any {
    const trackingData = this.generateTrackingData(req);

    return {
      ...baseData,
      respondentFingerprint: trackingData.fingerprint,
      respondentIP: trackingData.ip,
      deviceInfo: trackingData.deviceInfo,
      respondentSessionId: trackingData.sessionId,
      fingerprintStrength: trackingData.fingerprintStrength,
    };
  }
}
