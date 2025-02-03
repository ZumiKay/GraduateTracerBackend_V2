import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import DBConnection from "./database";
import dotenv from "dotenv";
import UserRoute from "./router/user.route";
import cookieparser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

dotenv.config();

const app = express();

//Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  max: 100, // limit each IP to 100 requests per windowMs
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

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript with Express!");
});

export default app;
