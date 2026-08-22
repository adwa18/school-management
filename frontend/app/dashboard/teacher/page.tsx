"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/lib/auth-store";
import { classesApi, assignmentsApi, attendanceApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  ClipboardCheck, FileText, Users, Calendar, ArrowRight,
  CheckCircle, Clock, AlertCircle, Loader2,
} from "lucide-react";
import Link from "next/link";

function QuickStatCard({ label, value, icon: Icon, color, href }: { label: string; value: string | number; icon: any; color: string; href: string }) {
  return (
    <Link href={href} className="stat-card hover:border-primary/30 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </Link>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuthStore();

  const { data: myClasses } = useQuery({
    queryKey: ["teacher-classes"],
    queryFn: () => classesApi.list({ limit: 10 }).then((r) => r.data.data),
  });

  const { data: myAssignments } = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: () => assignmentsApi.list({ limit: 5 }).then((r) => r.data.data),
  });

  const today = new Date().toISOString().split("T")[0];

  // For today's attendance — check the first class
  const firstClass = myClasses?.[0];
  const { data: todayAtt } = useQuery({
    queryKey: ["today-attendance", firstClass?.id],
    queryFn: () => attendanceApi.todayForClass(firstClass!.id).then((r) => r.data.data),
    enabled: !!firstClass?.id,
  });

  return (
    <DashboardLayout allowedRoles={["TEACHER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1>Teacher Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{formatDate(new Date(), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatCard label="My Classes" value={myClasses?.length ?? 0} icon={Users} color="bg-blue-100 text-blue-700" href="/dashboard/teacher/classes" />
          <QuickStatCard label="Active Assignments" value={myAssignments?.length ?? 0} icon={FileText} color="bg-green-100 text-green-700" href="/dashboard/teacher/assignments" />
          <QuickStatCard label="Pending Grading" value={myAssignments?.filter((a: any) => a._count?.submissions > 0).length ?? 0} icon={ClipboardCheck} color="bg-amber-100 text-amber-700" href="/dashboard/teacher/grades" />
          <QuickStatCard label="Today's Sessions" value={3} icon={Calendar} color="bg-purple-100 text-purple-700" href="/dashboard/teacher/timetable" />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's attendance status */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Today's Attendance</h3>
              {firstClass && (
                <Link href="/dashboard/teacher/attendance" className="text-xs text-primary hover:underline">
                  Mark Attendance
                </Link>
              )}
            </div>
            {todayAtt ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{todayAtt.classId && "Grade 10A"}</span>
                  <span className={`flex items-center gap-1 font-medium ${todayAtt.isComplete ? "text-green-600" : "text-amber-600"}`}>
                    {todayAtt.isComplete ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    {todayAtt.isComplete ? "Complete" : `${todayAtt.marked}/${todayAtt.totalStudents} marked`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    { label: "Present", value: todayAtt.students?.filter((s: any) => s.attendance?.status === "PRESENT").length ?? 0, color: "text-green-600 bg-green-50" },
                    { label: "Absent", value: todayAtt.students?.filter((s: any) => s.attendance?.status === "ABSENT").length ?? 0, color: "text-red-600 bg-red-50" },
                    { label: "Late", value: todayAtt.students?.filter((s: any) => s.attendance?.status === "LATE").length ?? 0, color: "text-amber-600 bg-amber-50" },
                    { label: "Unmarked", value: todayAtt.totalStudents - todayAtt.marked, color: "text-gray-600 bg-gray-50" },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-lg p-3 text-center ${item.color}`}>
                      <p className="text-xl font-bold">{item.value}</p>
                      <p className="text-xs font-medium">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <ClipboardCheck className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No attendance data yet</p>
              </div>
            )}
          </div>

          {/* Recent assignments */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Assignments</h3>
              <Link href="/dashboard/teacher/assignments" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {(myAssignments?.length ?? 0) > 0 ? (
                (myAssignments ?? []).slice(0, 4).map((a: any) => {
                  const isOverdue = new Date(a.dueDate) < new Date();
                  return (
                    <Link
                      key={a.id}
                      href={`/dashboard/teacher/assignments/${a.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-green-500"}`} />
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.subject?.name} • Due {formatDate(a.dueDate)}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {a._count?.submissions ?? 0} submissions
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No assignments yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* My classes table */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Classes</h3>
            <Link href="/dashboard/teacher/classes" className="text-xs text-primary hover:underline">
              View schedule
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Class</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Students</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myClasses?.slice(0, 5).map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{c.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {c.subjects?.map((s: any) => s.subject?.name).join(", ") ?? "—"}
                    </td>
                    <td className="py-3 pr-4">{c._count?.students ?? 0} students</td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/dashboard/teacher/attendance?classId=${c.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark Attendance
                      </Link>
                    </td>
                  </tr>
                )) ?? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No classes assigned
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
