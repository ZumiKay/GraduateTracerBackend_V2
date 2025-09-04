import { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

class TrafficControl {
  // Login rate limiter 
  public LoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.LOGIN_ATTEMPT ? Number(process.env.LOGIN_ATTEMPT) : 5, // Limit each IP to 5 login attempts per windowMs
    message: {
      code: 429,
      message: "Too many login attempts, please try again later",
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  // General API rate limiter
  public ApiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      code: 429,
      message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Password reset rate limiter
  public PasswordResetRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
      code: 429,
      message: "Too many password reset attempts, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  public Ratelimit = (req: Request, res: Response, next: NextFunction) => {
    return this.LoginRateLimit(req, res, next);
  };
}

export default new TrafficControl();
