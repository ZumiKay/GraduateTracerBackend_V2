import { Request, Response } from "express";
import { ReturnCode } from "../utilities/helper";

export default async function VerifyRecaptcha(req: Request, res: Response) {
  const { token } = req.body;

  const secretKey = process.env.RECAPCHA_SECRETKEY;
  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;

  try {
    const response = await fetch(verificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey as string,
        response: token,
      }),
    });

    const data = await response.json();
    if (data.success && data.score >= 0.5) {
      return res.status(200).json(ReturnCode(200));
    } else {
      return res
        .status(400)
        .json({ ...ReturnCode(400), errors: data["error-codes"] });
    }
  } catch (error) {
    console.error("Error verifying reCAPTCHA:", error);
    return res.status(500).json(ReturnCode(500));
  }
}
