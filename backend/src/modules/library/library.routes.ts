import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAdminOrTeacher, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendError, sendPaginated, parsePagination, buildPaginationMeta } from "../../utils/response";

const router = Router();
router.use(authenticate);

// List books
router.get("/books", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { search, category, available } = req.query as any;
  const where: any = {};
  if (search) where.OR = [{ title: { contains: search, mode: "insensitive" } }, { author: { contains: search, mode: "insensitive" } }, { isbn: { contains: search, mode: "insensitive" } }];
  if (category) where.category = category;
  if (available === "true") where.availableCopies = { gt: 0 };
  const [books, total] = await Promise.all([
    prisma.book.findMany({ where, skip, take: limit, orderBy: { title: "asc" } }),
    prisma.book.count({ where }),
  ]);
  sendPaginated(res, books, buildPaginationMeta(total, page, limit));
}));

// Get book
router.get("/books/:id", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id }, include: { issues: { where: { returnedAt: null }, include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } } } } });
  if (!book) { sendNotFound(res, "Book"); return; }
  sendSuccess(res, book);
}));

// Add book
router.post("/books", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { title, author, isbn, publisher, publishYear, category, totalCopies, location, description } = req.body;
  if (!title || !author || !category) { sendBadRequest(res, "title, author, and category are required"); return; }
  const copies = totalCopies || 1;
  const book = await prisma.book.create({ data: { title, author, isbn, publisher, publishYear: publishYear ? parseInt(publishYear) : undefined, category, totalCopies: copies, availableCopies: copies, location, description } });
  sendCreated(res, book, "Book added to library");
}));

// Issue book
router.post("/issue", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { bookId, studentId, dueDate } = req.body;
  if (!bookId || !studentId || !dueDate) { sendBadRequest(res, "bookId, studentId, dueDate required"); return; }
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) { sendNotFound(res, "Book"); return; }
  if (book.availableCopies <= 0) { sendError(res, "No copies available", 400); return; }
  const existing = await prisma.bookIssue.findFirst({ where: { bookId, studentId, returnedAt: null } });
  if (existing) { sendError(res, "Student already has this book", 400); return; }
  const [issue] = await prisma.$transaction([
    prisma.bookIssue.create({ data: { bookId, studentId, dueDate: new Date(dueDate) }, include: { book: { select: { title: true } }, student: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.book.update({ where: { id: bookId }, data: { availableCopies: { decrement: 1 } } }),
  ]);
  sendCreated(res, issue, "Book issued successfully");
}));

// Return book
router.post("/return/:issueId", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const issue = await prisma.bookIssue.findUnique({ where: { id: req.params.issueId } });
  if (!issue) { sendNotFound(res, "Issue record"); return; }
  if (issue.returnedAt) { sendError(res, "Book already returned", 400); return; }
  const daysOverdue = Math.max(0, Math.floor((Date.now() - issue.dueDate.getTime()) / 86400000));
  const fineAmount = daysOverdue > 0 ? daysOverdue * 0.5 : 0; // $0.50/day fine
  await prisma.$transaction([
    prisma.bookIssue.update({ where: { id: req.params.issueId }, data: { returnedAt: new Date(), fineAmount } }),
    prisma.book.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } }),
  ]);
  sendSuccess(res, { daysOverdue, fineAmount }, "Book returned successfully");
}));

// Active issues
router.get("/issues", requireAdminOrTeacher, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as any);
  const { overdue } = req.query as any;
  const where: any = { returnedAt: null };
  if (overdue === "true") where.dueDate = { lt: new Date() };
  const [issues, total] = await Promise.all([
    prisma.bookIssue.findMany({ where, skip, take: limit, include: { book: { select: { title: true, isbn: true } }, student: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { dueDate: "asc" } }),
    prisma.bookIssue.count({ where }),
  ]);
  sendPaginated(res, issues, buildPaginationMeta(total, page, limit));
}));

export default router;
