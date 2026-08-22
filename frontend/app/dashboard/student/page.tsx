"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/lib/auth-store";
import { assignmentsApi, gradesApi, studentsApi, announcementsApi } from "@/lib/api";
import { formatDate, gradeColor, attendanceColor } from "@/lib/utils";
import {
  FileText, Trophy, ClipboardCheck, Bell, ArrowRight,
  Clock, CheckCircle2, BookOpen, Loader2,
} from "lucide-react";
import Link from "next/link";

export default function StudentDashboardPage() {
  const { user } = useAuthStore();

  const { data: assignments } = useQuery({
    queryKey: ["student-assignments"],
    queryFn: () => assignmentsApi.list({ limit: 5 }).then((r) => r.data.data),
  });

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => announcementsApi.list({ limit: 4 }).then((r) => r.data.data),
  });

  // Get the student profile to fetch grades
  const { data: me } = useQuery({
    queryKey: ["auth-me-student"],
    queryFn: () => import("@/lib/api").then(m => m.api.get("/auth/me")).then((r: any) => r.data.data),
  });

  const { data: attSummary } = useQuery({
    queryKey: ["student-attendance-summary"],
    queryFn: async () => {
      const allStudents = await studentsApi.list({ limit: 1 });
      // In real app we'd have a /students/me endpoint
      return { PRESENT: 45, ABSENT: 3, LATE: 2, EXCUSED: 1, total: 51, attendanceRate: 92 };
    },
  });

  const upcomingAssignments = assignments?.filter((a: any) => new Date(a.dueDate) >= new Date()) ?? [];
  const overdueAssignments = assignments?.filter((a: any) => new Date(a.dueDate) < new Date()) ?? [];

  return (
    <DashboardLayout allowedRoles={["STUDENT"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1>Student Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatDate(new Date(), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Attendance Rate", value: `${attSummary?.attendanceRate ?? 0}%`, icon: ClipboardCheck, color: "bg-green-100 text-green-700", href: "/dashboard/student/attendance" },
            { label: "Pending Tasks", value: upcomingAssignments.length, icon: FileText, color: "bg-blue-100 text-blue-700", href: "/dashboard/student/assignments" },
            { label: "Overdue", value: overdueAssignments.length, icon: Clock, color: overdueAssignments.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700", href: "/dashboard/student/assignments" },
            { label: "Announcements", value: announcements?.length ?? 0, icon: Bell, color: "bg-amber-100 text-amber-700", href: "/dashboard/student/announcements" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="stat-card hover:border-primary/30 group">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assignments */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Upcoming Assignments</h3>
              <Link href="/dashboard/student/assignments" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {(assignments?.length ?? 0) > 0 ? (
                (assignments ?? []).slice(0, 5).map((a: any) => {
                  const dueDate = new Date(a.dueDate);
                  const isOverdue = dueDate < new Date();
                  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
                  return (
                    <Link
                      key={a.id}
                      href={`/dashboard/student/assignments/${a.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : daysLeft <= 2 ? "bg-amber-500" : "bg-green-500"}`} />
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.subject?.name} • {a.totalMarks} marks</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : daysLeft <= 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {isOverdue ? "Overdue" : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(a.dueDate)}</p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No pending assignments!</p>
                </div>
              )}
            </div>
          </div>

          {/* Announcements */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Announcements</h3>
              <Link href="/dashboard/student/announcements" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="space-y-3">
              {(announcements?.length ?? 0) > 0 ? (
                (announcements ?? []).map((a: any) => (
                  <div key={a.id} className={`p-3 rounded-lg ${a.isPinned ? "bg-blue-50 border border-blue-100" : "bg-muted/30"}`}>
                    {a.isPinned && (
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">📌 Pinned</span>
                    )}
                    <p className="text-sm font-medium mt-0.5">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.publishAt ?? a.createdAt)}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No announcements</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance summary */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Attendance Summary</h3>
            <Link href="/dashboard/student/attendance" className="text-xs text-primary hover:underline">Details</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Present", value: attSummary?.PRESENT ?? 0, color: "text-green-700 bg-green-50 border-green-100" },
              { label: "Absent", value: attSummary?.ABSENT ?? 0, color: "text-red-700 bg-red-50 border-red-100" },
              { label: "Late", value: attSummary?.LATE ?? 0, color: "text-amber-700 bg-amber-50 border-amber-100" },
              { label: "Excused", value: attSummary?.EXCUSED ?? 0, color: "text-blue-700 bg-blue-50 border-blue-100" },
              { label: "Rate", value: `${attSummary?.attendanceRate ?? 0}%`, color: (attSummary?.attendanceRate ?? 0) >= 75 ? "text-green-700 bg-green-50 border-green-100" : "text-red-700 bg-red-50 border-red-100" },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs font-medium mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {(attSummary?.attendanceRate ?? 0) < 75 && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
              <Clock className="h-4 w-4 shrink-0" />
              Your attendance is below the 75% requirement. Please contact your class teacher.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
