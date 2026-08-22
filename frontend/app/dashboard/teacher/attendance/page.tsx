"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { classesApi, attendanceApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, FileCheck, Loader2, Save, AlertCircle } from "lucide-react";

type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_OPTS: { value: AttStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "PRESENT", label: "Present", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" },
  { value: "ABSENT", label: "Absent", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
  { value: "LATE", label: "Late", icon: <Clock className="h-4 w-4" />, color: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200" },
  { value: "EXCUSED", label: "Excused", icon: <FileCheck className="h-4 w-4" />, color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" },
];

export default function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [saved, setSaved] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => classesApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const { data: todayData, isLoading: loadingStudents } = useQuery({
    queryKey: ["today-attendance", selectedClassId, date],
    queryFn: () => attendanceApi.todayForClass(selectedClassId).then((r) => r.data.data as any),
    enabled: !!selectedClassId,
    onSuccess: (data: any) => {
      // Pre-fill existing attendance
      const prefill: Record<string, AttStatus> = {};
      data.students?.forEach((s: any) => {
        if (s.attendance?.status) prefill[s.studentId] = s.attendance.status;
      });
      setStatuses(prefill);
    },
  } as any);

  const markMutation = useMutation({
    mutationFn: (payload: any) => attendanceApi.mark(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const students : any[] = (todayData as any)?.students ?? [];

  const markAll = (status: AttStatus) => {
    const all: Record<string, AttStatus> = {};
    students.forEach((s: any) => { all[s.studentId] = status; });
    setStatuses(all);
  };

  const handleSave = () => {
    if (!selectedClassId) return;
    const records = students.map((s: any) => ({
      studentId: s.studentId,
      status: statuses[s.studentId] ?? "PRESENT",
    }));
    markMutation.mutate({ classId: selectedClassId, date, records });
  };

  const summary = {
    PRESENT: Object.values(statuses).filter((s) => s === "PRESENT").length,
    ABSENT: Object.values(statuses).filter((s) => s === "ABSENT").length,
    LATE: Object.values(statuses).filter((s) => s === "LATE").length,
    EXCUSED: Object.values(statuses).filter((s) => s === "EXCUSED").length,
  };

  return (
    <DashboardLayout allowedRoles={["ADMIN", "TEACHER"]}>
      <div className="space-y-6">
        <div>
          <h1>Mark Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Record daily attendance for your class</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => { setSelectedClassId(e.target.value); setStatuses({}); }}
            className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select a class —</option>
            {classes?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {selectedClassId && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-3">
              {STATUS_OPTS.map((opt) => (
                <div key={opt.value} className={`rounded-xl border p-3 text-center ${opt.color}`}>
                  <p className="text-2xl font-bold">{summary[opt.value]}</p>
                  <p className="text-xs font-medium">{opt.label}</p>
                </div>
              ))}
            </div>

            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground self-center">Mark all as:</span>
              {STATUS_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => markAll(opt.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${opt.color}`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            {/* Student list */}
            {loadingStudents ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : students.length === 0 ? (
              <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No students found in this class</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                  <span className="text-sm font-medium">{students.length} Students — {formatDate(date)}</span>
                  <span className="text-xs text-muted-foreground">
                    {Object.keys(statuses).length}/{students.length} marked
                  </span>
                </div>
                <div className="divide-y">
                  {students.map((student: any, idx: number) => {
                    const current = statuses[student.studentId];
                    return (
                      <div key={student.studentId} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20">
                        <span className="text-sm text-muted-foreground w-6 shrink-0">{idx + 1}</span>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                          {student.name?.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <span className="flex-1 text-sm font-medium">{student.name}</span>
                        <div className="flex gap-1.5">
                          {STATUS_OPTS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setStatuses((prev) => ({ ...prev, [student.studentId]: opt.value }))}
                              title={opt.label}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                current === opt.value
                                  ? `${opt.color} ring-2 ring-offset-1 ring-current`
                                  : "bg-background border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {opt.icon}
                              <span className="hidden sm:inline">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save button */}
            {students.length > 0 && (
              <div className="flex items-center justify-between">
                {saved && (
                  <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Attendance saved successfully!
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSave}
                    disabled={markMutation.isPending || Object.keys(statuses).length === 0}
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {markMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="h-4 w-4" /> Save Attendance</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!selectedClassId && (
          <div className="rounded-xl border-2 border-dashed bg-card p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select a class to start marking attendance</p>
            <p className="text-sm mt-1">Choose a class from the dropdown above</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
