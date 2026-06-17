import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

// Inbox
router.get("/inbox", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const [messages, total] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: { userId: req.user!.sub, deletedAt: null },
      skip, take: limit,
      include: { message: { include: { sender: { select: { firstName: true, lastName: true, role: true, avatarUrl: true } } } } },
      orderBy: { message: { createdAt: "desc" } },
    }),
    prisma.messageRecipient.count({ where: { userId: req.user!.sub, deletedAt: null } }),
  ]);
  sendPaginated(res, messages, buildPaginationMeta(total, page, limit));
}));

// Unread count
router.get("/unread-count", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const count = await prisma.messageRecipient.count({ where: { userId: req.user!.sub, isRead: false, deletedAt: null } });
  sendSuccess(res, { count });
}));

// Send message
router.post("/", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { recipientIds, subject, body, type } = req.body;
  if (!recipientIds?.length || !body) { sendBadRequest(res, "recipientIds and body are required"); return; }
  const message = await prisma.message.create({
    data: {
      senderId: req.user!.sub,
      subject, body,
      type: type || "DIRECT",
      recipients: { create: recipientIds.map((userId: string) => ({ userId })) },
    },
    include: { recipients: { select: { userId: true } } },
  });
  sendCreated(res, message, "Message sent");
}));

// Mark as read
router.patch("/:id/read", requireAny, asyncHandler(async (req: Request, res: Response) => {
  await prisma.messageRecipient.updateMany({
    where: { messageId: req.params.id, userId: req.user!.sub },
    data: { isRead: true, readAt: new Date() },
  });
  sendSuccess(res, null, "Marked as read");
}));

// Delete (soft)
router.delete("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  await prisma.messageRecipient.updateMany({
    where: { messageId: req.params.id, userId: req.user!.sub },
    data: { deletedAt: new Date() },
  });
  sendSuccess(res, null, "Message deleted");
}));

// Reply
router.post("/:id/reply", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const original = await prisma.message.findUnique({ where: { id: req.params.id }, include: { recipients: true } });
  if (!original) { sendNotFound(res, "Message"); return; }
  const { body } = req.body;
  if (!body) { sendBadRequest(res, "body is required"); return; }
  // Reply goes to original sender
  const reply = await prisma.message.create({
    data: { senderId: req.user!.sub, body, type: "DIRECT", parentId: req.params.id, recipients: { create: [{ userId: original.senderId }] } },
  });
  sendCreated(res, reply, "Reply sent");
}));

export default router;
