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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const Form_model_1 = __importDefault(require("../model/Form.model"));
class FormLinkService {
    constructor() {
        this.algorithm = "aes-256-gcm";
        this.baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const secret = process.env.INVITE_LINK_SECRET || "default-invite-secret-key";
        this.encryptionKey = crypto_1.default.scryptSync(secret, "salt", 32);
    }
    // Encrypt data using AES-256-GCM
    encrypt(data) {
        const iv = crypto_1.default.randomBytes(12); // GCM recommends 12 bytes IV
        const cipher = crypto_1.default.createCipheriv(this.algorithm, this.encryptionKey, iv);
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
    decrypt(encryptedData) {
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
            const decipher = crypto_1.default.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
        catch (error) {
            console.error("Decryption error:", error);
            throw new Error("Failed to decrypt invite code");
        }
    }
    // Generate an invite code
    generateInviteCode() {
        return crypto_1.default.randomBytes(8).readBigUInt64BE().toString();
    }
    // Generate invite link with encrypted invite code
    generateInviteLink(data, path = "/", expiresInHours) {
        const payload = Object.assign({}, data);
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
    validateInviteLink(encryptedCode) {
        try {
            const decrypted = this.decrypt(encryptedCode);
            const data = JSON.parse(decrypted);
            // Check expiration
            if (data.expiresAt && Date.now() > data.expiresAt) {
                return { valid: false, error: "Invite link has expired" };
            }
            return { valid: true, data };
        }
        catch (error) {
            console.error("Invite link validation error:", error);
            return { valid: false, error: "Invalid invite link" };
        }
    }
    // Generate a secure access token for the form
    generateAccessToken() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    // Generate a basic form link
    generateFormLink(formId) {
        const url = `${this.baseUrl}/form-access/${formId}`;
        return {
            url,
            isSecure: false,
        };
    }
    // Generate a secure form link with access token
    generateSecureFormLink(formId, expiresInHours = 24) {
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
    validateAccessToken(formId, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return !!(token && token.length === 64); // Simple validation
            }
            catch (error) {
                console.error("Error validating access token:", error);
                return false;
            }
        });
    }
    // Generate multiple links for batch sending
    generateBatchLinks(formId, count, secure = false) {
        const links = [];
        for (let i = 0; i < count; i++) {
            if (secure) {
                links.push(this.generateSecureFormLink(formId));
            }
            else {
                links.push(this.generateFormLink(formId));
            }
        }
        return links;
    }
    getValidatedFormLink(formId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const form = yield Form_model_1.default.findById(formId);
                const isFormActive = (_a = form === null || form === void 0 ? void 0 : form.setting) === null || _a === void 0 ? void 0 : _a.acceptResponses;
                if (!form || !isFormActive) {
                    throw new Error("Form is close");
                }
                return this.generateFormLink(formId);
            }
            catch (error) {
                console.error("Error generating validated form link:", error);
                return null;
            }
        });
    }
    // Extract form ID from a form URL
    extractFormIdFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/");
            const formIndex = pathParts.indexOf("form-access");
            if (formIndex !== -1 && pathParts[formIndex + 1]) {
                return pathParts[formIndex + 1];
            }
            return null;
        }
        catch (error) {
            console.error("Error extracting form ID from URL:", error);
            return null;
        }
    }
}
exports.default = FormLinkService;
