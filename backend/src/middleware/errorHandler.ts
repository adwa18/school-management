import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import { logger } from "../utils/logger";
import { sendError, sendBadRequest } from "../utils/response";
import { isProduction } from "../config";

// ─── Global Error Handler ─────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log every error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.sub,
  });

  // Prisma known errors
  if (err.constructor.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as any;
    if (prismaErr.code === "P2002") {
      sendError(res, "A record with this value already exists (duplicate)", 409);
      return;
    }
    if (prismaErr.code === "P2025") {
      sendError(res, "Record not found", 404);
      return;
    }
    if (prismaErr.code === "P2003") {
      sendError(res, "Related record not found", 400);
      return;
    }
  }

  // Zod validation error (should be caught by validate middleware, but just in case)
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(e.message);
    });
    sendBadRequest(res, "Validation failed", fieldErrors);
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    sendError(res, "Invalid token", 401);
    return;
  }
  if (err.name === "TokenExpiredError") {
    sendError(res, "Token expired", 401);
    return;
  }

  // Multer errors
  if (err.name === "MulterError") {
    sendError(res, `File upload error: ${err.message}`, 400);
    return;
  }

  // Default: Internal server error (don't expose stack trace in production)
  sendError(
    res,
    isProduction ? "Internal server error" : err.message,
    500
  );
}

// ─── 404 Handler ─────────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}

// ─── Zod Validation Middleware ────────────────────────────────────────────────

type SchemaTarget = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: SchemaTarget = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      result.error.errors.forEach((e) => {
        const field = e.path.join(".");
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(e.message);
      });
      sendBadRequest(res, "Validation failed", fieldErrors);
      return;
    }

    // Replace request data with parsed/coerced values
    req[target] = result.data as any;
    next();
  };
}

// ─── Rate Limit Error Handler ─────────────────────────────────────────────────

export function rateLimitHandler(req: Request, res: Response): void {
  sendError(res, "Too many requests. Please try again later.", 429);
}
