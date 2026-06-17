import { Router } from "express";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import prisma from "../../config/database";
import { authenticate, requireAdmin, requireAny } from "../../middleware/auth";
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from "../../utils/response";

const router = Router();
router.use(authenticate);

router.get("/vehicles", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({ include: { routes: { select: { id: true, name: true, _count: { select: { assignments: true } } } } } });
  sendSuccess(res, vehicles);
}));

router.post("/vehicles", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { registrationNo, model, capacity, driverName, driverPhone, driverLicense } = req.body;
  if (!registrationNo || !model || !capacity || !driverName || !driverPhone) { sendBadRequest(res, "Required fields missing"); return; }
  const v = await prisma.vehicle.create({ data: { registrationNo, model, capacity: parseInt(capacity), driverName, driverPhone, driverLicense } });
  sendCreated(res, v, "Vehicle added");
}));

router.get("/routes", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const routes = await prisma.transportRoute.findMany({ where: { isActive: true }, include: { vehicle: { select: { registrationNo: true, model: true, driverName: true } }, _count: { select: { assignments: true } } } });
  sendSuccess(res, routes);
}));

router.post("/routes", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, vehicleId, startPoint, endPoint, stops } = req.body;
  if (!name || !vehicleId || !startPoint || !endPoint) { sendBadRequest(res, "Required fields missing"); return; }
  const route = await prisma.transportRoute.create({ data: { name, description, vehicleId, startPoint, endPoint, stops: stops ? JSON.stringify(stops) : "[]" } });
  sendCreated(res, route, "Route created");
}));

router.post("/assign", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { studentId, routeId, type, pickupStop, dropStop, startDate } = req.body;
  if (!studentId || !routeId || !startDate) { sendBadRequest(res, "studentId, routeId, startDate required"); return; }
  const assignment = await prisma.transportAssignment.upsert({
    where: { studentId_routeId: { studentId, routeId } },
    create: { studentId, routeId, type: type || "BOTH", pickupStop, dropStop, startDate: new Date(startDate) },
    update: { type: type || "BOTH", pickupStop, dropStop, isActive: true },
  });
  sendCreated(res, assignment, "Transport assigned");
}));

router.get("/assignments/:studentId", requireAny, asyncHandler(async (req: Request, res: Response) => {
  const assignments = await prisma.transportAssignment.findMany({
    where: { studentId: req.params.studentId, isActive: true },
    include: { route: { include: { vehicle: { select: { registrationNo: true, model: true, driverName: true, driverPhone: true } } } } },
  });
  sendSuccess(res, assignments);
}));

export default router;
