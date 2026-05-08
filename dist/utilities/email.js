"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const HandleEmail = async (to, subject, html, message) => {
    const transporter = nodemailer_1.default.createTransport({
        service: "gmail",
        auth: {
            user: process.env.ADMIN_EMAIL,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
    try {
        const sendMail = await transporter.sendMail({
            from: process.env.ADMIN_EMAIL, // Ensure the 'from' field is set, usually set to the admin email
            to,
            subject,
            text: message ?? "",
            html,
        });
        console.log(`Email sent successfully to ${to}. Message ID: ${sendMail.messageId}`);
        return { success: true, message: "Email sent successfully" };
    }
    catch (error) {
        console.error("Error sending email:", error.message);
        return { success: false, message: `Error sending email: ${error.message}` };
    }
};
exports.default = HandleEmail;
