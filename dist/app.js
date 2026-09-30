"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOriginAllowed = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const database_1 = __importDefault(require("./database"));
const dotenv_1 = __importDefault(require("dotenv"));
const user_route_1 = __importDefault(require("./router/user.route"));
const response_route_1 = __importDefault(require("./router/response.route"));
const notification_route_1 = __importDefault(require("./router/notification.route"));
const export_route_1 = __importDefault(require("./router/export.route"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = require("express-rate-limit");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Enable trust proxy (required for ngrok, reverse proxies, and rate limiters behind proxies)
app.set("trust proxy", 1);
// CORS configuration supporting local dev, multiple origins, and ngrok tunnels
const getAllowedOrigins = () => {
    const envUrl = process.env.FRONTEND_URL;
    if (!envUrl)
        return ["http://localhost:5173", "http://localhost:3000"];
    return envUrl
        .split(",")
        .map((url) => url.trim().replace(/\/$/, ""))
        .filter(Boolean);
};
const isOriginAllowed = (origin) => {
    const normalizedOrigin = origin.replace(/\/$/, "");
    const allowedList = getAllowedOrigins();
    // Exact match with FRONTEND_URL entries
    if (allowedList.includes(normalizedOrigin))
        return true;
    // In non-production or when ngrok is enabled, allow any ngrok tunnel or dev origin
    const isNgrokOrDevAllowed = process.env.USE_NGROK === "true" ||
        process.env.ALLOW_NGROK === "true" ||
        process.env.NODE_ENV !== "PROD";
    if (isNgrokOrDevAllowed) {
        // Allow any ngrok domain (.app, .dev, .io, or containing 'ngrok')
        if (/ngrok/i.test(normalizedOrigin) ||
            /^https?:\/\/([a-zA-Z0-9-]+\.)*ngrok(-free)?\.(app|dev|io)(:\d+)?$/i.test(normalizedOrigin)) {
            return true;
        }
        const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin) ||
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin);
        if (isLocalhost)
            return true;
        // Allow local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for mobile testing
        const isLocalNetwork = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(normalizedOrigin);
        if (isLocalNetwork)
            return true;
    }
    return false;
};
exports.isOriginAllowed = isOriginAllowed;
// Mount CORS first so preflight OPTIONS requests are handled immediately
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || (0, exports.isOriginAllowed)(origin)) {
            return callback(null, true);
        }
        // In non-production, allow the requesting origin to prevent developer blockers
        if (process.env.NODE_ENV !== "PROD") {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true,
    // Omitting allowedHeaders allows the cors package to dynamically reflect
    // the headers requested by the client in Access-Control-Request-Headers
    exposedHeaders: ["Set-Cookie", "ngrok-skip-browser-warning"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
}));
// Bypass ngrok free tier browser warning interstitial on all responses
app.use((req, res, next) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
});
// Limiter
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
});
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.text());
app.use((0, cookie_parser_1.default)());
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, morgan_1.default)("dev"));
// DB CONNECTION
(0, database_1.default)();
// Routes
app.use("/v0/api", user_route_1.default);
app.use("/v0/api/response", response_route_1.default);
app.use("/v0/api/notifications", notification_route_1.default);
app.use("/v0/api/exports", export_route_1.default);
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        ngrok: process.env.USE_NGROK === "true",
    });
});
app.get("/", (req, res) => {
    res.send("Hello, TypeScript with Express!");
});
exports.default = app;
