import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: false,
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS,
  },
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!config.EMAIL_PASS) {
    logger.warn(`[Email Stub] To: ${options.to} | Subject: ${options.subject}`);
    return true; // Silently succeed in dev without credentials
  }

  try {
    await transporter.sendMail({
      from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM}>`,
      ...options,
    });
    logger.info(`Email sent to: ${options.to}`);
    return true;
  } catch (err) {
    logger.error("Failed to send email:", err);
    return false;
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function baseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1d4ed8; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 28px; background: #1d4ed8; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: bold; }
    .footer { background: #f4f4f4; padding: 16px 32px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎓 School Management System</h1></div>
    <div class="body">
      <h2>${title}</h2>
      ${content}
    </div>
    <div class="footer">© ${new Date().getFullYear()} School Management System. All rights reserved.</div>
  </div>
</body>
</html>`;
}

export const emailTemplates = {
  verifyEmail(name: string, verifyUrl: string): EmailOptions {
    return {
      subject: "Verify Your Email Address",
      html: baseTemplate(
        `<p>Hi <strong>${name}</strong>,</p>
         <p>Please click the button below to verify your email address and activate your account.</p>
         <a href="${verifyUrl}" class="btn">Verify Email</a>
         <p>This link expires in 24 hours.</p>
         <p>If you did not register, please ignore this email.</p>`,
        "Email Verification"
      ),
      to: "",
    };
  },

  resetPassword(name: string, resetUrl: string): Omit<EmailOptions, "to"> {
    return {
      subject: "Reset Your Password",
      html: baseTemplate(
        `<p>Hi <strong>${name}</strong>,</p>
         <p>You requested to reset your password. Click the button below:</p>
         <a href="${resetUrl}" class="btn">Reset Password</a>
         <p>This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>`,
        "Password Reset"
      ),
    };
  },

  gradePublished(
    name: string,
    examName: string,
    subject: string,
    grade: string,
    marks: number
  ): Omit<EmailOptions, "to"> {
    return {
      subject: `Grade Published: ${subject} — ${examName}`,
      html: baseTemplate(
        `<p>Hi <strong>${name}</strong>,</p>
         <p>Your grade for <strong>${examName}</strong> in <strong>${subject}</strong> has been published.</p>
         <table style="border-collapse:collapse; width:100%; margin:16px 0;">
           <tr style="background:#f0f4ff;">
             <td style="padding:12px; border:1px solid #ddd;">Marks Obtained</td>
             <td style="padding:12px; border:1px solid #ddd;"><strong>${marks}</strong></td>
           </tr>
           <tr>
             <td style="padding:12px; border:1px solid #ddd;">Grade</td>
             <td style="padding:12px; border:1px solid #ddd;"><strong>${grade}</strong></td>
           </tr>
         </table>
         <p>Log in to the portal for detailed feedback and report cards.</p>`,
        "Grade Published"
      ),
    };
  },

  feeReminder(name: string, amount: number, dueDate: string, invoiceNumber: string): Omit<EmailOptions, "to"> {
    return {
      subject: `Fee Reminder: ${invoiceNumber} — Due ${dueDate}`,
      html: baseTemplate(
        `<p>Hi <strong>${name}</strong>,</p>
         <p>This is a reminder that the following fee payment is due:</p>
         <table style="border-collapse:collapse; width:100%; margin:16px 0;">
           <tr style="background:#f0f4ff;">
             <td style="padding:12px; border:1px solid #ddd;">Invoice</td>
             <td style="padding:12px; border:1px solid #ddd;"><strong>${invoiceNumber}</strong></td>
           </tr>
           <tr>
             <td style="padding:12px; border:1px solid #ddd;">Amount Due</td>
             <td style="padding:12px; border:1px solid #ddd;"><strong>$${amount.toFixed(2)}</strong></td>
           </tr>
           <tr style="background:#fff3cd;">
             <td style="padding:12px; border:1px solid #ddd;">Due Date</td>
             <td style="padding:12px; border:1px solid #ddd;"><strong>${dueDate}</strong></td>
           </tr>
         </table>
         <p>Please log in to the parent portal to make your payment.</p>`,
        "Fee Payment Reminder"
      ),
    };
  },

  attendanceAlert(parentName: string, studentName: string, date: string, status: string): Omit<EmailOptions, "to"> {
    return {
      subject: `Attendance Alert: ${studentName} — ${date}`,
      html: baseTemplate(
        `<p>Dear <strong>${parentName}</strong>,</p>
         <p>This is to inform you that <strong>${studentName}</strong> was marked <strong>${status}</strong> on <strong>${date}</strong>.</p>
         <p>If you believe this is an error, please contact the class teacher or school office.</p>`,
        "Attendance Alert"
      ),
    };
  },
};
