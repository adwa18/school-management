import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendBadRequest, sendNotFound } from "../../utils/response";
import { sendEmail, emailTemplates } from "../../utils/email";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const gradeEntrySchema = z.object({
  studentId: z.string().cuid(),
  examId: z.string().cuid(),
  subjectId: z.string().cuid(),
  marksObtained: z.number().min(0).max(1000),
  feedback: z.string().max(500).optional(),
});

const bulkGradeSchema = z.object({
  examId: z.string().cuid(),
  subjectId: z.string().cuid(),
  grades: z.array(z.object({
    studentId: z.string().cuid(),
    marksObtained: z.number().min(0).max(1000),
    feedback: z.string().optional(),
  })).min(1),
});

// ─── Grade Calculation Helpers ────────────────────────────────────────────────

async function calculateLetterGrade(percentage: number): Promise<{ grade: string; gpa: number }> {
  const scale = await prisma.gradeScaleEntry.findMany({
    where: { scale: { isDefault: true } },
    orderBy: { minPercent: "desc" },
  });

  for (const entry of scale) {
    if (percentage >= Number(entry.minPercent) && percentage <= Number(entry.maxPercent)) {
      return { grade: entry.letterGrade, gpa: Number(entry.gpaPoints) };
    }
  }

  return { grade: "F", gpa: 0 };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

const submitGrade = asyncHandler(async (req: Request, res: Response) => {
  const parsed = gradeEntrySchema.safeParse(req.body);
  if (!parsed.success) { sendBadRequest(res, "Validation failed"); return; }

  const { studentId, examId, subjectId, marksObtained, feedback } = parsed.data;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { totalMarks: true, name: true } });
  if (!exam) { sendNotFound(res, "Exam"); return; }

  const percentage = (marksObtained / Number(exam.totalMarks)) * 100;
  const { grade, gpa } = await calculateLetterGrade(percentage);

  const gradeRecord = await prisma.grade.upsert({
    where: { studentId_examId: { studentId, examId } },
    create: { studentId, examId, subjectId, marksObtained, grade, gpa, feedback },
    update: { marksObtained, grade, gpa, feedback },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      subject: { select: { name: true } },
    },
  });

  // Notify student and parents (fire and forget)
  notifyGradePublished(gradeRecord, exam.name).catch(() => {});

  sendCreated(res, { ...gradeRecord, percentage: Math.round(percentage) }, "Grade recorded");
});

async function notifyGradePublished(grade: any, examName: string) {
  const studentEmail = grade.student.user.email;
  const studentName = `${grade.student.user.firstName} ${grade.student.user.lastName}`;

  await sendEmail({
    to: studentEmail,
    ...emailTemplates.gradePublished(studentName, examName, grade.subject.name, grade.grade, grade.marksObtained),
  });
}

const bulkSubmitGrades = asyncHandler(async (req: Request, res: Response) => {
  const parsed = bulkGradeSchema.safeParse(req.body);
  if (!parsed.success) { sendBadRequest(res, "Validation failed"); return; }

  const { examId, subjectId, grades } = parsed.data;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { totalMarks: true } });
  if (!exam) { sendNotFound(res, "Exam"); return; }

  const upsertOperations = await Promise.all(
    grades.map(async (g) => {
      const percentage = (g.marksObtained / Number(exam.totalMarks)) * 100;
      const { grade, gpa } = await calculateLetterGrade(percentage);
      return prisma.grade.upsert({
        where: { studentId_examId: { studentId: g.studentId, examId } },
        create: { studentId: g.studentId, examId, subjectId, marksObtained: g.marksObtained, grade, gpa, feedback: g.feedback },
        update: { marksObtained: g.marksObtained, grade, gpa, feedback: g.feedback },
      });
    })
  );

  const results = await prisma.$transaction(upsertOperations);
  sendCreated(res, { count: results.length }, `${results.length} grades recorded`);
});

const listGrades = asyncHandler(async (req: Request, res: Response) => {
  const { studentId, examId, subjectId, classId } = req.query as any;
  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (examId) where.examId = examId;
  if (subjectId) where.subjectId = subjectId;
  if (classId) where.student = { classId };

  const grades = await prisma.grade.findMany({
    where,
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      exam: { select: { name: true, type: true, totalMarks: true } },
      subject: { select: { name: true, code: true } },
    },
    orderBy: { gradedAt: "desc" },
  });

  sendSuccess(res, grades);
});

/**
 * GET /grades/report-card/:studentId — Full report card for a student
 */
