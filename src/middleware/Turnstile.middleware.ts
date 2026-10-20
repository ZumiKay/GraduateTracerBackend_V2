import { NextFunction, Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response";

interface SiteverifyResult {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

/**
 * Hostnames a token may come from: TURNSTILE_HOSTNAMES (comma separated),
 * otherwise the hostnames in FRONTEND_URL.
 */
const allowedHostnames = (): string[] => {
  const explicit = process.env.TURNSTILE_HOSTNAMES;
  if (explicit) {
    return explicit
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  }
  return (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((url) => {
      const entry = url.trim();
      if (!entry) return "";
      try {
        // Entries may leave out the scheme ("localhost:5173"); without one,
        // URL() would read "localhost:" as the scheme and lose the hostname
        const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(entry) ? entry : `http://${entry}`;
        return new URL(withScheme).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
};

const reject = (res: Response, message: string) =>
  res.status(403).json(ReturnCode(403, message));

/**
 * Checks the Cloudflare Turnstile token sent with the request before the
 * handler runs. The token must be valid, made for `action`, and come from an
 * allowed hostname. Tokens are single-use, so a replayed token is rejected.
 *
 * Without TURNSTILE_SECRET the check is skipped outside production (local
 * dev and tests); in production the request fails instead of going through
 * unprotected.
 *
 * @param action Name the frontend widget was rendered with (data-action)
 * @param when   Optional: only check requests this returns true for
 */
export const VerifyTurnstile =
  (action: string, when?: (req: Request) => boolean) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (when && !when(req)) return next();

    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "PROD") {
        console.error("[Turnstile] TURNSTILE_SECRET is not set");
        return res.status(500).json(ReturnCode(500));
      }
      return next();
    }

    const token = req.body?.[TURNSTILE_TOKEN_FIELD];
    if (typeof token !== "string" || !token || token.length > 2048) {
      return reject(res, "Please complete the security check");
    }

    try {
      const body = new URLSearchParams({ secret, response: token });
      if (req.ip) body.set("remoteip", req.ip);

      const response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(10_000),
      });
      const result = (await response.json()) as SiteverifyResult;

      if (!result.success) {
        return reject(res, "Security check failed, please try again");
      }
      if (result.action !== action) {
        return reject(res, "Security check failed, please try again");
      }

      const hostnames = allowedHostnames();
      if (
        hostnames.length > 0 &&
        !hostnames.includes((result.hostname ?? "").toLowerCase())
      ) {
        return reject(res, "Security check failed, please try again");
      }

      // The token is only for this check; keep it out of the handler's data
      delete req.body[TURNSTILE_TOKEN_FIELD];
      return next();
    } catch (error) {
      console.error(
        "[Turnstile] Siteverify request failed:",
        error instanceof Error ? error.message : error,
      );
      return res
        .status(503)
        .json({ code: 503, message: "Security check unavailable, please try again" });
    }
  };
