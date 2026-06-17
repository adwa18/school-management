import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}…`;
}

export function gradeColor(grade: string): string {
  if (["A+", "A", "A-"].includes(grade)) return "text-green-600 bg-green-50";
  if (["B+", "B", "B-"].includes(grade)) return "text-blue-600 bg-blue-50";
  if (["C+", "C", "C-"].includes(grade)) return "text-amber-600 bg-amber-50";
  if (grade === "D") return "text-orange-600 bg-orange-50";
  return "text-red-600 bg-red-50";
}

export function attendanceColor(status: string): string {
  switch (status) {
    case "PRESENT": return "text-green-700 bg-green-100";
    case "ABSENT": return "text-red-700 bg-red-100";
    case "LATE": return "text-amber-700 bg-amber-100";
    case "EXCUSED": return "text-blue-700 bg-blue-100";
    default: return "text-gray-700 bg-gray-100";
  }
}

export function feeStatusColor(status: string): string {
  switch (status) {
    case "PAID": return "text-green-700 bg-green-100";
    case "PENDING": return "text-amber-700 bg-amber-100";
    case "OVERDUE": return "text-red-700 bg-red-100";
    case "CANCELLED": return "text-gray-700 bg-gray-100";
    default: return "text-gray-700 bg-gray-100";
  }
}
