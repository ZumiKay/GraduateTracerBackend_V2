import { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

class TrafficControl {
  public Ratelimit = (req: Request, res: Response, next: NextFunction) => {
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.LOGIN_ATTEMPT ? Number(process.env.LOGIN_ATTEMPT) : 5, // Limit each IP to 5 login attempts per windowMs
      message: {
        code: 429,
        message: "Too many login attempts, please try again later",
      },
      standardHeaders: true, // Return rate limit info in headers
      legacyHeaders: false,

      // Redis store for production (optional but recommended)
    });

    return loginLimiter;
  };
}
export default new TrafficControl();
