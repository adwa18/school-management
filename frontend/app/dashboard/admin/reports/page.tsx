"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { reportsApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, TrendingUp, DollarSign, Users, BarChart3, Loader2 } from "lucide-react";

const COLORS = ["#1d4ed8", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

export default function AdminReportsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  const { data: financial, isLoading: finLoad } = useQuery({
    queryKey: ["reports-financial", dateRange],
    queryFn: () => reportsApi.financial({ startDate: dateRange.start, endDate: dateRange.end }).then((r) => r.data.data),
  });

  const { data: attendance, isLoading: attLoad } = useQuery({
    queryKey: ["reports-attendance", dateRange],
    queryFn: () => reportsApi.attendanceOverview({ startDate: dateRange.start, endDate: dateRange.end }).then((r) => r.data.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["reports-dashboard"],
    queryFn: () => reportsApi.dashboard().then((r) => r.data.data),
  });

  // Mock trend data (in production this comes from API)
  const revenueTrend = [
    { month: "Sep", revenue: 12400, target: 15000 },
    { month: "Oct", revenue: 14200, target: 15000 },
    { month: "Nov", revenue: 13100, target: 15000 },
    { month: "Dec", revenue: 11800, target: 15000 },
    { month: "Jan", revenue: 15600, target: 15000 },
    { month: "Feb", revenue: 16200, target: 15000 },
  ];

  const attendanceTrend = [
    { week: "W1", rate: 94 }, { week: "W2", rate: 91 }, { week: "W3", rate: 96 },
    { week: "W4", rate: 88 }, { week: "W5", rate: 93 }, { week: "W6", rate: 95 },
  ];

  const paymentMethodData = financial?.byMethod
    ? Object.entries(financial.byMethod).map(([method, amount]) => ({ name: method, value: Number(amount) }))
    : [];

  const attPieData = attendance
    ? [
        { name: "Present", value: attendance.PRESENT ?? 0 },
        { name: "Absent", value: attendance.ABSENT ?? 0 },
        { name: "Late", value: attendance.LATE ?? 0 },
        { name: "Excused", value: attendance.EXCUSED ?? 0 },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <DashboardLayout allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1>Analytics & Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">School performance overview</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: formatCurrency(financial?.totalRevenue ?? 0), icon: DollarSign, color: "bg-green-100 text-green-700" },
            { label: "Outstanding", value: formatCurrency(financial?.outstanding ?? 0), icon: TrendingUp, color: "bg-amber-100 text-amber-700" },
            { label: "Attendance Rate", value: `${attendance?.attendanceRate ?? 0}%`, icon: Users, color: "bg-blue-100 text-blue-700" },
            { label: "Transactions", value: financial?.transactionCount ?? 0, icon: BarChart3, color: "bg-purple-100 text-purple-700" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue trend */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Monthly Revenue vs Target</h3>
            <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueTrend} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="#1d4ed8" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Attendance trend */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Attendance Rate Trend</h3>
            <p className="text-xs text-muted-foreground mb-4">Weekly average</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => [`${v}%`, "Rate"]} />
                <Line type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance breakdown */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Attendance Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {formatDate(dateRange.start)} — {formatDate(dateRange.end)}
            </p>
            {attPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={attPieData} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {attPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data for selected range</div>
            )}
          </div>

          {/* Payment methods */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-1">Revenue by Payment Method</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {formatDate(dateRange.start)} — {formatDate(dateRange.end)}
            </p>
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                    {paymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No transactions in selected range</div>
            )}
          </div>
        </div>

        {/* Recent announcements table */}
        {dashboard?.recentAnnouncements?.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/40">
              <h3 className="font-semibold">Recent Announcements</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboard.recentAnnouncements.map((a: any) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{a.title}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
