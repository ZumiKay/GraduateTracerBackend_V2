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
        this.baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
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
                // This would typically be stored in a separate collection or cache
                // For now, we'll implement a simple token validation
                // You might want to store these tokens in Redis or a separate collection
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
    // Get form link with form validation
    getValidatedFormLink(formId_1) {
        return __awaiter(this, arguments, void 0, function* (formId, secure = false) {
            try {
                // Validate that the form exists and is accessible
                const form = yield Form_model_1.default.findById(formId);
                if (!form) {
                    return null;
                }
                // Check if form is active (you might want to add an 'active' field to FormType)
                // For now, we'll assume all forms are active
                if (secure) {
                    return this.generateSecureFormLink(formId);
                }
                else {
                    return this.generateFormLink(formId);
                }
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
