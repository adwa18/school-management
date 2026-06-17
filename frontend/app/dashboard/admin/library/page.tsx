"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { libraryApi, studentsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  Library, Plus, Search, BookOpen, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, X, RotateCcw,
} from "lucide-react";

export default function AdminLibraryPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [tab, setTab] = useState<"books" | "issues">("books");
  const [showIssue, setShowIssue] = useState<string | null>(null);
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueDueDate, setIssueDueDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const { data: booksData, isLoading } = useQuery({
    queryKey: ["library-books", page, search, availableOnly],
    queryFn: () =>
      libraryApi.books({ page, limit: 20, search: search || undefined, available: availableOnly ? "true" : undefined })
        .then((r) => r.data),
  });

  const { data: issuesData } = useQuery({
    queryKey: ["library-issues", tab],
    queryFn: () => libraryApi.activeIssues({ overdue: "false" }).then((r) => r.data.data),
    enabled: tab === "issues",
  });

  const { data: overdueIssues } = useQuery({
    queryKey: ["library-overdue"],
    queryFn: () => libraryApi.activeIssues({ overdue: "true" }).then((r) => r.data.data),
  });

  const { data: students } = useQuery({
    queryKey: ["students-for-issue", studentSearch],
    queryFn: () => studentsApi.list({ search: studentSearch, limit: 8 }).then((r) => r.data.data),
    enabled: studentSearch.length >= 2,
  });

  const issueMutation = useMutation({
    mutationFn: (data: any) => libraryApi.issue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      success("Book issued", "The book has been issued to the student");
      setShowIssue(null); setIssueStudentId(""); setIssueDueDate(""); setStudentSearch("");
    },
    onError: (e: any) => error("Issue failed", e.response?.data?.error ?? "Could not issue book"),
  });

  const returnMutation = useMutation({
    mutationFn: (issueId: string) => libraryApi.return(issueId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["library-books"] });
      queryClient.invalidateQueries({ queryKey: ["library-issues"] });
      const fine = data.data.data?.fineAmount;
      success("Book returned", fine > 0 ? `Fine: $${fine.toFixed(2)}` : "No fine applicable");
    },
    onError: () => error("Return failed", "Could not process return"),
  });

  const books = booksData?.data ?? [];
  const meta = booksData?.meta;

  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

  return (
    <DashboardLayout allowedRoles={["ADMIN", "TEACHER"]}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1>Library</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {meta?.total ?? 0} books • {overdueIssues?.length ?? 0} overdue
            </p>
          </div>
        </div>

        {/* Overdue alert */}
        {(overdueIssues?.length ?? 0) > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{overdueIssues!.length} book{overdueIssues!.length > 1 ? "s are" : " is"} overdue.</span>
              {" "}Fine of $0.50/day applies. Click "Active Issues" to view.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {[{ key: "books", label: "Book Catalog" }, { key: "issues", label: "Active Issues" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "books" && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search by title, author, or ISBN…"
                  value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={availableOnly}
                  onChange={(e) => { setAvailableOnly(e.target.checked); setPage(1); }}
                  className="h-4 w-4 rounded" />
                Available only
              </label>
            </div>

            {/* Books grid */}
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : books.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No books found</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {["Title & Author", "ISBN", "Category", "Copies", "Available", "Action"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {books.map((book: any) => (
                      <tr key={book.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{book.isbn ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{book.category}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{book.totalCopies}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${book.availableCopies > 0 ? "text-green-600" : "text-red-600"}`}>
                            {book.availableCopies}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setShowIssue(book.id); setIssueDueDate(defaultDueDate); }}
                            disabled={book.availableCopies === 0}
                            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                          >
                            <BookOpen className="h-3 w-3" />
                            {book.availableCopies > 0 ? "Issue" : "Unavailable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">{(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}</p>
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
          </>
        )}

        {tab === "issues" && (
          <div className="rounded-xl border bg-card overflow-hidden">
            {!issuesData ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : issuesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                <p>No active issues</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Book", "Student", "Issued", "Due Date", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {issuesData.map((issue: any) => {
                    const isOverdue = new Date(issue.dueDate) < new Date();
                    return (
                      <tr key={issue.id} className={`hover:bg-muted/20 ${isOverdue ? "bg-red-50/50" : ""}`}>
                        <td className="px-4 py-3 font-medium">{issue.book?.title}</td>
                        <td className="px-4 py-3">{issue.student?.user?.firstName} {issue.student?.user?.lastName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(issue.issuedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {formatDate(issue.dueDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isOverdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {isOverdue ? "Overdue" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => returnMutation.mutate(issue.id)}
                            disabled={returnMutation.isPending}
                            className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <RotateCcw className="h-3 w-3" /> Return
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Issue Book Modal */}
        {showIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">Issue Book</h2>
                <button onClick={() => setShowIssue(null)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Search Student</label>
                  <input type="text" placeholder="Type student name or ID…"
                    value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setIssueStudentId(""); }}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  {students && students.length > 0 && !issueStudentId && (
                    <div className="mt-1 rounded-lg border bg-card shadow-md overflow-hidden">
                      {students.map((s: any) => (
                        <button key={s.id}
                          onClick={() => { setIssueStudentId(s.id); setStudentSearch(`${s.user.firstName} ${s.user.lastName}`); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0">
                          {s.user.firstName} {s.user.lastName} — {s.studentId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Due Date</label>
                  <input type="date" value={issueDueDate}
                    onChange={(e) => setIssueDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowIssue(null)}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
                <button
                  onClick={() => issueMutation.mutate({ bookId: showIssue, studentId: issueStudentId, dueDate: issueDueDate })}
                  disabled={!issueStudentId || !issueDueDate || issueMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                  {issueMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Issuing…</> : "Issue Book"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
