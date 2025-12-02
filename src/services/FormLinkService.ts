import crypto from "crypto";
import Form from "../model/Form.model";

export interface FormLinkData {
  formId: string;
  accessToken?: string;
  expiresAt?: Date;
  isSecure?: boolean;
}

export interface InviteLinkData {
  inviteCode: string;
  formId?: string;
  expiresAt?: number; // Unix timestamp
  [key: string]: unknown;
}

export interface GeneratedLink {
  url: string;
  accessToken?: string;
  expiresAt?: Date;
  isSecure: boolean;
}

export interface InviteLink {
  url: string;
  encryptedCode: string;
  inviteCode: string;
  expiresAt?: Date;
}

class FormLinkService {
  private baseUrl: string;
  private encryptionKey: Buffer;
  private algorithm = "aes-256-gcm" as const;

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const secret =
      process.env.INVITE_LINK_SECRET || "default-invite-secret-key";
    this.encryptionKey = crypto.scryptSync(secret, "salt", 32);
  }

  // Encrypt data using AES-256-GCM
  private encrypt(data: string): string {
    const iv = crypto.randomBytes(12); // GCM recommends 12 bytes IV
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + encrypted data, then base64url encode
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, "hex"),
    ]);

    return combined
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  // Decrypt data using AES-256-GCM
  decrypt(encryptedData: string): string {
    try {
      // Restore base64 from base64url
      let restored = encryptedData.replace(/-/g, "+").replace(/_/g, "/");
      const paddingNeeded = 4 - (restored.length % 4);
      if (paddingNeeded !== 4) {
        restored += "=".repeat(paddingNeeded);
      }

      const combined = Buffer.from(restored, "base64");

      // Extract iv (12 bytes), authTag (16 bytes), and encrypted data
      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const encrypted = combined.subarray(28);

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt invite code");
    }
  }

  // Generate an invite code
  generateInviteCode(): string {
    return crypto.randomBytes(8).readBigUInt64BE().toString();
  }

  // Generate invite link with encrypted invite code
  generateInviteLink(
    data: InviteLinkData,
    path: string = "/",
    expiresInHours?: number
  ): InviteLink {
    const payload: InviteLinkData = { ...data };

    if (expiresInHours) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      payload.expiresAt = expiresAt.getTime();
    }

    const jsonPayload = JSON.stringify(payload);
    const encryptedCode = this.encrypt(jsonPayload);

    const url = `${this.baseUrl}${path}?invite=${encryptedCode}`;

    return {
      url,
      encryptedCode,
      inviteCode: data.inviteCode,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
    };
  }

  // Validate and decode invite link
  validateInviteLink(encryptedCode: string): {
    valid: boolean;
    data?: InviteLinkData;
    error?: string;
  } {
    try {
      const decrypted = this.decrypt(encryptedCode);
      const data = JSON.parse(decrypted) as InviteLinkData;

      // Check expiration
      if (data.expiresAt && Date.now() > data.expiresAt) {
        return { valid: false, error: "Invite link has expired" };
      }

      return { valid: true, data };
    } catch (error) {
      console.error("Invite link validation error:", error);
      return { valid: false, error: "Invalid invite link" };
    }
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
