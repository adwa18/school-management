import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  sub: string;        // userId
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;        // userId
  jti: string;        // unique token ID (for revocation)
  iat?: number;
  exp?: number;
}

// ─── Access Token ─────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    issuer: "school-mgmt",
    audience: "school-mgmt-client",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    issuer: "school-mgmt",
    audience: "school-mgmt-client",
  }) as JwtPayload;
}

// ─── Refresh Token ─────────────────────────────────────────────────────────────

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    issuer: "school-mgmt",
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET, {
    issuer: "school-mgmt",
  }) as RefreshTokenPayload;
}

// ─── Email Verification / Password Reset Tokens ───────────────────────────────

export function signEmailToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "email_verify" }, config.JWT_ACCESS_SECRET, {
    expiresIn: "24h",
  });
}

export function signPasswordResetToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "password_reset" }, config.JWT_ACCESS_SECRET, {
    expiresIn: "1h",
  });
}

export function verifyEmailOrResetToken(token: string): { sub: string; type: string } {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as { sub: string; type: string };
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getTokenExpiryMs(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number };
  if (!decoded?.exp) return 0;
  return decoded.exp * 1000 - Date.now();
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
