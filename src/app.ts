import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import DBConnection from "./database";
import dotenv from "dotenv";
import UserRoute from "./router/user.route";
import ResponseRouter from "./router/response.route";
import NotificationRouter from "./router/notification.route";
import ExportRouter from "./router/export.route";
import cookieparser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

dotenv.config();

const app = express();

// Enable trust proxy (required for ngrok, reverse proxies, and rate limiters behind proxies)
app.set("trust proxy", 1);

// CORS configuration supporting local dev, multiple origins, and ngrok tunnels
const getAllowedOrigins = (): string[] => {
  const envUrl = process.env.FRONTEND_URL;
  if (!envUrl) return ["http://localhost:5173", "http://localhost:3000"];
  return envUrl
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .flatMap((url) => [
      url,
      ...(url.startsWith("http://") || url.startsWith("https://")
        ? []
        : [`https://${url}`, `http://${url}`]),
    ])
    .filter(Boolean);
};

export const isOriginAllowed = (origin: string): boolean => {
  const normalizedOrigin = origin.replace(/\/$/, "");

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // In non-production or when ngrok is enabled, allow any ngrok tunnel or dev origin
  const isNgrokOrDevAllowed =
    process.env.USE_NGROK === "true" ||
    process.env.ALLOW_NGROK === "true" ||
    process.env.NODE_ENV !== "PROD";

  if (isNgrokOrDevAllowed) {
    // Allow any ngrok domain (.app, .dev, .io, or containing 'ngrok')
    if (
      /ngrok/i.test(normalizedOrigin) ||
      /^https?:\/\/([a-zA-Z0-9-]+\.)*ngrok(-free)?\.(app|dev|io)(:\d+)?$/i.test(normalizedOrigin)
    ) {
      return true;
    }

    const isLocalhost =
      /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin);
    if (isLocalhost) return true;

    // Allow local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for mobile testing
    const isLocalNetwork =
      /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
        normalizedOrigin,
      );
    if (isLocalNetwork) return true;
  }

  return false;
};

// Mount CORS first so preflight OPTIONS requests are handled immediately
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || isOriginAllowed(origin)) {
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
  }),
);

// Bypass ngrok free tier browser warning interstitial on all responses
app.use((req: Request, res: Response, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
});

// Middleware
app.use(express.json());
app.use(express.text());
app.use(cookieparser());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(morgan("dev"));

// DB CONNECTION
DBConnection();

// Routes
app.use("/v0/api", UserRoute);
app.use("/v0/api/response", ResponseRouter);
app.use("/v0/api/notifications", NotificationRouter);
app.use("/v0/api/exports", ExportRouter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    ngrok: process.env.USE_NGROK === "true",
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript with Express!");
});

export default app;
