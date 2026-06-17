import { config } from "../config";
import { logger } from "./logger";

// Lazy-load Twilio to avoid startup errors when not configured
let twilioClient: any = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) return null;

  try {
    const twilio = require("twilio");
    twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch {
    logger.warn("Twilio not installed — SMS disabled");
    return null;
  }
}

export interface SmsOptions {
  to: string;
  body: string;
}

export async function sendSms(options: SmsOptions): Promise<boolean> {
  const client = getTwilioClient();

  if (!client || !config.TWILIO_PHONE_NUMBER) {
    logger.warn(`[SMS Stub] To: ${options.to} | Body: ${options.body.slice(0, 50)}…`);
    return true; // Stub succeeds silently in dev
  }

  try {
    await client.messages.create({
      body: options.body,
      from: config.TWILIO_PHONE_NUMBER,
      to: options.to,
    });
    logger.info(`SMS sent to ${options.to}`);
    return true;
  } catch (err: any) {
    logger.error(`SMS failed to ${options.to}: ${err.message}`);
    return false;
  }
}

// ─── SMS Templates ────────────────────────────────────────────────────────────

export const smsTemplates = {
  attendanceAlert: (studentName: string, date: string, status: string) =>
    `School Alert: ${studentName} was marked ${status} on ${date}. Contact school if incorrect.`,

  feeReminder: (studentName: string, amount: string, dueDate: string) =>
    `Fee Reminder: ${amount} due for ${studentName} by ${dueDate}. Log in to pay online.`,

  examResult: (studentName: string, subject: string, grade: string) =>
    `Exam Result: ${studentName} received grade ${grade} in ${subject}. View details online.`,

  passwordReset: (otp: string) =>
    `Your School Management System OTP is: ${otp}. Valid for 10 minutes. Do not share.`,

  generalAlert: (message: string) =>
    `School Management: ${message}`,
};
