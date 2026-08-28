"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VerifyRecaptcha;
const helper_1 = require("../../utilities/helper");
async function VerifyRecaptcha(req, res) {
    const { token } = req.body;
    const secretKey = process.env.RECAPCHA_SECRETKEY;
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
    try {
        const response = await fetch(verificationUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
            }),
        });
        const data = await response.json();
        if (data.success && data.score >= 0.5) {
            return res.status(200).json((0, helper_1.ReturnCode)(200));
        }
        else {
            return res
                .status(400)
                .json({ ...(0, helper_1.ReturnCode)(400), errors: data["error-codes"] });
        }
    }
    catch (error) {
        return res.status(500).json((0, helper_1.ReturnCode)(500));
    }
}
