"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { feesApi, studentsApi } from "@/lib/api";
import { formatCurrency, formatDate, feeStatusColor } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  DollarSign, Plus, Search, ChevronLeft, ChevronRight,
  Receipt, CheckCircle, AlertTriangle, Clock, Loader2, X,
} from "lucide-react";

const FEE_TYPES = ["TUITION", "TRANSPORT", "LIBRARY", "EXAM", "ACTIVITY", "UNIFORM", "OTHER"];

export default function AdminFeesPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    studentId: "", type: "TUITION", description: "", amount: "", dueDate: "",
  });
  const [studentSearch, setStudentSearch] = useState("");

  const { data: feesData, isLoading } = useQuery({
    queryKey: ["admin-fees", page, statusFilter],
    queryFn: () =>
      feesApi.list({ page, limit: 20, ...(statusFilter !== "all" && { status: statusFilter }) })
        .then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ["fees-summary"],
    queryFn: () => feesApi.summary().then((r) => r.data.data),
  });

  const { data: students } = useQuery({
    queryKey: ["students-search", studentSearch],
    queryFn: () => studentsApi.list({ search: studentSearch, limit: 10 }).then((r) => r.data.data),
    enabled: studentSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => feesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fees"] });
      queryClient.invalidateQueries({ queryKey: ["fees-summary"] });
      success("Fee created", "Fee has been added to the student's account");
      setShowCreate(false);
      setForm({ studentId: "", type: "TUITION", description: "", amount: "", dueDate: "" });
    },
    onError: () => error("Failed to create fee", "Please check the form and try again"),
  });

  const handleCreate = () => {
    if (!form.studentId || !form.description || !form.amount || !form.dueDate) {
      error("Missing fields", "All fields are required");
      return;
    }
    createMutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const fees = feesData?.data ?? [];
  const meta = feesData?.meta;

  return (
    <DashboardLayout allowedRoles={["ADMIN"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Fee Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {meta?.total ?? 0} total fee records
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Fee
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: formatCurrency(summary?.revenue ?? 0), icon: DollarSign, color: "bg-green-100 text-green-700" },
            { label: "Outstanding", value: formatCurrency(summary?.outstanding ?? 0), icon: Clock, color: "bg-amber-100 text-amber-700" },
            { label: "Pending Fees", value: summary?.counts?.PENDING ?? 0, icon: AlertTriangle, color: "bg-blue-100 text-blue-700" },
            { label: "Paid Fees", value: summary?.counts?.PAID ?? 0, icon: CheckCircle, color: "bg-green-100 text-green-700" },
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

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {["all", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
                statusFilter === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : fees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <DollarSign className="h-10 w-10 mb-2 opacity-20" />
              <p>No fees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Student", "Description", "Type", "Amount", "Due Date", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fees.map((fee: any) => (
                    <tr key={fee.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {fee.student?.user?.firstName} {fee.student?.user?.lastName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-40 truncate">{fee.description}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{fee.type}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(fee.amount))}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(fee.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${feeStatusColor(fee.status)}`}>
                          {fee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {["PENDING", "OVERDUE"].includes(fee.status) && (
                          <button
                            onClick={async () => {
                              try {
                                const inv = await feesApi.createInvoice(fee.id);
                                success("Invoice created", `Invoice ${inv.data.data.invoiceNumber}`);
                                queryClient.invalidateQueries({ queryKey: ["admin-fees"] });
                              } catch { error("Error", "Could not create invoice"); }
                            }}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Receipt className="h-3 w-3" /> Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={!meta.hasPrev}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasNext}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Create Fee Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">Create New Fee</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Student search */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Student</label>
                  <input
                    type="text"
                    placeholder="Search student by name or ID…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {students && students.length > 0 && !form.studentId && (
                    <div className="mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
                      {students.map((s: any) => (
                        <button
                          key={s.id}
                          onClick={() => { setForm(f => ({ ...f, studentId: s.id })); setStudentSearch(`${s.user.firstName} ${s.user.lastName} (${s.studentId})`); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        >
                          {s.user.firstName} {s.user.lastName} — {s.studentId} — {s.class?.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fee type */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Fee Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {FEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Annual Tuition Fee 2024-2025"
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Amount & Due Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Amount ($)</label>
                    <input
                      type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : "Create Fee"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
