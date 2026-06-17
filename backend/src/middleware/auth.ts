import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { cache } from "../config/redis";
import { sendUnauthorized, sendForbidden } from "../utils/response";
import { logger } from "../utils/logger";

// ─── Extend Express Request ───────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Authenticate ─────────────────────────────────────────────────────────────

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendUnauthorized(res, "Missing or malformed Authorization header");
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // Check if token is blacklisted (revoked)
    const isBlacklisted = await cache.isBlacklisted(token);
    if (isBlacklisted) {
      sendUnauthorized(res, "Token has been revoked");
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      sendUnauthorized(res, "Token expired");
      return;
    }
    if (err.name === "JsonWebTokenError") {
      sendUnauthorized(res, "Invalid token");
      return;
    }
    logger.error("Auth middleware error:", err);
    sendUnauthorized(res, "Authentication failed");
  }
}

// ─── Optional Auth (for routes that work both authed and unauthed) ─────────────

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
  } catch {
    // Silently ignore invalid/expired tokens for optional auth
  }
  next();
}

// ─── Role Guards ──────────────────────────────────────────────────────────────

type Role = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      sendForbidden(
        res,
        `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${req.user.role}`
      );
      return;
    }

    next();
  };
}

// Shorthand guards
export const requireAdmin = requireRole("ADMIN");
export const requireTeacher = requireRole("TEACHER");
export const requireStudent = requireRole("STUDENT");
export const requireParent = requireRole("PARENT");
export const requireAdminOrTeacher = requireRole("ADMIN", "TEACHER");
export const requireAny = requireRole("ADMIN", "TEACHER", "STUDENT", "PARENT");

// ─── Resource Ownership Guard ─────────────────────────────────────────────────

/**
 * Ensures the requesting user is either an admin OR the resource owner.
 * Usage: requireOwnership((req) => req.params.userId)
 */
export function requireOwnership(getOwnerId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const ownerId = getOwnerId(req);
    const isAdmin = req.user.role === "ADMIN";
    const isOwner = req.user.sub === ownerId;

    if (!isAdmin && !isOwner) {
      sendForbidden(res, "You can only access your own resources");
      return;
    }

    next();
  };
}
