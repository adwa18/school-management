import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { subjectId, academicYearId, type } = req.query as any;
  const where: any = {};
  if (subjectId) where.subjectId = subjectId;
  if (academicYearId) where.academicYearId = academicYearId;
  if (type) where.type = type;
  const [exams, total] = await Promise.all([
    prisma.exam.findMany({ where, skip, take: limit, include: { subject: { select: { name: true, code: true } }, academicYear: { select: { name: true } } }, orderBy: { startDate: "desc" } }),
    prisma.exam.count({ where }),
  ]);
  sendPaginated(res, exams, buildPaginationMeta(total, page, limit));
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { subject: true, academicYear: true, grades: { select: { studentId: true, marksObtained: true, grade: true } } } });
  if (!exam) { sendNotFound(res, "Exam"); return; }
  sendSuccess(res, exam);
}));

router.post("/", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { name, type, subjectId, academicYearId, classId, startDate, endDate, totalMarks, passingMarks, instructions } = req.body;
  if (!name || !type || !subjectId || !academicYearId || !startDate) { sendBadRequest(res, "Required fields missing"); return; }
  const exam = await prisma.exam.create({
    data: { name, type, subjectId, academicYearId, classId, startDate: new Date(startDate), endDate: new Date(endDate || startDate), totalMarks: totalMarks || 100, passingMarks: passingMarks || 40, instructions },
  });
  sendCreated(res, exam, "Exam created");
}));

router.put("/:id", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { name, startDate, endDate, totalMarks, passingMarks, instructions } = req.body;
  const exam = await prisma.exam.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(startDate && { startDate: new Date(startDate) }), ...(endDate && { endDate: new Date(endDate) }), ...(totalMarks && { totalMarks }), ...(passingMarks && { passingMarks }), ...(instructions && { instructions }) },
  });
  sendSuccess(res, exam, "Exam updated");
}));

export default router;
