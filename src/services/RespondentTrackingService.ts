import { Request } from "express";
import { FingerprintService } from "../utilities/fingerprint";
import FormResponse, { FormResponseType } from "../model/Response.model";
import { hashedPassword } from "../utilities/helper";
import { ProcessNormalFormSubmissionType } from "./ResponseProcessingService";

export interface RespondentTrackingResult {
  hasResponded?: {
    message: string;
    responseId: string;
    maxScore?: number;
    totalScore?: number;
  };
  trackingMethod: "fingerprint" | "ip" | "none";
  responseId?: string;
  fingerprint?: string;
  ipAddress?: string;
  fingerprintStrength?: number;
  respondentEmail?: string;
}

export interface DeviceInfoType {
  userAgent: string;
  platform: string;
  screen: string;
  timezone: string;
  acceptLanguage: string;
  acceptEncoding: string;
}

export interface TrackingData {
  fingerprint: string;
  ip: string;
  deviceInfo: DeviceInfoType;
  sessionId?: string;
  fingerprintStrength: number;
}

export class RespondentTrackingService {
  /**
   * Converts seconds to a human-readable duration string (e.g., "1d 2h 30mn")
   */
  static formatCompletionTime(seconds: number): string {
    if (seconds < 0) return "0mn";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}mn`);

    return parts.length > 0 ? parts.join(" ") : "0mn";
  }

  static async checkRespondentExists(
    respondentData: Partial<ProcessNormalFormSubmissionType>,
  ) {
    const { formId, respondentFingerprint, respondentIP, respondentEmail } =
      respondentData;

    const orConditions: Record<string, unknown>[] = [];

    if (respondentEmail)
      orConditions.push({
        respondentEmail,
      });
    if (respondentIP) orConditions.push({ respondentIP });

    if (respondentFingerprint) orConditions.push({ respondentFingerprint });

    if (orConditions.length === 0) return { hasResponded: undefined };

    const existingResponse = await FormResponse.findOne(
      { formId, $or: orConditions },
      { _id: 1, maxScore: 1, totalScore: 1 },
    ).lean();

    if (existingResponse) {
      return {
        hasResponded: {
          message: "You already submitted response",
          responseId: existingResponse._id.toString(),
          maxScore: existingResponse.maxScore,
          totalScore: existingResponse.totalScore,
        },
      };
    }

    return { hasResponded: undefined };
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
      fingerprintStrength,
    };
  }

  static isTrackingReliable(trackingData: TrackingData): boolean {
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
    req: Request,
  ): any {
    const trackingData = this.generateTrackingData(req);
    const hashedIP = hashedPassword(trackingData.ip);
    return {
      ...baseData,
      respondentFingerprint: trackingData.fingerprint,
      respondentIP: hashedIP,
      deviceInfo: trackingData.deviceInfo,
      fingerprintStrength: trackingData.fingerprintStrength,
    };
  }
}
