import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { classId } = req.query as any;
  const role = req.user!.role as any;
  const where: any = { targetRoles: { has: role }, publishAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  if (classId) where.classId = classId;
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({ where, skip, take: limit, orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }], include: { author: { select: { firstName: true, lastName: true, role: true } }, class: { select: { name: true } } } }),
    prisma.announcement.count({ where }),
  ]);
  sendPaginated(res, announcements, buildPaginationMeta(total, page, limit));
}));

router.post("/", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { title, content, classId, targetRoles, isPinned, publishAt, expiresAt } = req.body;
  if (!title || !content || !targetRoles?.length) { sendBadRequest(res, "title, content, targetRoles required"); return; }
  const announcement = await prisma.announcement.create({
    data: { title, content, classId, targetRoles, isPinned: isPinned || false, publishAt: publishAt ? new Date(publishAt) : new Date(), expiresAt: expiresAt ? new Date(expiresAt) : null, authorId: req.user!.sub },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  sendCreated(res, announcement, "Announcement published");
}));

router.put("/:id", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { title, content, isPinned, expiresAt } = req.body;
  const a = await prisma.announcement.update({ where: { id: req.params.id }, data: { ...(title && { title }), ...(content && { content }), ...(isPinned !== undefined && { isPinned }), ...(expiresAt && { expiresAt: new Date(expiresAt) }) } });
  sendSuccess(res, a, "Announcement updated");
}));

router.delete("/:id", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  sendSuccess(res, null, "Announcement deleted");
}));

export default router;
