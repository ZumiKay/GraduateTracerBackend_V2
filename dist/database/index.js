"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DBConnection;
const mongoose_1 = __importDefault(require("mongoose"));
async function DBConnection() {
    try {
        const URI = process.env.DATABASE_URL;
        if (!URI) {
            console.log("Connection String Not Found");
        }
        await mongoose_1.default.connect(process.env.DATABASE_URL, {});
        console.log("Connected To DB");
    }
    catch (error) {
        console.log("MongoDB Connection Error: ", error);
        process.exit(1);
    }
}
