import { NextFunction, Request, Response } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation Error",
          errors: error.errors, // Provide detailed error messages
        });
      }
      next(error);
    }
  };
