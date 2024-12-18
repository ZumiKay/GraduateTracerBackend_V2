import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import DBConnection from "./database";
import dotenv from "dotenv";
import UserRoute from "./router/user.route";
import cookieparser from "cookie-parser";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.text());
app.use(cookieparser());

app.use(cors({ origin: "*", credentials: true }));
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
