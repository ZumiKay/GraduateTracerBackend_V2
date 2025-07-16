"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VerifyRecaptcha;
const helper_1 = require("../utilities/helper");
function VerifyRecaptcha(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { token } = req.body;
        const secretKey = process.env.RECAPCHA_SECRETKEY;
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
        try {
            const response = yield fetch(verificationUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    secret: secretKey,
                    response: token,
                }),
            });
            const data = yield response.json();
            if (data.success && data.score >= 0.5) {
                return res.status(200).json((0, helper_1.ReturnCode)(200));
            }
            else {
                return res
                    .status(400)
                    .json(Object.assign(Object.assign({}, (0, helper_1.ReturnCode)(400)), { errors: data["error-codes"] }));
            }
        }
        catch (error) {
            console.error("Error verifying reCAPTCHA:", error);
            return res.status(500).json((0, helper_1.ReturnCode)(500));
        }
    });
}
