import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendBadRequest, sendError } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/class/:classId", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const slots = await prisma.timetableSlot.findMany({
    where: { classId: req.params.classId, timetable: { isActive: true } },
    include: { subject: { select: { name: true, code: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  const days = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"];
  const grid = days.reduce((acc: any, day) => { acc[day] = slots.filter((s) => s.dayOfWeek === day); return acc; }, {});
  sendSuccess(res, { classId: req.params.classId, schedule: grid });
}));

router.get("/teacher/:teacherId", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId: req.params.teacherId, timetable: { isActive: true } },
    include: { subject: { select: { name: true } }, class: { select: { name: true, grade: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  sendSuccess(res, slots);
}));

router.post("/slot", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { timetableId, classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber } = req.body;
  if (!timetableId || !classId || !subjectId || !teacherId || !dayOfWeek || !startTime || !endTime) {
    sendBadRequest(res, "All fields required"); return;
  }
  // Conflict detection
  const [classConflict, teacherConflict] = await Promise.all([
    prisma.timetableSlot.findFirst({ where: { classId, dayOfWeek, startTime } }),
    prisma.timetableSlot.findFirst({ where: { teacherId, dayOfWeek, startTime } }),
  ]);
  if (classConflict) { sendError(res, `Class already has a slot at ${startTime} on ${dayOfWeek}`, 409); return; }
  if (teacherConflict) { sendError(res, `Teacher already has a slot at ${startTime} on ${dayOfWeek}`, 409); return; }
  const slot = await prisma.timetableSlot.create({
    data: { timetableId, classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber },
    include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  sendCreated(res, slot, "Timetable slot added");
}));

router.delete("/slot/:id", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await prisma.timetableSlot.delete({ where: { id: req.params.id } });
  sendSuccess(res, null, "Slot removed");
}));

export default router;
