import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import prisma from "../../config/database";
import { cache } from "../../config/redis";
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  signEmailToken, signPasswordResetToken, verifyEmailOrResetToken, getTokenExpiryMs,
} from "../../utils/jwt";
import { sendEmail, emailTemplates } from "../../utils/email";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export class AuthService {
  async register(data: { email: string; password: string; firstName: string; lastName: string; role: string; phone?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, role: data.role as any, firstName: data.firstName, lastName: data.lastName, phone: data.phone },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });

    const verifyToken = signEmailToken(user.id);
    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${verifyToken}`;
    await sendEmail({ to: data.email, ...emailTemplates.verifyEmail(`${data.firstName} ${data.lastName}`, verifyUrl) });
    await prisma.notificationPreference.create({ data: { userId: user.id } });
    return user;
  }

  async login(email: string, password: string, deviceInfo?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, firstName: true, lastName: true, isActive: true, isEmailVerified: true, mfaEnabled: true, avatarUrl: true },
    });
    if (!user) throw new Error("INVALID_CREDENTIALS");
    if (!user.isActive) throw new Error("ACCOUNT_DISABLED");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("INVALID_CREDENTIALS");
    if (user.mfaEnabled) {
      const mfaToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
      return { requiresMfa: true, mfaToken };
    }
    return this.issueTokens(user, deviceInfo);
  }

  async issueTokens(user: { id: string; email: string; role: string }, deviceInfo?: string) {
    const jti = uuidv4();
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, jti });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt, deviceInfo } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try { payload = verifyRefreshToken(refreshToken); } catch { throw new Error("INVALID_REFRESH_TOKEN"); }
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new Error("INVALID_REFRESH_TOKEN");
    if (!stored.user.isActive) throw new Error("ACCOUNT_DISABLED");
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user);
  }

  async logout(accessToken: string, refreshToken?: string) {
    const ttl = Math.floor(getTokenExpiryMs(accessToken) / 1000);
    if (ttl > 0) await cache.addToBlacklist(accessToken, ttl);
    if (refreshToken) await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revokedAt: new Date() } });
  }

  async verifyEmail(token: string) {
    let payload: any;
    try { payload = verifyEmailOrResetToken(token); } catch { throw new Error("INVALID_TOKEN"); }
    if (payload.type !== "email_verify") throw new Error("INVALID_TOKEN");
    await prisma.user.update({ where: { id: payload.sub }, data: { isEmailVerified: true } });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, firstName: true, lastName: true, email: true } });
    if (!user) return;
    const resetToken = signPasswordResetToken(user.id);
    const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    await sendEmail({ to: user.email, ...emailTemplates.resetPassword(`${user.firstName} ${user.lastName}`, resetUrl) });
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: any;
    try { payload = verifyEmailOrResetToken(token); } catch { throw new Error("INVALID_TOKEN"); }
    if (payload.type !== "password_reset") throw new Error("INVALID_TOKEN");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } });
    await prisma.refreshToken.updateMany({ where: { userId: payload.sub, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async setupMfa(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, "SchoolMgmt", secret);
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);
    await cache.set(`mfa_setup:${userId}`, secret, 600);
    return { secret, qrCodeUrl, otpAuthUrl };
  }

  async verifyAndEnableMfa(userId: string, code: string) {
    const secret = await cache.get(`mfa_setup:${userId}`);
    if (!secret) throw new Error("MFA_SETUP_EXPIRED");
    if (!authenticator.check(code, secret)) throw new Error("INVALID_MFA_CODE");
    await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret, mfaEnabled: true } });
    await cache.del(`mfa_setup:${userId}`);
  }

  async validateMfaCode(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaSecret: true, mfaEnabled: true, id: true, email: true, role: true } });
    if (!user.mfaEnabled || !user.mfaSecret) throw new Error("MFA_NOT_ENABLED");
    if (!authenticator.check(code, user.mfaSecret)) throw new Error("INVALID_MFA_CODE");
    return this.issueTokens(user);
  }
}

export const authService = new AuthService();
