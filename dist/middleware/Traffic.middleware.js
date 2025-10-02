"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_rate_limit_1 = require("express-rate-limit");
class TrafficControl {
    constructor() {
        // Login rate limiter 
        this.LoginRateLimit = (0, express_rate_limit_1.rateLimit)({
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
        this.ApiRateLimit = (0, express_rate_limit_1.rateLimit)({
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
        this.PasswordResetRateLimit = (0, express_rate_limit_1.rateLimit)({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // Limit each IP to 3 password reset attempts per hour
            message: {
                code: 429,
                message: "Too many password reset attempts, please try again later",
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.Ratelimit = (req, res, next) => {
            return this.LoginRateLimit(req, res, next);
        };
    }
}
exports.default = new TrafficControl();
