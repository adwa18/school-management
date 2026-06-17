"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { teachersApi } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  Users, Plus, Search, Pencil, Trash2, ChevronLeft,
  ChevronRight, Loader2, X, AlertCircle,
} from "lucide-react";

export default function AdminTeachersPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "", password: "", firstName: "", lastName: "",
    phone: "", employeeId: "", qualification: "", specialization: "", joiningDate: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["teachers", page, search],
    queryFn: () =>
      teachersApi.list({ page, limit: 20, search: search || undefined }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => teachersApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      success("Teacher created", "Account created. They can now log in.");
      setShowCreate(false);
      setForm({ email: "", password: "", firstName: "", lastName: "", phone: "", employeeId: "", qualification: "", specialization: "", joiningDate: "" });
    },
    onError: (e: any) => error("Failed", e.response?.data?.error ?? "Could not create teacher"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachersApi.update(id, { isActive: false } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      success("Teacher deactivated");
      setDeleteId(null);
    },
  });

  const handleCreate = () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName || !form.joiningDate) {
      error("Missing fields", "Email, password, name, and joining date are required");
      return;
    }
    createMutation.mutate(form);
  };

  const teachers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <DashboardLayout allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1>Teachers</h1>
            <p className="text-muted-foreground text-sm mt-1">{meta?.total ?? 0} total teachers</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Teacher
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by name or ID…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-20" />
              <p>No teachers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Teacher", "Employee ID", "Qualification", "Joining Date", "Classes", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teachers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs shrink-0">
                            {t.user?.avatarUrl
                              ? <img src={t.user.avatarUrl} className="h-8 w-8 rounded-full object-cover" alt="" />
                              : getInitials(t.user?.firstName ?? "", t.user?.lastName ?? "")}
                          </div>
                          <div>
                            <p className="font-medium">{t.user?.firstName} {t.user?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{t.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{t.employeeId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.qualification ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.joiningDate)}</td>
                      <td className="px-4 py-3 text-center">{t.classSubjects?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.user?.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.user?.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasNext}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-40">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-card">
                <h2 className="text-lg font-semibold">Add New Teacher</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "First Name *", key: "firstName", placeholder: "John" },
                    { label: "Last Name *", key: "lastName", placeholder: "Smith" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                      <input value={(form as any)[f.key]} onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  ))}
                </div>
                {[
                  { label: "Email Address *", key: "email", type: "email", placeholder: "teacher@school.edu" },
                  { label: "Password *", key: "password", type: "password", placeholder: "Min 8 chars" },
                  { label: "Phone", key: "phone", type: "tel", placeholder: "+1 234 567 8900" },
                  { label: "Employee ID", key: "employeeId", placeholder: "TCH-001" },
                  { label: "Qualification", key: "qualification", placeholder: "M.Ed, B.Sc…" },
                  { label: "Specialization", key: "specialization", placeholder: "Mathematics, Science…" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                    <input type={f.type ?? "text"} value={(form as any)[f.key]} onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Joining Date *</label>
                  <input type="date" value={form.joiningDate} onChange={(e) => setForm(p => ({ ...p, joiningDate: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
                <button onClick={handleCreate} disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : "Add Teacher"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-semibold">Deactivate Teacher</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                This teacher will lose access to the system. Their data will be preserved.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate(deleteId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60">
                  {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
