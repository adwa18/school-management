import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── Success Responses ────────────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<T>);
}

export function sendCreated<T>(res: Response, data: T, message = "Created successfully"): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message = "Success"
): Response {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse<T[]>);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

// ─── Error Responses ──────────────────────────────────────────────────────────

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Record<string, string[]>
): Response {
  return res.status(statusCode).json({
    success: false,
    error: message,
    errors,
    timestamp: new Date().toISOString(),
  } satisfies ApiResponse);
}

export function sendNotFound(res: Response, resource = "Resource"): Response {
  return sendError(res, `${resource} not found`, 404);
}

export function sendUnauthorized(res: Response, message = "Unauthorized"): Response {
  return sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = "Forbidden"): Response {
  return sendError(res, message, 403);
}

export function sendBadRequest(
  res: Response,
  message: string,
  errors?: Record<string, string[]>
): Response {
  return sendError(res, message, 400, errors);
}

export function sendConflict(res: Response, message: string): Response {
  return sendError(res, message, 409);
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function parsePagination(query: {
  page?: string;
  limit?: string;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
