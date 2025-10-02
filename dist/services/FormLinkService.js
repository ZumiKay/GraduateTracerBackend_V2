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
    getValidatedFormLink(formId_1) {
        return __awaiter(this, arguments, void 0, function* (formId, secure = false) {
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
