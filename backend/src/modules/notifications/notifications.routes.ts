import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAny } from "../../middleware/auth";
import { sendSuccess, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { unread } = req.query as any;
  const where: any = { userId: req.user!.sub };
  if (unread === "true") where.isRead = false;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where }),
  ]);
  sendPaginated(res, notifications, buildPaginationMeta(total, page, limit));
}));

router.patch("/read-all", requireAny, asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.sub, isRead: false }, data: { isRead: true, readAt: new Date() } });
  sendSuccess(res, null, "All notifications marked as read");
}));

router.patch("/:id/read", requireAny, asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true, readAt: new Date() } });
  sendSuccess(res, null, "Notification marked as read");
}));

router.get("/preferences", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: req.user!.sub } });
  sendSuccess(res, prefs);
}));

router.put("/preferences", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { email, sms, push, inApp, gradePosted, attendanceAlert, feeReminder, assignmentPosted, announcement, messageReceived } = req.body;
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: req.user!.sub },
    create: { userId: req.user!.sub, email, sms, push, inApp, gradePosted, attendanceAlert, feeReminder, assignmentPosted, announcement, messageReceived },
    update: { email, sms, push, inApp, gradePosted, attendanceAlert, feeReminder, assignmentPosted, announcement, messageReceived },
  });
  sendSuccess(res, prefs, "Preferences updated");
}));

export default router;
