import { Types } from "mongoose";
import crypto from "crypto";
import Form from "../model/Form.model";

export interface FormLinkData {
  formId: string;
  accessToken?: string;
  expiresAt?: Date;
  isSecure?: boolean;
}

export interface GeneratedLink {
  url: string;
  accessToken?: string;
  expiresAt?: Date;
  isSecure: boolean;
}

class FormLinkService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  }

  // Generate a secure access token for the form
  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generate a basic form link
  generateFormLink(formId: string): GeneratedLink {
    const url = `${this.baseUrl}/form-access/${formId}`;
    return {
      url,
      isSecure: false,
    };
  }

  // Generate a secure form link with access token
  generateSecureFormLink(
    formId: string,
    expiresInHours: number = 24
  ): GeneratedLink {
    const accessToken = this.generateAccessToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const url = `${this.baseUrl}/form-access/${formId}/${accessToken}`;

    return {
      url,
      accessToken,
      expiresAt,
      isSecure: true,
    };
  }

  // Validate access token for secure forms
  async validateAccessToken(formId: string, token: string): Promise<boolean> {
    try {
      return !!(token && token.length === 64); // Simple validation
    } catch (error) {
      console.error("Error validating access token:", error);
      return false;
    }
  }

  // Generate multiple links for batch sending
  generateBatchLinks(
    formId: string,
    count: number,
    secure: boolean = false
  ): GeneratedLink[] {
    const links: GeneratedLink[] = [];

    for (let i = 0; i < count; i++) {
      if (secure) {
        links.push(this.generateSecureFormLink(formId));
      } else {
        links.push(this.generateFormLink(formId));
      }
    }

    return links;
  }

  async getValidatedFormLink(formId: string): Promise<GeneratedLink | null> {
    try {
      const form = await Form.findById(formId);
      const isFormActive = form?.setting?.acceptResponses;
      if (!form || !isFormActive) {
        throw new Error("Form is close");
      }
      return this.generateFormLink(formId);
    } catch (error) {
      console.error("Error generating validated form link:", error);
      return null;
    }
  }

  // Extract form ID from a form URL
  extractFormIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const formIndex = pathParts.indexOf("form-access");

      if (formIndex !== -1 && pathParts[formIndex + 1]) {
        return pathParts[formIndex + 1];
      }

      return null;
    } catch (error) {
      console.error("Error extracting form ID from URL:", error);
      return null;
    }
  }
}

export default FormLinkService;
