"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const PORT = process.env.PORT ?? 4000;
app_1.default.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    if (process.env.USE_NGROK === "true") {
        console.log(`[ngrok] Ngrok mode active: trust proxy enabled, cross-site cookies (SameSite=None, Secure=true) enabled.`);
    }
});
