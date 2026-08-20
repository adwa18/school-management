import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdminOrTeacher, requireAdmin, requireAny } from "../../middleware/auth";
import {
  sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated,
  parsePagination, buildPaginationMeta,
} from "../../utils/response";

// ─── Validation ───────────────────────────────────────────────────────────────
const createStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  classId: z.string().cuid().optional(),
  admissionDate: z.string(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
});

const updateStudentSchema = createStudentSchema.partial().omit({ email: true, password: true });

// ─── Select shape ─────────────────────────────────────────────────────────────
const studentSelect = {
  id: true,
  studentId: true,
  admissionDate: true,
  bloodGroup: true,
  address: true,
  city: true,
  guardianName: true,
  guardianPhone: true,
  medicalNotes: true,
  userId: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
      avatarUrl: true,
      isActive: true,
    },
  },
  class: { select: { id: true, name: true, grade: true, section: true } },
};

// ─── Controllers ──────────────────────────────────────────────────────────────

const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { classId, search, isActive } = req.query as any;

  const where: any = {};
  if (classId) where.classId = classId;
  if (isActive !== undefined) where.user = { isActive: isActive === "true" };
  if (search) {
    where.OR = [
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { studentId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentSelect,
      skip,
      take: limit,
      orderBy: { user: { firstName: "asc" } },
    }),
    prisma.student.count({ where }),
  ]);

  sendPaginated(res, students, buildPaginationMeta(total, page, limit));
});

const getStudent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      ...studentSelect,
      parents: {
        include: {
          parent: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });
  if (!student) { sendNotFound(res, "Student"); return; }
  sendSuccess(res, student);
});

const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    sendBadRequest(res, "Validation failed");
    return;
  }

  const { email, password, firstName, lastName, phone, gender, dateOfBirth, ...studentData } = parsed.data;
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 12);

  const count = await prisma.student.count();
  const studentId = `STU-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  // Use a two-step approach: create user first, then student
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "STUDENT",
      firstName,
      lastName,
      phone,
      gender: gender as any,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    },
  });

  const student = await prisma.student.create({
    data: {
      studentId,
      userId: user.id,
      admissionDate: new Date(studentData.admissionDate),
      bloodGroup: studentData.bloodGroup,
      address: studentData.address,
      city: studentData.city,
      guardianName: studentData.guardianName,
      guardianPhone: studentData.guardianPhone,
      medicalNotes: studentData.medicalNotes,
      classId: studentData.classId,
    },
    select: studentSelect,
  });

  await prisma.notificationPreference.create({ data: { userId: user.id } });

  sendCreated(res, student, "Student created successfully");
});

const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateStudentSchema.safeParse(req.body);
  if (!parsed.success) { sendBadRequest(res, "Validation failed"); return; }

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) { sendNotFound(res, "Student"); return; }

  const { firstName, lastName, phone, gender, dateOfBirth, classId, bloodGroup, address, city, guardianName, guardianPhone, medicalNotes } = parsed.data;

  // Update user fields if provided
  const userUpdateData: any = {};
  if (firstName) userUpdateData.firstName = firstName;
  if (lastName) userUpdateData.lastName = lastName;
  if (phone) userUpdateData.phone = phone;
  if (gender) userUpdateData.gender = gender;
  if (dateOfBirth) userUpdateData.dateOfBirth = new Date(dateOfBirth);

  if (Object.keys(userUpdateData).length > 0) {
    await prisma.user.update({ where: { id: existing.userId }, data: userUpdateData });
  }

  // Update student fields
  const studentUpdateData: any = {};
  if (classId) studentUpdateData.classId = classId;
  if (bloodGroup) studentUpdateData.bloodGroup = bloodGroup;
  if (address) studentUpdateData.address = address;
  if (city) studentUpdateData.city = city;
  if (guardianName) studentUpdateData.guardianName = guardianName;
  if (guardianPhone) studentUpdateData.guardianPhone = guardianPhone;
  if (medicalNotes) studentUpdateData.medicalNotes = medicalNotes;

  const student = await prisma.student.update({
    where: { id },
    data: studentUpdateData,
    select: studentSelect,
  });

  sendSuccess(res, student, "Student updated successfully");
});

const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) { sendNotFound(res, "Student"); return; }
  await prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } });
  sendSuccess(res, null, "Student deactivated successfully");
});

const getStudentAttendanceSummary = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query as any;

  const where: any = { studentId: id };
  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const records = await prisma.attendance.groupBy({
    by: ["status"],
    where,
    _count: true,
  });

  const summary: any = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, total: 0 };
  records.forEach((r) => { summary[r.status] = r._count; summary.total += r._count; });
  const attendanceRate = summary.total > 0
    ? Math.round(((summary.PRESENT + summary.LATE) / summary.total) * 100)
    : 0;

  sendSuccess(res, { ...summary, attendanceRate });
});

const getStudentGrades = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const grades = await prisma.grade.findMany({
    where: { studentId: id },
    include: {
      exam: { select: { name: true, type: true, totalMarks: true } },
      subject: { select: { name: true, code: true } },
    },
    orderBy: { gradedAt: "desc" },
  });
  sendSuccess(res, grades);
});

// ─── Router ───────────────────────────────────────────────────────────────────
const router = Router();
router.use(authenticate);

router.get("/", requireAdminOrTeacher, listStudents);
router.get("/:id", requireAny, getStudent);
router.post("/", requireAdmin, createStudent);
router.put("/:id", requireAdminOrTeacher, updateStudent);
router.delete("/:id", requireAdmin, deleteStudent);
router.get("/:id/attendance-summary", requireAny, getStudentAttendanceSummary);
router.get("/:id/grades", requireAny, getStudentGrades);

export default router;