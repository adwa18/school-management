import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { config } from "./config";
import { morganStream } from "./utils/logger";
import { errorHandler, notFoundHandler, rateLimitHandler } from "./middleware/errorHandler";

// Route imports
import authRoutes from "./modules/auth/auth.routes";
import studentRoutes from "./modules/students/students.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import gradeRoutes from "./modules/grades/grades.routes";
import feeRoutes from "./modules/fees/fees.routes";

// Lazy-loaded module routes (scaffolded, implementation in respective files)
import teacherRoutes from "./modules/teachers/teachers.routes";
import parentRoutes from "./modules/parents/parents.routes";
import classRoutes from "./modules/classes/classes.routes";
import subjectRoutes from "./modules/subjects/subjects.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";
import examRoutes from "./modules/exams/exams.routes";
import libraryRoutes from "./modules/library/library.routes";
import transportRoutes from "./modules/transport/transport.routes";
import assignmentRoutes from "./modules/assignments/assignments.routes";
import announcementRoutes from "./modules/announcements/announcements.routes";
import messageRoutes from "./modules/messages/messages.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import reportRoutes from "./modules/reports/reports.routes";

const app = express();

// ─── Security Headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Handled by frontend
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [config.FRONTEND_URL, "http://localhost:3000"],
    credentials: true, // Required for httpOnly cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.path === "/api/v1/fees/webhook", // Webhook needs no rate limit
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter for auth endpoints
  message: "Too many login attempts",
  handler: rateLimitHandler,
});

app.use(limiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
// Raw body for Stripe webhook MUST come before json()
app.use("/api/v1/fees/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan("combined", { stream: morganStream }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "school-mgmt-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

app.get("/", (_req, res) => {
  res.json({ message: "School Management System API", version: "1.0.0", docs: "/api/v1/docs" });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = config.API_PREFIX;

app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/students`, studentRoutes);
app.use(`${API}/teachers`, teacherRoutes);
app.use(`${API}/parents`, parentRoutes);
app.use(`${API}/classes`, classRoutes);
app.use(`${API}/subjects`, subjectRoutes);
app.use(`${API}/attendance`, attendanceRoutes);
app.use(`${API}/timetable`, timetableRoutes);
app.use(`${API}/exams`, examRoutes);
app.use(`${API}/grades`, gradeRoutes);
app.use(`${API}/fees`, feeRoutes);
app.use(`${API}/library`, libraryRoutes);
app.use(`${API}/transport`, transportRoutes);
app.use(`${API}/assignments`, assignmentRoutes);
app.use(`${API}/announcements`, announcementRoutes);
app.use(`${API}/messages`, messageRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/reports`, reportRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