const getReportCard = asyncHandler(async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const { academicYearId } = req.query as any;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      class: { select: { name: true, grade: true, section: true } },
    },
  });
  if (!student) { sendNotFound(res, "Student"); return; }

  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      ...(academicYearId && { exam: { academicYearId } }),
    },
    include: {
      exam: { select: { name: true, type: true, totalMarks: true, startDate: true } },
      subject: { select: { name: true, code: true } },
    },
    orderBy: { gradedAt: "desc" },
  });

  // Group grades by subject
  const subjectMap = new Map<string, any>();
  for (const g of grades) {
    const key = g.subjectId;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subject: g.subject,
        exams: [],
        averageMarks: 0,
        averageGpa: 0,
        letterGrade: "",
      });
    }
    subjectMap.get(key)!.exams.push({
      name: g.exam.name,
      type: g.exam.type,
      totalMarks: Number(g.exam.totalMarks),
      marksObtained: Number(g.marksObtained),
      percentage: Math.round((Number(g.marksObtained) / Number(g.exam.totalMarks)) * 100),
      grade: g.grade,
      gpa: Number(g.gpa),
      date: g.exam.startDate,
    });
  }

  // Calculate subject averages
  const subjects = Array.from(subjectMap.values()).map((s) => {
    const totalMarks = s.exams.reduce((a: number, e: any) => a + e.marksObtained, 0);
    const totalMax = s.exams.reduce((a: number, e: any) => a + e.totalMarks, 0);
    const avgPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
    const avgGpa = s.exams.reduce((a: number, e: any) => a + e.gpa, 0) / (s.exams.length || 1);
    return { ...s, averagePercentage: avgPct, averageGpa: Math.round(avgGpa * 100) / 100 };
  });

  // Overall GPA
  const overallGpa = subjects.length > 0
    ? Math.round((subjects.reduce((a, s) => a + s.averageGpa, 0) / subjects.length) * 100) / 100
    : 0;

  // Attendance summary
  const attendance = await prisma.attendance.groupBy({
    by: ["status"],
    where: { studentId },
    _count: true,
  });
  const attSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  attendance.forEach((a) => { attSummary[a.status] = a._count; });
  const totalDays = Object.values(attSummary).reduce((a, b) => a + b, 0);
  const attendanceRate = totalDays > 0 ? Math.round(((attSummary.PRESENT + attSummary.LATE) / totalDays) * 100) : 0;

  sendSuccess(res, {
    student: {
      id: student.id,
      studentId: student.studentId,
      name: `${student.user.firstName} ${student.user.lastName}`,
      class: student.class,
    },
    overallGpa,
    totalSubjects: subjects.length,
    subjects,
    attendance: { ...attSummary, total: totalDays, rate: attendanceRate },
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /grades/analytics — Class-wide grade analytics
 */
const getClassAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { classId, examId } = req.query as any;
  if (!classId) { sendBadRequest(res, "classId is required"); return; }

  const grades = await prisma.grade.findMany({
    where: {
      student: { classId },
      ...(examId && { examId }),
    },
    include: {
      subject: { select: { name: true } },
      exam: { select: { name: true, totalMarks: true } },
    },
  });

  // Grade distribution
  const distribution = { "A+": 0, A: 0, "A-": 0, "B+": 0, B: 0, "B-": 0, "C+": 0, C: 0, "C-": 0, D: 0, F: 0 };
  grades.forEach((g) => { if (g.grade && g.grade in distribution) (distribution as any)[g.grade]++; });

  const percentages = grades.map((g) => (Number(g.marksObtained) / Number(g.exam.totalMarks)) * 100);
  const average = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const highest = percentages.length > 0 ? Math.round(Math.max(...percentages)) : 0;
  const lowest = percentages.length > 0 ? Math.round(Math.min(...percentages)) : 0;
  const passRate = percentages.length > 0 ? Math.round((percentages.filter((p) => p >= 40).length / percentages.length) * 100) : 0;

  sendSuccess(res, { totalGrades: grades.length, averagePercentage: average, highest, lowest, passRate, distribution });
});

// ─── Router ───────────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get("/", requireAny, listGrades);
router.post("/", requireAdminOrTeacher, submitGrade);
router.post("/bulk", requireAdminOrTeacher, bulkSubmitGrades);
router.get("/report-card/:studentId", requireAny, getReportCard);
router.get("/analytics", requireAdminOrTeacher, getClassAnalytics);

export default router;
