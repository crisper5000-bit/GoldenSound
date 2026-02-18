import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, formatZodError(parsed.error));
    }

    req.body = parsed.data;
    next();
  };
}

