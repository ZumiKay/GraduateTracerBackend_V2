import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import crypto from "crypto";

const encryptRoute = Router();

// RSA Key Pair Generation and Management
const generateRSAKeyPair = () => {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
};

// Global key pair (in production, store these securely)
let keyPair: { publicKey: string; privateKey: string };

// Initialize or load RSA keys
const initializeKeys = () => {
  const publicKeyEnv = process.env.RSA_PUBLIC_KEY;
  const privateKeyEnv = process.env.RSA_PRIVATE_KEY;

  if (publicKeyEnv && privateKeyEnv) {
    // Use keys from environment variables
    keyPair = {
      publicKey: publicKeyEnv.replace(/\\n/g, "\n"),
      privateKey: privateKeyEnv.replace(/\\n/g, "\n"),
    };
    console.log("Using RSA keys from environment variables");
  } else {
    // Generate new keys (for development)
    keyPair = generateRSAKeyPair();
    console.log("Generated new RSA key pair for development");
    console.log("Public Key:", keyPair.publicKey);
    console.log("Private Key:", keyPair.privateKey);
  }
};

// Initialize keys on module load
initializeKeys();

// RSA Encryption function (for backend testing)
const encryptWithPublicKey = (data: string): string => {
  try {
    const buffer = Buffer.from(data, "utf8");
    const encrypted = crypto.publicEncrypt(
      {
        key: keyPair.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buffer
    );
    return encrypted
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  } catch (error) {
    console.error("RSA encryption error:", error);
    throw new Error("Encryption failed");
  }
};

// RSA Decryption function
const decryptWithPrivateKey = (encryptedData: string): string => {
  try {
    // Restore base64 padding and characters
    const restored = encryptedData.replace(/-/g, "+").replace(/_/g, "/");

    const paddingNeeded = 4 - (restored.length % 4);
    const paddedValue =
      paddingNeeded !== 4 ? restored + "=".repeat(paddingNeeded) : restored;

    const buffer = Buffer.from(paddedValue, "base64");
    const decrypted = crypto.privateDecrypt(
      {
        key: keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buffer
    );
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("RSA decryption error:", error);
    throw new Error("Decryption failed");
  }
};

// Hybrid encryption for large data (RSA + AES)
const hybridEncrypt = (data: string): string => {
  try {
    // Generate random AES key and IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Encrypt data with AES
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Encrypt AES key with RSA
    const encryptedKey = crypto.publicEncrypt(
      {
        key: keyPair.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey
    );

    // Combine encrypted key + iv + encrypted data
    const combined =
      encryptedKey.toString("base64") +
      ":" +
      iv.toString("hex") +
      ":" +
      encrypted;

    return Buffer.from(combined)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  } catch (error) {
    console.error("Hybrid encryption error:", error);
    throw new Error("Hybrid encryption failed");
  }
};

// Hybrid decryption for large data
const hybridDecrypt = (encryptedData: string): string => {
  try {
    // Restore base64
    const restored = encryptedData.replace(/-/g, "+").replace(/_/g, "/");

    const paddingNeeded = 4 - (restored.length % 4);
    const paddedValue =
      paddingNeeded !== 4 ? restored + "=".repeat(paddingNeeded) : restored;

    const combined = Buffer.from(paddedValue, "base64").toString("utf8");
    const [encryptedKey, ivHex, encryptedContent] = combined.split(":");

    // Decrypt AES key with RSA
    const aesKey = crypto.privateDecrypt(
      {
        key: keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedKey, "base64")
    );

    // Decrypt content with AES
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    let decrypted = decipher.update(encryptedContent, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Hybrid decryption error:", error);
    throw new Error("Hybrid decryption failed");
  }
};

// Choose encryption method based on data size
const encryptUrlParam = (value: string): string => {
  // RSA can encrypt max ~245 bytes with OAEP padding for 2048-bit keys
  // Use direct RSA for small data, hybrid for larger data
  if (value.length <= 200) {
    return encryptWithPublicKey(value);
  } else {
    return hybridEncrypt(value);
  }
};

// Choose decryption method (try both)
const decryptUrlParam = (encryptedValue: string): string => {
  try {
    // Try direct RSA decryption first
    return decryptWithPrivateKey(encryptedValue);
  } catch (error) {
    // If that fails, try hybrid decryption
    try {
      return hybridDecrypt(encryptedValue);
    } catch (hybridError) {
      console.error("Both decryption methods failed:", error, hybridError);
      throw new Error("Decryption failed with all methods");
    }
  }
};

// GET /public-key - Serve the public key for frontend encryption
encryptRoute.get("/public-key", (req: Request, res: Response): void => {
  try {
    res.status(200).json({
      success: true,
      data: {
        publicKey: keyPair.publicKey,
        keyFormat: "pem",
        algorithm: "RSA-OAEP-256",
      },
      message: "Public key retrieved successfully",
    });
  } catch (error) {
    console.error("Public key retrieval error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve public key",
      error: "PUBLIC_KEY_ERROR",
    });
  }
});

// POST /encrypt - Encrypt a value
encryptRoute.post("/encrypt", (req: Request, res: Response): void => {
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
  } catch (error) {
    console.error("Encryption error:", error);
    res.status(500).json({
      success: false,
      message: "Encryption failed",
      error: "ENCRYPTION_ERROR",
    });
  }
});

// GET /de/:encryptedPath - Decrypt and redirect route
encryptRoute.get("/de/:encryptedPath", (req: Request, res: Response): void => {
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
  } catch (error) {
    console.error("Redirect decryption error:", error);
    res.status(400).json({
      success: false,
      message: "Failed to decrypt redirect path",
      error: "DECRYPT_REDIRECT_ERROR",
    });
  }
});

// POST /encrypt-path - Encrypt a full path for redirect purposes
encryptRoute.post("/encrypt-path", (req: Request, res: Response): void => {
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
  } catch (error) {
    console.error("Path encryption error:", error);
    res.status(500).json({
      success: false,
      message: "Path encryption failed",
      error: "PATH_ENCRYPTION_ERROR",
    });
  }
});

// Middleware function to decrypt URL parameters
export const decryptUrlParams = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      paramNames.forEach((paramName) => {
        if (req.params[paramName]) {
          const decrypted = decryptUrlParam(req.params[paramName]);
          req.params[paramName] = decrypted;
        }
      });
      next();
    } catch (error) {
      console.error("URL parameter decryption error:", error);
      return res.status(400).json({
        success: false,
        message: "Invalid URL parameters",
        error: "INVALID_ENCRYPTED_PARAMS",
      });
    }
  };
};

// Export utility functions for use in other routes
export { encryptUrlParam, decryptUrlParam };

export default encryptRoute;
