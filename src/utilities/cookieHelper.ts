import { CookieOptions } from "express";

/**
 * Returns cookie options adaptively based on environment and ngrok configuration.
 *
 * When USE_NGROK=true or COOKIE_SAMESITE=none:
 * - sameSite is set to "none" and secure is true.
 * - This allows cross-site requests across ngrok tunnels and between localhost and ngrok.
 *
 * When in standard local DEV without ngrok:
 * - sameSite is "lax" (or customOptions.sameSite) and secure is false (standard HTTP on localhost).
 *
 * When in PROD:
 * - secure is true and sameSite is "lax" (or customOptions.sameSite).
 */
export function getCookieOptions(customOptions: CookieOptions = {}): CookieOptions {
  const isNgrok =
    process.env.USE_NGROK === "true" ||
    process.env.COOKIE_SAMESITE === "none" ||
    process.env.COOKIE_SECURE === "true" ||
    (process.env.FRONTEND_URL ? /ngrok/i.test(process.env.FRONTEND_URL) : false);

  const isProd = process.env.NODE_ENV === "PROD";

  // If ngrok is active or explicit COOKIE_SAMESITE is set to none, we MUST use secure: true
  // because browsers reject sameSite: "none" without secure: true.
  const sameSite: CookieOptions["sameSite"] =
    (process.env.COOKIE_SAMESITE as CookieOptions["sameSite"]) ||
    (isNgrok ? "none" : (customOptions.sameSite ?? "lax"));

  const secure: boolean =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : sameSite === "none" || isProd;

  // CHIPS (Cookies Having Independent Partitioned State) support
  // Allows cross-site cookies to work in browsers (Safari 17.4+, Chrome, Edge)
  // that partition third-party storage.
  const partitioned: boolean =
    process.env.COOKIE_PARTITIONED !== undefined
      ? process.env.COOKIE_PARTITIONED === "true"
      : sameSite === "none" && secure;

  return {
    httpOnly: true,
    path: "/",
    ...customOptions,
    sameSite,
    secure,
    ...(partitioned ? { partitioned: true } : {}),
  };
}

/**
 * Returns matching cookie options for clearing cookies.
 * Attributes (sameSite, secure, httpOnly, path) must match the attributes
 * with which the cookie was created so the browser properly deletes it.
 */
export function getClearCookieOptions(customOptions: CookieOptions = {}): CookieOptions {
  const base = getCookieOptions(customOptions);
  return {
    httpOnly: base.httpOnly,
    sameSite: base.sameSite,
    secure: base.secure,
    ...(base.partitioned ? { partitioned: true } : {}),
    path: customOptions.path ?? "/",
    ...customOptions,
  };
}
