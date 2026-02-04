import { Request } from "express";
import { FingerprintService } from "../utilities/fingerprint";
import FormResponse, {
  FormResponseType,
  ResponseSetType,
} from "../model/Response.model";
import { hashedPassword } from "../utilities/helper";
import { Types } from "mongoose";
import { ProcessNormalFormSubmissionType } from "./ResponseProcessingService";
import { compare } from "bcrypt";

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
    respondentData: Partial<ProcessNormalFormSubmissionType>
  ): Promise<RespondentTrackingResult> {
    const {
      formId,
      respondentFingerprint,
      respondentIP,
      respondentEmail,
      fingerprintStrength,
    } = respondentData;

    // Build common base result to avoid repetition
    const baseResult = {
      fingerprint: respondentFingerprint,
      ipAddress: respondentIP,
      fingerprintStrength,
      respondentEmail,
    };

    // Attempt fingerprint lookup first (most reliable)
    if (respondentFingerprint) {
      const existingResponse = await FormResponse.findOne(
        { formId, respondentFingerprint },
        { _id: 1 }
      ).lean();

      if (existingResponse) {
        return {
          hasResponded: true,
          trackingMethod: "fingerprint",
          responseId: existingResponse._id.toString(),
          ...baseResult,
        };
      }
    }

    // Fallback to IP + email lookup (requires both for reliability)
    if (respondentIP && respondentEmail) {
      const existingResponse = await FormResponse.findOne(
        { formId, respondentIP, respondentEmail },
        { _id: 1 }
      ).lean();

      if (existingResponse) {
        return {
          hasResponded: true,
          trackingMethod: "ip",
          responseId: existingResponse._id.toString(),
          ...baseResult,
        };
      }
    }

    // No existing response found
    return {
      hasResponded: false,
      trackingMethod: "none",
      ...baseResult,
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

  static createSubmissionWithTracking(
    baseData: Partial<FormResponseType>,
    req: Request
  ): any {
    const trackingData = this.generateTrackingData(req);
    const hashedIP = hashedPassword(trackingData.ip);

    return {
      ...baseData,
      respondentFingerprint: trackingData.fingerprint,
      respondentIP: hashedIP,
      deviceInfo: trackingData.deviceInfo,
      respondentSessionId: trackingData.sessionId,
      fingerprintStrength: trackingData.fingerprintStrength,
    };
  }
}
