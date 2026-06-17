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
  const { academicYearId } = req.query as any;
  const where: any = {};
  if (academicYearId) where.academicYearId = academicYearId;
  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where, skip, take: limit, orderBy: [{ grade: "asc" }, { section: "asc" }],
      include: {
        classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        academicYear: { select: { name: true } },
        _count: { select: { students: true, subjects: true } },
      },
    }),
    prisma.class.count({ where }),
  ]);
  sendPaginated(res, classes, buildPaginationMeta(total, page, limit));
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const c = await prisma.class.findUnique({
    where: { id: req.params.id },
    include: {
      classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      subjects: { include: { subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      students: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } }, take: 5 },
      _count: { select: { students: true } },
    },
  });
  if (!c) { sendNotFound(res, "Class"); return; }
  sendSuccess(res, c);
}));

router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, grade, section, capacity, academicYearId, classTeacherId } = req.body;
  if (!name || !grade || !section || !academicYearId) { sendBadRequest(res, "Required fields missing"); return; }
  const c = await prisma.class.create({
    data: { name, grade: parseInt(grade), section, capacity: capacity || 40, academicYearId, classTeacherId },
  });
  sendCreated(res, c, "Class created");
}));

router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, capacity, classTeacherId } = req.body;
  const c = await prisma.class.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(capacity && { capacity: parseInt(capacity) }), ...(classTeacherId && { classTeacherId }) },
  });
  sendSuccess(res, c, "Class updated");
}));

router.get("/:id/students", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const students = await prisma.student.findMany({
    where: { classId: req.params.id },
    include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true, gender: true } } },
    orderBy: { user: { firstName: "asc" } },
  });
  sendSuccess(res, students);
}));

export default router;
