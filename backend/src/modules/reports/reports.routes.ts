import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin } from "../../middleware/auth";
import { sendSuccess, sendBadRequest } from "../../utils/response";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/dashboard", asyncHandler(async (req: Request, res: Response) => {
  const [totalStudents, totalTeachers, totalClasses, totalBooks] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.book.count(),
  ]);
  const feeStats = await prisma.fee.groupBy({ by: ["status"], _count: true, _sum: { amount: true } });
  const feeMap: any = {};
  feeStats.forEach((f) => { feeMap[f.status] = { count: f._count, amount: Number(f._sum.amount ?? 0) }; });
  const today = new Date(); today.setHours(0,0,0,0);
  const todayAttendance = await prisma.attendance.groupBy({ by: ["status"], where: { date: today }, _count: true });
  const attMap: any = {};
  todayAttendance.forEach((a) => { attMap[a.status] = a._count; });
  const recentAnnouncements = await prisma.announcement.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, title: true, createdAt: true } });
  sendSuccess(res, { totalStudents, totalTeachers, totalClasses, totalBooks, fees: feeMap, todayAttendance: attMap, recentAnnouncements });
}));

router.get("/financial", asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  const where: any = {};
  if (startDate && endDate) where.paidAt = { gte: new Date(startDate), lte: new Date(endDate) };
  const payments = await prisma.payment.findMany({ where, include: { invoice: { select: { invoiceNumber: true, studentId: true } } }, orderBy: { paidAt: "desc" } });
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const byMethod = payments.reduce((acc: any, p) => { acc[p.method] = (acc[p.method] || 0) + Number(p.amount); return acc; }, {});
  const outstanding = await prisma.fee.aggregate({ where: { status: { in: ["PENDING", "OVERDUE"] } }, _sum: { amount: true } });
  sendSuccess(res, { totalRevenue, outstanding: Number(outstanding._sum.amount ?? 0), byMethod, transactionCount: payments.length });
}));

router.get("/attendance-overview", asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  if (!startDate || !endDate) { sendBadRequest(res, "startDate and endDate required"); return; }
  const records = await prisma.attendance.groupBy({
    by: ["status"],
    where: { date: { gte: new Date(startDate), lte: new Date(endDate) } },
    _count: true,
  });
  const total = records.reduce((s, r) => s + r._count, 0);
  const summary: any = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  records.forEach((r) => { summary[r.status] = r._count; });
  const attendanceRate = total > 0 ? Math.round(((summary.PRESENT + summary.LATE) / total) * 100) : 0;
  sendSuccess(res, { ...summary, total, attendanceRate });
}));

export default router;
