"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { assignmentsApi, classesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  FileText, Plus, Eye, Users, Clock, CheckCircle2,
  Loader2, X, ChevronDown, BookOpen,
} from "lucide-react";
import Link from "next/link";

export default function TeacherAssignmentsPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", subjectId: "", classId: "",
    dueDate: "", totalMarks: "100", allowLate: false,
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["teacher-assignments-full"],
    queryFn: () => assignmentsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => classesApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  // Get subjects for selected class
  const selectedClass = classes?.find((c: any) => c.id === form.classId);
  const subjects = selectedClass?.subjects ?? [];

  const { data: submissions } = useQuery({
    queryKey: ["assignment-submissions", selected],
    queryFn: () => assignmentsApi.submissions(selected!).then((r) => r.data.data),
    enabled: !!selected,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => assignmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments-full"] });
      success("Assignment created", "Students can now view and submit this assignment");
      setShowCreate(false);
      setForm({ title: "", description: "", subjectId: "", classId: "", dueDate: "", totalMarks: "100", allowLate: false });
    },
    onError: () => error("Failed to create", "Please fill all required fields"),
  });

  const handleCreate = () => {
    if (!form.title || !form.description || !form.subjectId || !form.dueDate) {
      error("Missing fields", "Title, description, subject, and due date are required");
      return;
    }
    createMutation.mutate({ ...form, totalMarks: parseFloat(form.totalMarks) });
  };

  const now = new Date();

  return (
    <DashboardLayout allowedRoles={["ADMIN", "TEACHER"]}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1>Assignments</h1>
            <p className="text-muted-foreground text-sm mt-1">{assignments?.length ?? 0} total assignments</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Assignment
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : assignments?.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm mt-1">Create your first assignment to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments?.map((a: any) => {
              const isOverdue = new Date(a.dueDate) < now;
              const isExpanded = selected === a.id;
              return (
                <div key={a.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isOverdue ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{a.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {a.status}
                        </span>
                        {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Closed</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{a.subject?.name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due {formatDate(a.dueDate)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a._count?.submissions ?? 0} submissions</span>
                        <span>{a.totalMarks} marks</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(isExpanded ? null : a.id)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">Submissions</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* Submissions panel */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-5">
                      <h4 className="font-medium text-sm mb-3">
                        Submissions ({submissions?.length ?? 0})
                      </h4>
                      {submissions?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No submissions yet</p>
                      ) : (
                        <div className="space-y-2">
                          {submissions?.map((sub: any) => (
                            <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border text-sm">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                {sub.student?.user?.firstName?.[0]}{sub.student?.user?.lastName?.[0]}
                              </div>
                              <span className="flex-1 font-medium">
                                {sub.student?.user?.firstName} {sub.student?.user?.lastName}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                sub.status === "GRADED" ? "bg-green-100 text-green-700" :
                                sub.status === "LATE" ? "bg-amber-100 text-amber-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>{sub.status}</span>
                              {sub.marks !== null && sub.marks !== undefined && (
                                <span className="font-semibold">{sub.marks}/{a.totalMarks}</span>
                              )}
                              <span className="text-muted-foreground text-xs">{formatDate(sub.submittedAt)}</span>
                              {sub.status !== "GRADED" && (
                                <Link href={`/dashboard/teacher/assignments/${a.id}/grade/${sub.id}`}
                                  className="text-xs text-primary hover:underline font-medium">
                                  Grade
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-card">
                <h2 className="text-lg font-semibold">New Assignment</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Title *</label>
                  <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Chapter 5 Algebra Exercise"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Class</label>
                  <select value={form.classId} onChange={(e) => setForm(f => ({ ...f, classId: e.target.value, subjectId: "" }))}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">All classes</option>
                    {classes?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Subject *</label>
                  <select value={form.subjectId} onChange={(e) => setForm(f => ({ ...f, subjectId: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Select subject</option>
                    {subjects.map((s: any) => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Description / Instructions *</label>
                  <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={4} placeholder="Describe what students should do…"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Due Date *</label>
                    <input type="datetime-local" value={form.dueDate}
                      onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Total Marks</label>
                    <input type="number" min="1" value={form.totalMarks}
                      onChange={(e) => setForm(f => ({ ...f, totalMarks: e.target.value }))}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.allowLate}
                    onChange={(e) => setForm(f => ({ ...f, allowLate: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary" />
                  <span className="text-sm">Allow late submissions</span>
                </label>
              </div>
              <div className="flex gap-3 p-6 pt-0 border-t">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
                <button onClick={handleCreate} disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : "Create Assignment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
