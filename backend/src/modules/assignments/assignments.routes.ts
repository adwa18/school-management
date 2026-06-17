import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendError, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { subjectId, classId, status, teacherId } = req.query as any;
  const where: any = { status: "PUBLISHED" };
  if (subjectId) where.subjectId = subjectId;
  if (classId) where.classId = classId;
  if (status) where.status = status;
  if (teacherId) where.teacherId = teacherId;
  // Students only see their class assignments
  if (req.user!.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub }, select: { classId: true } });
    if (student?.classId) where.classId = student.classId;
  }
  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({ where, skip, take: limit, orderBy: { dueDate: "asc" }, include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { submissions: true } } } }),
    prisma.assignment.count({ where }),
  ]);
  sendPaginated(res, assignments, buildPaginationMeta(total, page, limit));
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const a = await prisma.assignment.findUnique({
    where: { id: req.params.id },
    include: { subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } }, _count: { select: { submissions: true } } },
  });
  if (!a) { sendNotFound(res, "Assignment"); return; }
  sendSuccess(res, a);
}));

router.post("/", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.sub } });
  if (!teacher && req.user!.role !== "ADMIN") { sendError(res, "Teacher profile required", 403); return; }
  const { title, description, subjectId, classId, dueDate, totalMarks, allowLate, attachments } = req.body;
  if (!title || !description || !subjectId || !dueDate) { sendBadRequest(res, "Required fields missing"); return; }
  const a = await prisma.assignment.create({
    data: { title, description, subjectId, classId, dueDate: new Date(dueDate), totalMarks: totalMarks || 100, allowLate: allowLate || false, attachments: attachments ? JSON.stringify(attachments) : null, teacherId: teacher?.id || (await prisma.teacher.findFirst())!.id, status: "PUBLISHED" },
    include: { subject: { select: { name: true } } },
  });
  sendCreated(res, a, "Assignment created");
}));

// Submit assignment (students)
router.post("/:id/submit", requireAny, asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "STUDENT") { sendError(res, "Only students can submit assignments", 403); return; }
  const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
  if (!student) { sendNotFound(res, "Student profile"); return; }
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) { sendNotFound(res, "Assignment"); return; }
  if (assignment.status !== "PUBLISHED") { sendError(res, "Assignment is not open for submission", 400); return; }
  const isLate = new Date() > assignment.dueDate;
  if (isLate && !assignment.allowLate) { sendError(res, "Submission deadline has passed", 400); return; }
  const { content, attachments } = req.body;
  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: student.id } },
    create: { assignmentId: req.params.id, studentId: student.id, content, attachments: attachments ? JSON.stringify(attachments) : null, status: isLate ? "LATE" : "SUBMITTED" },
    update: { content, attachments: attachments ? JSON.stringify(attachments) : null, submittedAt: new Date(), status: isLate ? "LATE" : "SUBMITTED" },
  });
  sendCreated(res, submission, "Assignment submitted");
}));

// Grade submission
router.put("/:id/submissions/:submissionId/grade", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { marks, feedback } = req.body;
  if (marks === undefined) { sendBadRequest(res, "marks is required"); return; }
  const submission = await prisma.submission.update({
    where: { id: req.params.submissionId },
    data: { marks, feedback, status: "GRADED", gradedAt: new Date() },
  });
  sendSuccess(res, submission, "Submission graded");
}));

// List submissions for an assignment
router.get("/:id/submissions", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const subs = await prisma.submission.findMany({
    where: { assignmentId: req.params.id },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { submittedAt: "desc" },
  });
  sendSuccess(res, subs);
}));

export default router;
