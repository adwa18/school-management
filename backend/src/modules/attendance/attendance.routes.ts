import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import {
  sendSuccess, sendCreated, sendBadRequest, sendError,
  parsePagination, buildPaginationMeta, sendPaginated,
} from "../../utils/response";
import { sendEmail, emailTemplates } from "../../utils/email";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const markAttendanceSchema = z.object({
  classId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  records: z.array(
    z.object({
      studentId: z.string().cuid(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      note: z.string().optional(),
    })
  ).min(1, "At least one attendance record is required"),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /attendance — Mark attendance for an entire class on a date.
 * Upserts records so re-submission on same date overwrites.
 */
const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const parsed = markAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => { const f = e.path.join("."); errors[f] = [...(errors[f] ?? []), e.message]; });
    sendBadRequest(res, "Validation failed", errors);
    return;
  }

  const { classId, date, records } = parsed.data;
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.sub } });

  if (!teacher && req.user!.role !== "ADMIN") {
    sendError(res, "Teacher profile not found", 403);
    return;
  }

  // Verify students belong to the class
  const studentIds = records.map((r) => r.studentId);
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, classId },
    select: { id: true },
  });

  if (validStudents.length !== studentIds.length) {
    sendBadRequest(res, "Some students do not belong to this class");
    return;
  }

  // Upsert attendance records
  const attendanceDate = new Date(date);
  const markerId = teacher?.id ?? (await prisma.teacher.findFirst())!.id;

  const results = await prisma.$transaction(
    records.map((record) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: record.studentId, date: attendanceDate } },
        create: {
          studentId: record.studentId,
          classId,
          date: attendanceDate,
          status: record.status,
          markedById: markerId,
          note: record.note,
        },
        update: {
          status: record.status,
          note: record.note,
          markedById: markerId,
        },
      })
    )
  );

  // Send absence notifications to parents (fire-and-forget)
  const absentStudentIds = records.filter((r) => r.status === "ABSENT").map((r) => r.studentId);
  if (absentStudentIds.length > 0) {
    notifyParentsOfAbsence(absentStudentIds, date).catch(() => {});
  }

  sendCreated(res, { count: results.length, date }, `Attendance marked for ${results.length} students`);
});

async function notifyParentsOfAbsence(studentIds: string[], date: string) {
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: { select: { firstName: true, lastName: true } },
      parents: {
        include: {
          parent: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        },
      },
    },
  });

  for (const student of students) {
    const studentName = `${student.user.firstName} ${student.user.lastName}`;
    for (const ps of student.parents) {
      const parentName = `${ps.parent.user.firstName} ${ps.parent.user.lastName}`;
      await sendEmail({
        to: ps.parent.user.email,
        ...emailTemplates.attendanceAlert(parentName, studentName, date, "ABSENT"),
      }).catch(() => {});
    }
  }
}

/**
 * GET /attendance — List attendance records with filters
 */
const listAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { classId, studentId, date, startDate, endDate, status } = req.query as any;
  const { page, limit, skip } = parsePagination(req.query as any);

  const where: any = {};
  if (classId) where.classId = classId;
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (date) where.date = new Date(date);
  else if (startDate && endDate) where.date = { gte: new Date(startDate), lte: new Date(endDate) };

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        class: { select: { name: true } },
        markedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      skip, take: limit, orderBy: { date: "desc" },
    }),
    prisma.attendance.count({ where }),
  ]);

  sendPaginated(res, records, buildPaginationMeta(total, page, limit));
});

/**
 * GET /attendance/report — Aggregated attendance report for a class/period
 */
const getAttendanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { classId, startDate, endDate } = req.query as any;

  if (!classId || !startDate || !endDate) {
    sendBadRequest(res, "classId, startDate, and endDate are required");
    return;
  }

  // Get all students in class
  const students = await prisma.student.findMany({
    where: { classId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      classId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: { studentId: true, status: true, date: true },
  });

  // Count unique school days
  const uniqueDates = new Set(attendanceRecords.map((r) => r.date.toISOString().split("T")[0]));
  const totalSchoolDays = uniqueDates.size;

  // Aggregate per student
  const report = students.map((student) => {
    const records = attendanceRecords.filter((r) => r.studentId === student.id);
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    records.forEach((r) => counts[r.status]++);
    const attended = counts.PRESENT + counts.LATE;
    const rate = totalSchoolDays > 0 ? Math.round((attended / totalSchoolDays) * 100) : 0;

    return {
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      ...counts,
      totalDays: totalSchoolDays,
      attendanceRate: rate,
      isAtRisk: rate < 75,
    };
  });

  const summary = {
    totalStudents: students.length,
    totalSchoolDays,
    averageAttendanceRate: Math.round(report.reduce((acc, r) => acc + r.attendanceRate, 0) / (report.length || 1)),
    atRiskStudents: report.filter((r) => r.isAtRisk).length,
    period: { startDate, endDate },
  };

  sendSuccess(res, { summary, students: report });
});

/**
 * GET /attendance/class/:classId/today — Quick view for today
 */
const getTodayAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { classId } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { classId },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.attendance.findMany({
      where: { classId, date: today },
      select: { studentId: true, status: true, note: true },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.studentId, r]));

  const result = students.map((s) => ({
    studentId: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    avatarUrl: s.user.avatarUrl,
    attendance: recordMap.get(s.id) ?? null,
  }));

  sendSuccess(res, {
    classId,
    date: today.toISOString().split("T")[0],
    totalStudents: students.length,
    marked: records.length,
    isComplete: records.length === students.length,
    students: result,
  });
});

// ─── Router ───────────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get("/", requireAny, listAttendance);
router.post("/", requireAdminOrTeacher, markAttendance);
router.get("/report", requireAdminOrTeacher, getAttendanceReport);
router.get("/class/:classId/today", requireAdminOrTeacher, getTodayAttendance);

export default router;
