"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { assignmentsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { FileText, Clock, CheckCircle2, AlertCircle, Upload, Loader2, Send, X } from "lucide-react";

export default function StudentAssignmentsPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "submitted">("pending");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["student-assignments", filter],
    queryFn: () => assignmentsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      assignmentsApi.submit(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-assignments"] });
      success("Submitted!", "Your assignment has been submitted successfully");
      setSubmitting(null);
      setContent("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error ?? "Submission failed";
      error("Submission failed", msg);
    },
  });

  const now = new Date();
  const assignments = data ?? [];

  const filtered = assignments.filter((a: any) => {
    if (filter === "pending") return new Date(a.dueDate) >= now;
    if (filter === "submitted") return new Date(a.dueDate) < now;
    return true;
  });

  const counts = {
    all: assignments.length,
    pending: assignments.filter((a: any) => new Date(a.dueDate) >= now).length,
    submitted: assignments.filter((a: any) => new Date(a.dueDate) < now).length,
  };

  return (
    <DashboardLayout allowedRoles={["STUDENT"]}>
      <div className="space-y-6">
        <div>
          <h1>Assignments</h1>
          <p className="text-muted-foreground text-sm mt-1">View and submit your assignments</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {(["pending", "all", "submitted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
                filter === f
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "pending" ? "Upcoming" : f === "submitted" ? "Overdue/Past" : "All"}{" "}
              <span className="ml-1 text-xs rounded-full bg-muted px-1.5 py-0.5">{counts[f]}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No {filter === "pending" ? "upcoming" : "past"} assignments</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((assignment: any) => {
              const dueDate = new Date(assignment.dueDate);
              const isOverdue = dueDate < now;
              const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
              const isOpen = submitting === assignment.id;

              return (
                <div key={assignment.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* Header */}
                  <div className="flex items-start justify-between p-5">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isOverdue ? "bg-red-100 text-red-600" : daysLeft <= 2 ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base">{assignment.title}</h3>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{assignment.subject?.name}</span>
                          <span>•</span>
                          <span>{assignment.totalMarks} marks</span>
                          <span>•</span>
                          <span className={isOverdue ? "text-red-600 font-medium" : daysLeft <= 2 ? "text-amber-600 font-medium" : ""}>
                            {isOverdue ? `Overdue (${formatDate(dueDate)})` : daysLeft === 0 ? "Due today!" : `Due in ${daysLeft} days (${formatDate(dueDate)})`}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{assignment.description}</p>
                      </div>
                    </div>

                    {!isOverdue && (
                      <button
                        onClick={() => setSubmitting(isOpen ? null : assignment.id)}
                        className={`ml-4 shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          isOpen
                            ? "bg-muted text-foreground"
                            : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        {isOpen ? <><X className="h-4 w-4" />Cancel</> : <><Upload className="h-4 w-4" />Submit</>}
                      </button>
                    )}
                  </div>

                  {/* Submission form */}
                  {isOpen && (
                    <div className="border-t bg-muted/20 p-5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Your Answer / Notes</label>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          rows={5}
                          placeholder="Write your answer here, or describe what you're submitting…"
                          className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          File upload support coming soon. For now, paste your answer above.
                        </p>
                        <button
                          onClick={() => submitMutation.mutate({ id: assignment.id, content })}
                          disabled={submitMutation.isPending || !content.trim()}
                          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                          {submitMutation.isPending
                            ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
                            : <><Send className="h-4 w-4" />Submit Assignment</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
