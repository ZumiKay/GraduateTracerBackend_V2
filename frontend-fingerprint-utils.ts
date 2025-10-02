/**
 * Frontend utility to collect browser fingerprint data
 * Add this to your frontend project to send fingerprint headers with requests
 */

export interface BrowserFingerprintHeaders {
  "X-Screen-Resolution": string;
  "X-Timezone": string;
  "X-Platform": string;
}

/**
 * Collect browser-specific data for fingerprinting
 * This data will be sent as headers to the backend
 */
export const collectBrowserFingerprint = (): BrowserFingerprintHeaders => {
  const headers: BrowserFingerprintHeaders = {
    "X-Screen-Resolution": "",
    "X-Timezone": "",
    "X-Platform": "",
  };

  try {
    // Screen resolution
    if (typeof screen !== "undefined") {
      headers["X-Screen-Resolution"] = `${screen.width}x${screen.height}`;
    }

    // Timezone
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      headers["X-Timezone"] = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Platform
    if (typeof navigator !== "undefined" && navigator.platform) {
      headers["X-Platform"] = navigator.platform;
    }
  } catch (error) {
    console.warn("Error collecting browser fingerprint:", error);
  }

  return headers;
};

/**
 * Enhanced version with additional fingerprint data
 * Use this for higher security forms
 */
export const collectEnhancedFingerprint = (): BrowserFingerprintHeaders &
  Record<string, string> => {
  const basicHeaders = collectBrowserFingerprint();
  const enhancedHeaders = { ...basicHeaders } as BrowserFingerprintHeaders &
    Record<string, string>;

  try {
    // Color depth
    if (typeof screen !== "undefined" && screen.colorDepth) {
      enhancedHeaders["X-Color-Depth"] = screen.colorDepth.toString();
    }

    // Available screen size
    if (
      typeof screen !== "undefined" &&
      screen.availWidth &&
      screen.availHeight
    ) {
      enhancedHeaders[
        "X-Available-Screen"
      ] = `${screen.availWidth}x${screen.availHeight}`;
    }

    // Language preferences
    if (typeof navigator !== "undefined") {
      if (navigator.language) {
        enhancedHeaders["X-Navigator-Language"] = navigator.language;
      }
      if (navigator.languages && navigator.languages.length > 0) {
        enhancedHeaders["X-Navigator-Languages"] = navigator.languages
          .slice(0, 3)
          .join(",");
      }
    }

    // Hardware concurrency (CPU cores)
    if (
      typeof navigator !== "undefined" &&
      (navigator as any).hardwareConcurrency
    ) {
      enhancedHeaders["X-Hardware-Concurrency"] = (
        navigator as any
      ).hardwareConcurrency.toString();
    }

    // Device memory (if available)
    if (typeof navigator !== "undefined" && (navigator as any).deviceMemory) {
      enhancedHeaders["X-Device-Memory"] = (
        navigator as any
      ).deviceMemory.toString();
    }
  } catch (error) {
    console.warn("Error collecting enhanced fingerprint:", error);
  }

  return enhancedHeaders;
};

/**
 * Example usage in your API client
 */
export const createApiClient = () => {
  const baseHeaders = {
    "Content-Type": "application/json",
    ...collectBrowserFingerprint(),
  };

  return {
    headers: baseHeaders,

    // Example: Submit form with fingerprint
    submitForm: async (formData: any) => {
      const response = await fetch("/api/form/submit", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(formData),
      });
      return response.json();
    },

    // Example: Verify form access with fingerprint
    verifyFormAccess: async (formId: string) => {
      const response = await fetch(`/api/form/${formId}/public?ty=verify`, {
        method: "GET",
        headers: baseHeaders,
      });
      return response.json();
    },
  };
};

/**
 * React hook for browser fingerprinting
 * Add React imports: import { useState, useEffect } from 'react';
 */
export const useBrowserFingerprint = () => {
  // Note: Import useState and useEffect from React before using this hook
  // const [fingerprint, setFingerprint] = useState<BrowserFingerprintHeaders | null>(null);

  // useEffect(() => {
  //   try {
  //     const fp = collectBrowserFingerprint();
  //     setFingerprint(fp);
  //   } catch (error) {
  //     console.error('Failed to collect browser fingerprint:', error);
  //   }
  // }, []);

  // return fingerprint;

  console.log("Import React hooks before using this function");
  return null;
};

// Type definitions for TypeScript projects
declare global {
  interface Navigator {
    hardwareConcurrency?: number;
    deviceMemory?: number;
  }
}
