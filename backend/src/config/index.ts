import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Server
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "5000"), 10),
  API_VERSION: "v1",
  API_PREFIX: "/api/v1",

  // Database
  DATABASE_URL: requireEnv("DATABASE_URL"),
  DIRECT_URL: optionalEnv("DIRECT_URL", process.env.DATABASE_URL ?? ""),

  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: optionalEnv("UPSTASH_REDIS_REST_URL", ""),
  UPSTASH_REDIS_REST_TOKEN: optionalEnv("UPSTASH_REDIS_REST_TOKEN", ""),

  // JWT
  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: optionalEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: optionalEnv("JWT_REFRESH_EXPIRES_IN", "7d"),

  // CORS
  FRONTEND_URL: optionalEnv("FRONTEND_URL", "http://localhost:3000"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: optionalEnv("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: optionalEnv("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: optionalEnv("CLOUDINARY_API_SECRET", ""),

  // Email (SendGrid / Nodemailer)
  EMAIL_HOST: optionalEnv("EMAIL_HOST", "smtp.sendgrid.net"),
  EMAIL_PORT: parseInt(optionalEnv("EMAIL_PORT", "587"), 10),
  EMAIL_USER: optionalEnv("EMAIL_USER", "apikey"),
  EMAIL_PASS: optionalEnv("EMAIL_PASS", ""),
  EMAIL_FROM: optionalEnv("EMAIL_FROM", "noreply@school.edu"),
  EMAIL_FROM_NAME: optionalEnv("EMAIL_FROM_NAME", "School Management System"),

  // Twilio
  TWILIO_ACCOUNT_SID: optionalEnv("TWILIO_ACCOUNT_SID", ""),
  TWILIO_AUTH_TOKEN: optionalEnv("TWILIO_AUTH_TOKEN", ""),
  TWILIO_PHONE_NUMBER: optionalEnv("TWILIO_PHONE_NUMBER", ""),

  // Stripe
  STRIPE_SECRET_KEY: optionalEnv("STRIPE_SECRET_KEY", ""),
  STRIPE_WEBHOOK_SECRET: optionalEnv("STRIPE_WEBHOOK_SECRET", ""),
  STRIPE_CURRENCY: optionalEnv("STRIPE_CURRENCY", "usd"),

  // Firebase Cloud Messaging
  FCM_SERVER_KEY: optionalEnv("FCM_SERVER_KEY", ""),

  // Encryption
  ENCRYPTION_KEY: optionalEnv("ENCRYPTION_KEY", "default-32-char-key-change-this!!"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(optionalEnv("RATE_LIMIT_WINDOW_MS", "900000"), 10), // 15 min
  RATE_LIMIT_MAX: parseInt(optionalEnv("RATE_LIMIT_MAX", "100"), 10),

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const isProduction = config.NODE_ENV === "production";
export const isDevelopment = config.NODE_ENV === "development";
export const isTest = config.NODE_ENV === "test";
