"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptUrlParam = exports.encryptUrlParam = exports.decryptUrlParams = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const User_middleware_1 = __importDefault(require("../middleware/User.middleware"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
const encryptRoute = (0, express_1.Router)();
// Log key initialization (remove in production)
console.log("✅ RSA keys loaded from .env successfully");
// RSA Encryption function (for backend testing)
const encryptWithPublicKey = (data) => {
    try {
        const buffer = Buffer.from(data, "utf8");
        const encrypted = crypto_1.default.publicEncrypt({
            key: process.env.RSA_PUBLIC_KEY,
            padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        }, buffer);
        return encrypted
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }
    catch (error) {
        console.error("RSA encryption error:", error);
        throw new Error("Encryption failed");
    }
};
// RSA Decryption function
const decryptWithPrivateKey = (encryptedData) => {
    try {
        // Restore base64 padding and characters
        const restored = encryptedData.replace(/-/g, "+").replace(/_/g, "/");
        const paddingNeeded = 4 - (restored.length % 4);
        const paddedValue = paddingNeeded !== 4 ? restored + "=".repeat(paddingNeeded) : restored;
        const buffer = Buffer.from(paddedValue, "base64");
        const decrypted = crypto_1.default.privateDecrypt({
            key: process.env.RSA_PRIVATE_KEY,
            padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        }, buffer);
        return decrypted.toString("utf8");
    }
    catch (error) {
        console.error("RSA decryption error:", error);
        throw new Error("Decryption failed");
    }
};
// Hybrid encryption for large data (RSA + AES)
const hybridEncrypt = (data) => {
    try {
        // Generate random AES key and IV
        const aesKey = crypto_1.default.randomBytes(32);
        const iv = crypto_1.default.randomBytes(16);
        // Encrypt data with AES
        const cipher = crypto_1.default.createCipheriv("aes-256-cbc", aesKey, iv);
        let encrypted = cipher.update(data, "utf8", "hex");
        encrypted += cipher.final("hex");
        // Encrypt AES key with RSA
        const encryptedKey = crypto_1.default.publicEncrypt({
            key: process.env.RSA_PUBLIC_KEY,
            padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        }, aesKey);
        // Combine encrypted key + iv + encrypted data
        const combined = encryptedKey.toString("base64") +
            ":" +
            iv.toString("hex") +
            ":" +
            encrypted;
        return Buffer.from(combined)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }
    catch (error) {
        console.error("Hybrid encryption error:", error);
        throw new Error("Hybrid encryption failed");
    }
};
// Hybrid decryption for large data
const hybridDecrypt = (encryptedData) => {
    try {
        // Restore base64
        const restored = encryptedData.replace(/-/g, "+").replace(/_/g, "/");
        const paddingNeeded = 4 - (restored.length % 4);
        const paddedValue = paddingNeeded !== 4 ? restored + "=".repeat(paddingNeeded) : restored;
        const combined = Buffer.from(paddedValue, "base64").toString("utf8");
        const [encryptedKey, ivHex, encryptedContent] = combined.split(":");
        // Decrypt AES key with RSA
        const aesKey = crypto_1.default.privateDecrypt({
            key: process.env.RSA_PRIVATE_KEY,
            padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        }, Buffer.from(encryptedKey, "base64"));
        // Decrypt content with AES
        const iv = Buffer.from(ivHex, "hex");
        const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", aesKey, iv);
        let decrypted = decipher.update(encryptedContent, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }
    catch (error) {
        console.error("Hybrid decryption error:", error);
        throw new Error("Hybrid decryption failed");
    }
};
// Choose encryption method based on data size
const encryptUrlParam = (value) => {
    // RSA can encrypt max ~245 bytes with OAEP padding for 2048-bit keys
    // Use direct RSA for small data, hybrid for larger data
    if (value.length <= 200) {
        return encryptWithPublicKey(value);
    }
    else {
        return hybridEncrypt(value);
    }
};
exports.encryptUrlParam = encryptUrlParam;
// Choose decryption method (try both)
const decryptUrlParam = (encryptedValue) => {
    try {
        // Try direct RSA decryption first
        return decryptWithPrivateKey(encryptedValue);
    }
    catch (error) {
        // If that fails, try hybrid decryption
        try {
            return hybridDecrypt(encryptedValue);
        }
        catch (hybridError) {
            console.error("Both decryption methods failed:", error, hybridError);
            throw new Error("Decryption failed with all methods");
        }
    }
};
exports.decryptUrlParam = decryptUrlParam;
// GET /public-key - Serve the public key for frontend encryption
encryptRoute.get("/public-key", User_middleware_1.default.VerifyToken, (req, res) => {
    try {
        res.status(200).json({
            success: true,
            publicKey: process.env.RSA_PUBLIC_KEY,
            keyFormat: "pem",
            algorithm: "RSA-OAEP-256",
            message: "Public key retrieved successfully",
        });
    }
    catch (error) {
        console.error("Public key retrieval error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve public key",
            error: "PUBLIC_KEY_ERROR",
        });
    }
});
// POST /encrypt - Encrypt a value
encryptRoute.post("/encrypt", (req, res) => {
    try {
        const { value } = req.body;
        if (!value) {
            res.status(400).json({
                success: false,
                message: "Value is required",
                error: "MISSING_VALUE",
            });
            return;
        }
        const encrypted = encryptUrlParam(value.toString());
        res.status(200).json({
            success: true,
            data: {
                original: value,
                encrypted: encrypted,
            },
            message: "Value encrypted successfully",
        });
    }
    catch (error) {
        console.error("Encryption error:", error);
        res.status(500).json({
            success: false,
            message: "Encryption failed",
            error: "ENCRYPTION_ERROR",
        });
    }
});
// GET /de/:encryptedPath - Decrypt and redirect route
encryptRoute.get("/de/:encryptedPath", (req, res) => {
    try {
        const { encryptedPath } = req.params;
        if (!encryptedPath) {
            res.status(400).json({
                success: false,
                message: "Encrypted path is required",
                error: "MISSING_ENCRYPTED_PATH",
            });
            return;
        }
        // Decrypt the path
        const decryptedPath = decryptUrlParam(encryptedPath);
        // Validate that the decrypted path starts with / or is a valid path
        if (!decryptedPath.startsWith("/")) {
            res.status(400).json({
                success: false,
                message: "Invalid decrypted path format",
                error: "INVALID_PATH_FORMAT",
            });
            return;
        }
        // Parse the decrypted path to handle query parameters
        let targetPath = decryptedPath;
        let queryString = "";
        if (decryptedPath.includes("?")) {
            const [path, query] = decryptedPath.split("?");
            targetPath = path;
            queryString = query;
        }
        // Construct the full redirect URL
        let redirectUrl = `/api${targetPath}`;
        if (queryString) {
            redirectUrl += `?${queryString}`;
        }
        // Instant redirect to the decrypted path
        res.redirect(302, redirectUrl);
    }
    catch (error) {
        console.error("Redirect decryption error:", error);
        res.status(400).json({
            success: false,
            message: "Failed to decrypt redirect path",
            error: "DECRYPT_REDIRECT_ERROR",
        });
    }
});
// POST /encrypt-path - Encrypt a full path for redirect purposes
encryptRoute.post("/encrypt-path", (req, res) => {
    try {
        const { path } = req.body;
        if (!path) {
            res.status(400).json({
                success: false,
                message: "Path is required",
                error: "MISSING_PATH",
            });
            return;
        }
        // Validate path format
        if (!path.startsWith("/")) {
            res.status(400).json({
                success: false,
                message: "Path must start with /",
                error: "INVALID_PATH_FORMAT",
            });
            return;
        }
        const encryptedPath = encryptUrlParam(path.toString());
        const redirectUrl = `/api/encrypt/de/${encryptedPath}`;
        res.status(200).json({
            success: true,
            data: {
                originalPath: path,
                encryptedPath: encryptedPath,
                redirectUrl: redirectUrl,
            },
            message: "Path encrypted successfully",
        });
    }
    catch (error) {
        console.error("Path encryption error:", error);
        res.status(500).json({
            success: false,
            message: "Path encryption failed",
            error: "PATH_ENCRYPTION_ERROR",
        });
    }
});
// Middleware function to decrypt URL parameters
const decryptUrlParams = (paramNames) => {
    return (req, res, next) => {
        try {
            paramNames.forEach((paramName) => {
                if (req.params[paramName]) {
                    const decrypted = decryptUrlParam(req.params[paramName]);
                    req.params[paramName] = decrypted;
                }
            });
            next();
        }
        catch (error) {
            console.error("URL parameter decryption error:", error);
            return res.status(400).json({
                success: false,
                message: "Invalid URL parameters",
                error: "INVALID_ENCRYPTED_PARAMS",
            });
        }
    };
};
exports.decryptUrlParams = decryptUrlParams;
exports.default = encryptRoute;
