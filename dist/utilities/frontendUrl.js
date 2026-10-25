"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrontendBaseUrl = getFrontendBaseUrl;
const DEFAULT_FRONTEND_URL = "http://localhost:5173";
/**
 * Base URL of the frontend for links sent to people (invite and ownership
 * emails, form links, response-removal links).
 *
 * Uses FRONTEND_LINK_URL when set. Otherwise falls back to the first entry of
 * FRONTEND_URL, which is a comma-separated CORS list and may omit the scheme,
 * so it is normalised into a single absolute URL either way.
 */
function getFrontendBaseUrl() {
    const configured = process.env.FRONTEND_LINK_URL?.trim() ||
        process.env.FRONTEND_URL?.split(",")[0]?.trim() ||
        DEFAULT_FRONTEND_URL;
    const unquoted = configured.replace(/^["']|["']$/g, "");
    const withScheme = /^https?:\/\//i.test(unquoted)
        ? unquoted
        : `${isLocalHost(unquoted) ? "http" : "https"}://${unquoted}`;
    return withScheme.replace(/\/+$/, "");
}
function isLocalHost(hostAndPort) {
    const host = hostAndPort.split(/[/:]/)[0].toLowerCase();
    return host === "localhost" || host.startsWith("127.") || host === "0.0.0.0";
}
