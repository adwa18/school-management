"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { reportsApi, attendanceApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users, GraduationCap, School, BookOpen, DollarSign,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  BarChart3, Bell, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#1d4ed8", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

function StatCard({
  label, value, icon: Icon, color, change, changeLabel,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  change?: number;
  changeLabel?: string;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(change)}% {changeLabel ?? "vs last month"}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: dashData, isLoading } = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: () => reportsApi.dashboard().then((r) => r.data.data),
  });

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: attOverview } = useQuery({
    queryKey: ["reports", "attendance-overview"],
    queryFn: () =>
      reportsApi.attendanceOverview({
        startDate: thirtyDaysAgo.toISOString().split("T")[0],
        endDate: today.toISOString().split("T")[0],
      }).then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <DashboardLayout allowedRoles={["ADMIN"]}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const fees = dashData?.fees ?? {};
  const totalRevenue = Object.values(fees).reduce((s: number, f: any) => s + (f?.amount ?? 0), 0);
  const outstanding = (fees.PENDING?.amount ?? 0) + (fees.OVERDUE?.amount ?? 0);

  const attendanceData = dashData?.todayAttendance ?? {};
  const attPieData = [
    { name: "Present", value: attendanceData.PRESENT ?? 0 },
    { name: "Absent", value: attendanceData.ABSENT ?? 0 },
    { name: "Late", value: attendanceData.LATE ?? 0 },
    { name: "Excused", value: attendanceData.EXCUSED ?? 0 },
  ].filter((d) => d.value > 0);

  // Mock weekly attendance for the bar chart (would come from API)
  const weeklyAttendance = [
    { day: "Mon", present: 95, absent: 8 },
    { day: "Tue", present: 98, absent: 5 },
    { day: "Wed", present: 92, absent: 11 },
    { day: "Thu", present: 96, absent: 7 },
    { day: "Fri", present: 90, absent: 13 },
  ];

  return (
    <DashboardLayout allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of your school — {formatDate(new Date())}
          </p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={dashData?.totalStudents ?? 0} icon={GraduationCap} color="bg-blue-100 text-blue-700" change={5} />
          <StatCard label="Total Teachers" value={dashData?.totalTeachers ?? 0} icon={Users} color="bg-green-100 text-green-700" change={2} />
          <StatCard label="Active Classes" value={dashData?.totalClasses ?? 0} icon={School} color="bg-purple-100 text-purple-700" />
          <StatCard label="Library Books" value={dashData?.totalBooks ?? 0} icon={BookOpen} color="bg-amber-100 text-amber-700" />
        </div>

        {/* Financial stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            color="bg-green-100 text-green-700"
            change={8}
          />
          <StatCard
            label="Outstanding Fees"
            value={formatCurrency(outstanding)}
            icon={AlertTriangle}
            color="bg-amber-100 text-amber-700"
          />
          <StatCard
            label="Attendance Rate (30d)"
            value={`${attOverview?.attendanceRate ?? 0}%`}
            icon={CheckCircle}
            color="bg-blue-100 text-blue-700"
            change={attOverview?.attendanceRate ? attOverview.attendanceRate - 90 : 0}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly attendance bar chart */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold">Weekly Attendance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This week's attendance summary</p>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyAttendance} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="present" fill="#1d4ed8" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="#fca5a5" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Today's attendance pie */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Today's Attendance</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {formatDate(new Date())}
            </p>
            {attPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={attPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {attPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No attendance data for today
              </div>
            )}
          </div>
        </div>

        {/* Recent announcements + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent announcements */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Announcements</h3>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {dashData?.recentAnnouncements?.length > 0 ? (
                dashData.recentAnnouncements.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent announcements</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Add Student", href: "/dashboard/admin/students/new", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
                { label: "Add Teacher", href: "/dashboard/admin/teachers/new", color: "bg-green-50 text-green-700 hover:bg-green-100" },
                { label: "Create Exam", href: "/dashboard/admin/exams/new", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
                { label: "Post Announcement", href: "/dashboard/admin/announcements/new", color: "bg-amber-50 text-amber-700 hover:bg-amber-100" },
                { label: "Generate Report", href: "/dashboard/admin/reports", color: "bg-red-50 text-red-700 hover:bg-red-100" },
                { label: "Manage Fees", href: "/dashboard/admin/fees", color: "bg-teal-50 text-teal-700 hover:bg-teal-100" },
              ].map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${action.color}`}
                >
                  {action.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
