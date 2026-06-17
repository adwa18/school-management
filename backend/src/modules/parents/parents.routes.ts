import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAny } from "../../middleware/auth";
import { sendSuccess, sendNotFound, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const [parents, total] = await Promise.all([
    prisma.parent.findMany({
      skip, take: limit,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        children: { include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } } },
      },
    }),
    prisma.parent.count(),
  ]);
  sendPaginated(res, parents, buildPaginationMeta(total, page, limit));
}));

router.get("/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const parent = await prisma.parent.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      children: {
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              class: { select: { name: true, grade: true } },
            },
          },
        },
      },
    },
  });
  if (!parent) { sendNotFound(res, "Parent"); return; }
  sendSuccess(res, parent);
}));

router.get("/me/children", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const parent = await prisma.parent.findUnique({ where: { userId: req.user!.sub } });
  if (!parent) { sendNotFound(res, "Parent profile"); return; }
  const children = await prisma.parentStudent.findMany({
    where: { parentId: parent.id },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          class: { select: { name: true, grade: true, section: true } },
        },
      },
    },
  });
  sendSuccess(res, children);
}));

export default router;
