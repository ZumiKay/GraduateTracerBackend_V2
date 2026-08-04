"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
//Limiter
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
});
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.text());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({ origin: "http://localhost:5173", credentials: true }));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)("dev"));
//DB CONNECTION
(0, database_1.default)();
// Routes
app.use("/v0/api", user_route_1.default);
app.use("/v0/api/response", response_route_1.default);
app.use("/v0/api/notifications", notification_route_1.default);
app.use("/v0/api/exports", export_route_1.default);
app.get("/", (req, res) => {
    res.send("Hello, TypeScript with Express!");
});
exports.default = app;
