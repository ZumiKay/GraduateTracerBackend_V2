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
import encryptRoute from "./router/encrypt.route";

dotenv.config();

const app = express();

//Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
});
// Middleware
app.use(express.json());
app.use(express.text());
app.use(cookieparser());

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(helmet());
app.use(morgan("dev"));

//DB CONNECTION
DBConnection();

// Routes
app.use("/v0/api", UserRoute);
app.use("/v0/api/response", ResponseRouter);
app.use("/v0/api/notifications", NotificationRouter);
app.use("/v0/api/exports", ExportRouter);
app.use("/v0/api/de", encryptRoute);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript with Express!");
});

export default app;
