import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";
import bcrypt from "bcryptjs";

const router = Router();
router.use(authenticate);

const teacherSelect = {
  id: true, employeeId: true, qualification: true, specialization: true, joiningDate: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, gender: true, avatarUrl: true, isActive: true } },
  classSubjects: { include: { class: { select: { name: true } }, subject: { select: { name: true } } } },
};

router.get("/", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { search } = req.query as any;
  const where: any = {};
  if (search) where.OR = [
    { user: { firstName: { contains: search, mode: "insensitive" } } },
    { user: { lastName: { contains: search, mode: "insensitive" } } },
    { employeeId: { contains: search, mode: "insensitive" } },
  ];
  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({ where, select: teacherSelect, skip, take: limit, orderBy: { user: { firstName: "asc" } } }),
    prisma.teacher.count({ where }),
  ]);
  sendPaginated(res, teachers, buildPaginationMeta(total, page, limit));
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, select: teacherSelect });
  if (!teacher) { sendNotFound(res, "Teacher"); return; }
  sendSuccess(res, teacher);
}));

router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, phone, gender, employeeId, qualification, specialization, joiningDate } = req.body;
  if (!email || !password || !firstName || !lastName) { sendBadRequest(res, "Required fields missing"); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = await prisma.teacher.create({
    data: {
      employeeId: employeeId || `TCH-${Date.now()}`,
      qualification, specialization,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      user: { create: { email, passwordHash, role: "TEACHER", firstName, lastName, phone, gender } },
    },
    select: teacherSelect,
  });
  await prisma.notificationPreference.create({ data: { userId: teacher.user.id } });
  sendCreated(res, teacher, "Teacher created");
}));

router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, phone, qualification, specialization } = req.body;
  const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, "Teacher"); return; }
  const teacher = await prisma.teacher.update({
    where: { id: req.params.id },
    data: {
      ...(qualification && { qualification }),
      ...(specialization && { specialization }),
      ...((firstName || lastName || phone) && { user: { update: { ...(firstName && { firstName }), ...(lastName && { lastName }), ...(phone && { phone }) } } }),
    },
    select: teacherSelect,
  });
  sendSuccess(res, teacher, "Teacher updated");
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, "Teacher"); return; }
  await prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } });
  sendSuccess(res, null, "Teacher deactivated");
}));

export default router;
