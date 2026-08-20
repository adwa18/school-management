import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { authService } from "./auth.service";
import {
  sendSuccess, sendCreated, sendError, sendBadRequest, sendUnauthorized,
} from "../../utils/response";
import { config } from "../../config";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  phone: z.string().optional(),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => { const f = e.path.join("."); errors[f] = [...(errors[f] ?? []), e.message]; });
    sendBadRequest(res, "Validation failed", errors); return;
  }
  try {
    const user = await authService.register(parsed.data as any);
    sendCreated(res, user, "Registration successful. Please check your email to verify your account.");
  } catch (err: any) {
    if (err.message === "EMAIL_TAKEN") { sendError(res, "An account with this email already exists", 409); return; }
    throw err;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { sendBadRequest(res, "Email and password are required"); return; }
  try {
    const result = await authService.login(email, password, req.headers["user-agent"]);
    if ("requiresMfa" in result && result.requiresMfa) {
      sendSuccess(res, { requiresMfa: true, mfaToken: result.mfaToken }, "MFA verification required"); return;
    }
    const { accessToken, refreshToken } = result as { accessToken: string; refreshToken: string };
    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken }, "Login successful");
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") { sendUnauthorized(res, "Invalid email or password"); return; }
    if (err.message === "ACCOUNT_DISABLED") { sendError(res, "Account disabled. Contact support.", 403); return; }
    throw err;
  }
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) { sendUnauthorized(res, "No refresh token provided"); return; }
  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token);
    res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken }, "Token refreshed");
  } catch {
    res.clearCookie("refreshToken");
    sendUnauthorized(res, "Invalid or expired refresh token");
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.split(" ")[1] ?? "";
  const rt = req.cookies?.refreshToken;
  await authService.logout(accessToken, rt);
  res.clearCookie("refreshToken");
  sendSuccess(res, null, "Logged out successfully");
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  if (!token) { sendBadRequest(res, "Verification token is required"); return; }
  try { await authService.verifyEmail(token); sendSuccess(res, null, "Email verified successfully"); }
  catch { sendError(res, "Invalid or expired verification token", 400); }
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { sendBadRequest(res, "Email is required"); return; }
  await authService.forgotPassword(email);
  sendSuccess(res, null, "If an account exists with that email, a reset link has been sent.");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) { sendBadRequest(res, "Token and password are required"); return; }
  try { await authService.resetPassword(token, password); sendSuccess(res, null, "Password reset successfully"); }
  catch { sendError(res, "Invalid or expired reset token", 400); }
});

export const setupMfa = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.setupMfa(req.user!.sub);
  sendSuccess(res, result, "Scan the QR code with your authenticator app, then verify");
});

export const verifyMfa = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) { sendBadRequest(res, "MFA code is required"); return; }
  try { await authService.verifyAndEnableMfa(req.user!.sub, code); sendSuccess(res, null, "MFA enabled successfully"); }
  catch (err: any) {
    if (err.message === "INVALID_MFA_CODE") { sendError(res, "Invalid MFA code", 400); return; }
    if (err.message === "MFA_SETUP_EXPIRED") { sendError(res, "MFA setup expired. Please start again.", 400); return; }
    throw err;
  }
});

export const confirmMfaLogin = asyncHandler(async (req: Request, res: Response) => {
  const { userId, code } = req.body;
  if (!userId || !code) { sendBadRequest(res, "userId and code are required"); return; }
  try {
    const { accessToken, refreshToken } = await authService.validateMfaCode(userId, code);
    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken }, "MFA verified, login successful");
  } catch { sendError(res, "Invalid MFA code", 401); }
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const { prisma } = await import("../../config/database");
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.sub },
    select: {
      id: true, email: true, role: true, firstName: true, lastName: true,
      phone: true, gender: true, avatarUrl: true, isEmailVerified: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
    },
  });
  sendSuccess(res, user, "Profile retrieved");
});
