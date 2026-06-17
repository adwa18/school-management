"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentsApi, feesApi, announcementsApi, studentsApi } from "@/lib/api";
import { formatCurrency, formatDate, feeStatusColor, attendanceColor } from "@/lib/utils";
import {
  Users, DollarSign, ClipboardCheck, Bell, ArrowRight,
  AlertTriangle, CheckCircle, Loader2, CreditCard,
} from "lucide-react";
import Link from "next/link";

export default function ParentDashboardPage() {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const { data: childrenData, isLoading: childrenLoading } = useQuery({
    queryKey: ["parent-children"],
    queryFn: () => parentsApi.myChildren().then((r) => r.data.data),
  });

  const children = childrenData ?? [];
  const activeChild = selectedChildId
    ? children.find((c: any) => c.student.id === selectedChildId)?.student
    : children[0]?.student;

  const { data: attSummary } = useQuery({
    queryKey: ["child-attendance", activeChild?.id],
    queryFn: () =>
      studentsApi.attendanceSummary(activeChild!.id, {
        startDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      }).then((r) => r.data.data),
    enabled: !!activeChild?.id,
  });

  const { data: fees } = useQuery({
    queryKey: ["parent-fees", activeChild?.id],
    queryFn: () =>
      feesApi.list({ studentId: activeChild!.id, limit: 5 }).then((r) => r.data),
    enabled: !!activeChild?.id,
  });

  const { data: announcements } = useQuery({
    queryKey: ["parent-announcements"],
    queryFn: () => announcementsApi.list({ limit: 4 }).then((r) => r.data.data),
  });

  const pendingFees = fees?.data?.filter((f: any) => ["PENDING", "OVERDUE"].includes(f.status)) ?? [];
  const totalOwed = pendingFees.reduce((sum: number, f: any) => sum + Number(f.amount), 0);

  if (childrenLoading) {
    return (
      <DashboardLayout allowedRoles={["PARENT"]}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={["PARENT"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1>Parent Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor your {children.length === 1 ? "child's" : "children's"} progress and school activities
          </p>
        </div>

        {/* Child selector (if multiple children) */}
        {children.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {children.map((c: any) => (
              <button
                key={c.student.id}
                onClick={() => setSelectedChildId(c.student.id)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  activeChild?.id === c.student.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                  {c.student.user?.firstName?.[0]}
                </div>
                {c.student.user?.firstName} {c.student.user?.lastName}
              </button>
            ))}
          </div>
        )}

        {children.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
            <h3 className="font-semibold text-lg">No children linked</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Contact the school administrator to link your children to your account.
            </p>
          </div>
        ) : (
          <>
            {/* Child info card */}
            {activeChild && (
              <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-primary/10 p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {activeChild.user?.firstName?.[0]}{activeChild.user?.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{activeChild.user?.firstName} {activeChild.user?.lastName}</h2>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                      <span>ID: <span className="font-mono font-medium text-foreground">{activeChild.studentId}</span></span>
                      {activeChild.class && (
                        <span>Class: <span className="font-medium text-foreground">{activeChild.class.name}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Attendance Rate", value: `${attSummary?.attendanceRate ?? 0}%`, icon: ClipboardCheck, color: attSummary?.attendanceRate >= 75 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700", href: "/dashboard/parent/attendance" },
                { label: "Pending Fees", value: formatCurrency(totalOwed), icon: DollarSign, color: totalOwed > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700", href: "/dashboard/parent/fees" },
                { label: "Overdue Fees", value: pendingFees.filter((f: any) => f.status === "OVERDUE").length, icon: AlertTriangle, color: "bg-red-100 text-red-700", href: "/dashboard/parent/fees" },
                { label: "Announcements", value: announcements?.length ?? 0, icon: Bell, color: "bg-blue-100 text-blue-700", href: "/dashboard/parent/announcements" },
              ].map((stat) => (
                <Link key={stat.label} href={stat.href} className="stat-card hover:border-primary/30 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fee overview */}
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Recent Fees</h3>
                  <Link href="/dashboard/parent/fees" className="text-xs text-primary hover:underline">
                    Pay now
                  </Link>
                </div>
                <div className="space-y-3">
                  {fees?.data?.length > 0 ? (
                    fees.data.slice(0, 4).map((fee: any) => (
                      <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{fee.description}</p>
                          <p className="text-xs text-muted-foreground">Due: {formatDate(fee.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(Number(fee.amount))}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${feeStatusColor(fee.status)}`}>
                            {fee.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No outstanding fees</p>
                    </div>
                  )}
                </div>
                {totalOwed > 0 && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="font-semibold">Total Outstanding</span>
                    <span className="text-lg font-bold text-amber-600">{formatCurrency(totalOwed)}</span>
                  </div>
                )}
              </div>

              {/* Announcements */}
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">School Announcements</h3>
                  <Link href="/dashboard/parent/announcements" className="text-xs text-primary hover:underline">View all</Link>
                </div>
                <div className="space-y-3">
                  {announcements?.length > 0 ? (
                    announcements.map((a: any) => (
                      <div key={a.id} className={`p-3 rounded-lg ${a.isPinned ? "bg-blue-50 border border-blue-100" : "bg-muted/30"}`}>
                        {a.isPinned && <span className="text-xs font-semibold text-blue-600">📌 Pinned</span>}
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.publishAt ?? a.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                      <Bell className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No announcements</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance breakdown */}
            {attSummary && (
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Attendance Summary (Last 30 Days)</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeChild?.user?.firstName}'s attendance record</p>
                  </div>
                  <Link href="/dashboard/parent/attendance" className="text-xs text-primary hover:underline">Full report</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Present", value: attSummary.PRESENT, color: "text-green-700 bg-green-50 border-green-200" },
                    { label: "Absent", value: attSummary.ABSENT, color: "text-red-700 bg-red-50 border-red-200" },
                    { label: "Late", value: attSummary.LATE, color: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Excused", value: attSummary.EXCUSED, color: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Rate", value: `${attSummary.attendanceRate}%`, color: attSummary.attendanceRate >= 75 ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200" },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs font-medium mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
