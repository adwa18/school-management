import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" } });
  sendSuccess(res, subjects);
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const s = await prisma.subject.findUnique({ where: { id: req.params.id }, include: { classSubjects: { include: { class: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } } });
  if (!s) { sendNotFound(res, "Subject"); return; }
  sendSuccess(res, s);
}));

router.post("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, code, description, creditHours, isElective } = req.body;
  if (!name || !code) { sendBadRequest(res, "Name and code are required"); return; }
  const s = await prisma.subject.create({ data: { name, code, description, creditHours: creditHours || 3, isElective: isElective || false } });
  sendCreated(res, s, "Subject created");
}));

router.put("/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, creditHours, isElective } = req.body;
  const s = await prisma.subject.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(description && { description }), ...(creditHours && { creditHours: parseInt(creditHours) }), ...(isElective !== undefined && { isElective }) },
  });
  sendSuccess(res, s, "Subject updated");
}));

export default router;
