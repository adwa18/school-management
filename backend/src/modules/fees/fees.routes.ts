import { Router } from "express";
import asyncHandler from "express-async-handler";
import { z } from "zod";
import { Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAny } from "../../middleware/auth";
import {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendError,
  parsePagination, buildPaginationMeta, sendPaginated,
} from "../../utils/response";
import { config } from "../../config";

const stripe = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

// ─── Schemas ──────────────────────────────────────────────────────────────────
const createFeeSchema = z.object({
  studentId: z.string().cuid(),
  type: z.enum(["TUITION", "TRANSPORT", "LIBRARY", "EXAM", "ACTIVITY", "UNIFORM", "OTHER"]),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  dueDate: z.string(),
  academicYearId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  feeStructureId: z.string().cuid().optional(),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

const listFees = asyncHandler(async (req: Request, res: Response) => {
  const { studentId, status, type } = req.query as any;
  const { page, limit, skip } = parsePagination(req.query as any);
  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (type) where.type = type;

  // Students can only see their own fees
  if (req.user!.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
    if (student) where.studentId = student.id;
  }

  const [fees, total] = await Promise.all([
    prisma.fee.findMany({
      where, skip, take: limit, orderBy: { dueDate: "asc" },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.fee.count({ where }),
  ]);

  sendPaginated(res, fees, buildPaginationMeta(total, page, limit));
});

const createFee = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createFeeSchema.safeParse(req.body);
  if (!parsed.success) { sendBadRequest(res, "Validation failed"); return; }

  const { classId, academicYearId, feeStructureId, studentId, dueDate, amount, ...rest } = parsed.data;
  const fee = await prisma.fee.create({
    data: {
      ...rest,
      amount,
      dueDate: new Date(dueDate),
      student: { connect: { id: studentId } },
      ...(classId && { class: { connect: { id: classId } } }),
      ...(academicYearId && { academicYear: { connect: { id: academicYearId } } }),
      ...(feeStructureId && { feeStructure: { connect: { id: feeStructureId } } }),
    } as any,
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  sendCreated(res, fee, "Fee created");
});

const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { feeId, notes } = req.body;
  if (!feeId) { sendBadRequest(res, "feeId is required"); return; }

  const fee = await prisma.fee.findUnique({
    where: { id: feeId },
    include: { student: { include: { user: true } } },
  });
  if (!fee) { sendNotFound(res, "Fee"); return; }

  // Generate invoice number
  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      studentId: fee.studentId,
      feeId: fee.id,
      amount: fee.amount,
      tax: 0,
      totalAmount: fee.amount,
      dueDate: fee.dueDate,
      notes,
    },
  });

  sendCreated(res, invoice, "Invoice created");
});

const createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  const { invoiceId } = req.body;
  if (!invoiceId) { sendBadRequest(res, "invoiceId is required"); return; }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } },
  });
  if (!invoice) { sendNotFound(res, "Invoice"); return; }
  if (invoice.status === "PAID") { sendError(res, "Invoice is already paid", 400); return; }

  if (!stripe) {
    // Stripe not configured — return mock response for dev
    sendSuccess(res, {
      sessionUrl: `${config.FRONTEND_URL}/fees/payment/mock?invoice=${invoiceId}`,
      mode: "test_stub",
    }, "Stripe not configured — using mock checkout");
    return;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: invoice.student.user.email,
    line_items: [
      {
        price_data: {
          currency: config.STRIPE_CURRENCY,
          product_data: {
            name: `School Fee — ${invoice.invoiceNumber}`,
            description: `Payment for ${invoice.student.user.firstName} ${invoice.student.user.lastName}`,
          },
          unit_amount: Math.round(Number(invoice.totalAmount) * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    metadata: { invoiceId: invoice.id, studentId: invoice.studentId },
    success_url: `${config.FRONTEND_URL}/fees/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.FRONTEND_URL}/fees/payment/cancel?invoice=${invoiceId}`,
  });

  // Store session ID in invoice for webhook lookup
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { stripeSessionId: session.id },
  });

  sendSuccess(res, { sessionUrl: session.url, sessionId: session.id });
});

/**
 * POST /fees/webhook — Stripe webhook to confirm payment
 * Must use raw body (express.raw middleware for this route only)
 */
const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) {
    res.json({ received: true });
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    sendError(res, `Webhook Error: ${err.message}`, 400);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (invoiceId) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date(), stripePaymentId: session.payment_intent as string },
      });

      // Record payment
      await prisma.payment.create({
        data: {
          invoiceId,
          amount: (session.amount_total ?? 0) / 100,
          method: "CARD",
          transactionId: session.payment_intent as string,
        },
      });
    }
  }

  res.json({ received: true });
});

const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
  const { invoiceId, amount, notes } = req.body;
  if (!invoiceId || !amount) { sendBadRequest(res, "invoiceId and amount are required"); return; }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) { sendNotFound(res, "Invoice"); return; }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: "CASH",
        receivedBy: req.user!.sub,
        notes,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    }),
  ]);

  sendSuccess(res, null, "Payment recorded");
});

const getFeeSummary = asyncHandler(async (req: Request, res: Response) => {
  const [pending, paid, overdue, total] = await Promise.all([
    prisma.fee.count({ where: { status: "PENDING" } }),
    prisma.fee.count({ where: { status: "PAID" } }),
    prisma.fee.count({ where: { status: "OVERDUE" } }),
    prisma.fee.count(),
  ]);

  const revenue = await prisma.payment.aggregate({ _sum: { amount: true } });
  const outstanding = await prisma.fee.aggregate({
    where: { status: { in: ["PENDING", "OVERDUE"] } },
    _sum: { amount: true },
  });

  sendSuccess(res, {
    counts: { pending, paid, overdue, total },
    revenue: Number(revenue._sum.amount ?? 0),
    outstanding: Number(outstanding._sum.amount ?? 0),
  });
});

// ─── Router ───────────────────────────────────────────────────────────────────
const router = Router();

// Webhook route needs raw body — register before json middleware in app.ts
router.post("/webhook", stripeWebhook);

router.use(authenticate);
router.get("/", requireAny, listFees);
router.post("/", requireAdmin, createFee);
router.post("/invoice", requireAdmin, createInvoice);
router.post("/checkout", requireAny, createCheckoutSession);
router.post("/payment/cash", requireAdmin, recordCashPayment);
router.get("/summary", requireAdmin, getFeeSummary);

export default router;
