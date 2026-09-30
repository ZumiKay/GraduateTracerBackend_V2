import { Request, Response } from "express";
import { ReturnCode, SendResponse } from "../../utilities/helper";

export default async function VerifyRecaptcha(req: Request, res: Response) {
  const { token } = req.body;

  if (!process.env?.RECAPCHA_SECRETKEY || !process.env.RECAPCHA_URL) {
    return SendResponse(res, 500);
  }

  const secretKey = process.env.RECAPCHA_SECRETKEY as string;
  const verificationUrl = process.env.RECAPCHA_URL as string;

  try {
    const url = `${verificationUrl}/assessments?key=${secretKey}`;
    const response = await fetch(url, {
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
      return res.status(400).json({ ...ReturnCode(400), errors: data["error-codes"] });
    }
  } catch (error) {
    return res.status(500).json(ReturnCode(500));
  }
}
