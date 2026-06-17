"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { examsApi, classesApi, gradesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import { Trophy, Loader2, Save, BarChart3, CheckCircle2 } from "lucide-react";

export default function TeacherGradesPage() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});

  const { data: exams } = useQuery({
    queryKey: ["exams-list"],
    queryFn: () => examsApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const selectedExam = exams?.find((e: any) => e.id === selectedExamId);

  const { data: classStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ["exam-students", selectedExam?.classId],
    queryFn: () => classesApi.students(selectedExam!.classId!).then((r) => r.data.data),
    enabled: !!selectedExam?.classId,
  });

  const { data: existingGrades } = useQuery({
    queryKey: ["grades-for-exam", selectedExamId],
    queryFn: () => gradesApi.list({ examId: selectedExamId }).then((r) => r.data.data),
    enabled: !!selectedExamId,
    onSuccess: (data: any[]) => {
      const prefill: Record<string, string> = {};
      data.forEach((g: any) => { prefill[g.studentId] = String(g.marksObtained); });
      setMarks(prefill);
    },
  } as any);

  const { data: analytics } = useQuery({
    queryKey: ["grade-analytics", selectedExamId],
    queryFn: () => gradesApi.analytics({ examId: selectedExamId }).then((r) => r.data.data),
    enabled: !!selectedExamId && (existingGrades?.length ?? 0) > 0,
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: any) => gradesApi.bulkSubmit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-for-exam"] });
      queryClient.invalidateQueries({ queryKey: ["grade-analytics"] });
      success("Grades saved", "All marks have been recorded successfully");
    },
    onError: () => error("Save failed", "Could not save grades. Please try again."),
  });

  const handleSave = () => {
    if (!selectedExam) return;
    const grades = Object.entries(marks)
      .filter(([, v]) => v !== "")
      .map(([studentId, marksObtained]) => ({
        studentId,
        marksObtained: parseFloat(marksObtained),
      }));

    if (grades.length === 0) { error("No marks entered", "Enter at least one mark before saving"); return; }

    const invalid = grades.filter((g) => isNaN(g.marksObtained) || g.marksObtained < 0 || g.marksObtained > Number(selectedExam.totalMarks));
    if (invalid.length > 0) { error("Invalid marks", `Marks must be between 0 and ${selectedExam.totalMarks}`); return; }

    bulkMutation.mutate({ examId: selectedExamId, subjectId: selectedExam.subjectId, grades });
  };

  const totalMarks = selectedExam ? Number(selectedExam.totalMarks) : 100;

  const getGradeLabel = (pct: number) => {
    if (pct >= 97) return { label: "A+", color: "text-green-700 bg-green-50" };
    if (pct >= 93) return { label: "A", color: "text-green-700 bg-green-50" };
    if (pct >= 83) return { label: "B", color: "text-blue-700 bg-blue-50" };
    if (pct >= 73) return { label: "C", color: "text-amber-700 bg-amber-50" };
    if (pct >= 60) return { label: "D", color: "text-orange-700 bg-orange-50" };
    return { label: "F", color: "text-red-700 bg-red-50" };
  };

  return (
    <DashboardLayout allowedRoles={["ADMIN", "TEACHER"]}>
      <div className="space-y-6">
        <div>
          <h1>Grade Entry</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter marks for exams and assignments</p>
        </div>

        {/* Exam selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => { setSelectedExamId(e.target.value); setMarks({}); }}
            className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select an exam —</option>
            {exams?.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.subject?.name} ({formatDate(e.startDate)})
              </option>
            ))}
          </select>
        </div>

        {selectedExamId && selectedExam && (
          <>
            {/* Exam info */}
            <div className="rounded-xl border bg-muted/30 p-4 flex flex-wrap gap-6 text-sm">
              <div><span className="text-muted-foreground">Exam:</span> <span className="font-semibold">{selectedExam.name}</span></div>
              <div><span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{selectedExam.subject?.name}</span></div>
              <div><span className="text-muted-foreground">Total Marks:</span> <span className="font-semibold">{selectedExam.totalMarks}</span></div>
              <div><span className="text-muted-foreground">Passing:</span> <span className="font-semibold">{selectedExam.passingMarks}</span></div>
              <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{formatDate(selectedExam.startDate)}</span></div>
            </div>

            {/* Analytics bar (if grades exist) */}
            {analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Average", value: `${analytics.averagePercentage}%`, color: "bg-blue-50 text-blue-700" },
                  { label: "Highest", value: `${analytics.highest}%`, color: "bg-green-50 text-green-700" },
                  { label: "Lowest", value: `${analytics.lowest}%`, color: "bg-red-50 text-red-700" },
                  { label: "Pass Rate", value: `${analytics.passRate}%`, color: analytics.passRate >= 70 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs font-medium mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Grade entry table */}
            {loadingStudents ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : classStudents?.length > 0 ? (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {classStudents.length} Students — Enter marks out of {totalMarks}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Object.values(marks).filter(Boolean).length}/{classStudents.length} entered
                  </span>
                </div>
                <div className="divide-y">
                  {classStudents.map((student: any, i: number) => {
                    const raw = marks[student.id] ?? "";
                    const num = parseFloat(raw);
                    const pct = !isNaN(num) && raw !== "" ? Math.round((num / totalMarks) * 100) : null;
                    const badge = pct !== null ? getGradeLabel(pct) : null;
                    const isInvalid = raw !== "" && (isNaN(num) || num < 0 || num > totalMarks);

                    return (
                      <div key={student.id} className="flex items-center gap-4 px-4 py-3">
                        <span className="text-sm text-muted-foreground w-6 shrink-0">{i + 1}</span>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                        </div>
                        <span className="flex-1 text-sm font-medium">
                          {student.user?.firstName} {student.user?.lastName}
                        </span>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max={totalMarks}
                            step="0.5"
                            placeholder={`0–${totalMarks}`}
                            value={raw}
                            onChange={(e) => setMarks((prev) => ({ ...prev, [student.id]: e.target.value }))}
                            className={`w-24 rounded-lg border px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring ${isInvalid ? "border-red-300 bg-red-50" : "bg-background"}`}
                          />
                          {pct !== null && badge && (
                            <div className="flex items-center gap-1.5 min-w-24">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.color}`}>{badge.label}</span>
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No students found for this exam's class</p>
              </div>
            )}

            {/* Save */}
            {(classStudents?.length ?? 0) > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={bulkMutation.isPending || Object.keys(marks).length === 0}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {bulkMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Grades</>}
                </button>
              </div>
            )}
          </>
        )}

        {!selectedExamId && (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Select an exam to enter grades</p>
            <p className="text-sm mt-1">Choose from your created exams above</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
