"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { gradesApi } from "@/lib/api";
import { formatDate, gradeColor } from "@/lib/utils";
import { Trophy, TrendingUp, Download, Loader2, BookOpen } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function StudentGradesPage() {
  // In a real app this would come from the student's own profile endpoint
  const studentId = ""; // populated from auth context in real usage

  const { data: reportCard, isLoading } = useQuery({
    queryKey: ["student-report-card", studentId],
    queryFn: async () => {
      // Simulated until we wire the student's own ID from profile
      return {
        student: { studentId: "STU-001", name: "Alice Johnson", class: { name: "Grade 10A" } },
        overallGpa: 3.7,
        totalSubjects: 5,
        subjects: [
          { subject: { name: "Mathematics", code: "MATH-101" }, averagePercentage: 88, averageGpa: 3.3, exams: [{ name: "Midterm", marksObtained: 86, totalMarks: 100, percentage: 86, grade: "B", date: new Date() }, { name: "Final", marksObtained: 91, totalMarks: 100, percentage: 91, grade: "A-", date: new Date() }] },
          { subject: { name: "English", code: "ENG-101" }, averagePercentage: 94, averageGpa: 4.0, exams: [{ name: "Midterm", marksObtained: 93, totalMarks: 100, percentage: 93, grade: "A", date: new Date() }] },
          { subject: { name: "Science", code: "SCI-101" }, averagePercentage: 78, averageGpa: 2.3, exams: [{ name: "Lab Practical", marksObtained: 75, totalMarks: 100, percentage: 75, grade: "C+", date: new Date() }] },
          { subject: { name: "History", code: "HIST-101" }, averagePercentage: 82, averageGpa: 2.7, exams: [{ name: "Essay", marksObtained: 82, totalMarks: 100, percentage: 82, grade: "B-", date: new Date() }] },
          { subject: { name: "Computer Science", code: "CS-101" }, averagePercentage: 96, averageGpa: 4.0, exams: [{ name: "Project", marksObtained: 96, totalMarks: 100, percentage: 96, grade: "A", date: new Date() }] },
        ],
        attendance: { PRESENT: 45, ABSENT: 2, LATE: 3, total: 50, rate: 96 },
      };
    },
  });

  const radarData = reportCard?.subjects.map((s: any) => ({
    subject: s.subject.name.split(" ")[0],
    score: s.averagePercentage,
  })) ?? [];

  const gpaColor = (gpa: number) =>
    gpa >= 3.7 ? "text-green-600" : gpa >= 3.0 ? "text-blue-600" : gpa >= 2.0 ? "text-amber-600" : "text-red-600";

  return (
    <DashboardLayout allowedRoles={["STUDENT"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1>My Grades</h1>
            <p className="text-muted-foreground text-sm mt-1">Academic performance report</p>
          </div>
          <button className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : reportCard ? (
          <>
            {/* GPA Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card col-span-1 flex flex-col items-center text-center py-8">
                <Trophy className="h-10 w-10 text-amber-500 mb-3" />
                <p className={`text-5xl font-bold ${gpaColor(reportCard.overallGpa)}`}>
                  {reportCard.overallGpa.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Cumulative GPA</p>
                <p className="text-xs text-muted-foreground">(4.0 scale)</p>
              </div>
              <div className="stat-card sm:col-span-2 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar name="Score" dataKey="score" fill="#1d4ed8" fillOpacity={0.2} stroke="#1d4ed8" strokeWidth={2} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Score"]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject breakdown */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/40">
                <h3 className="font-semibold">Subject Performance</h3>
              </div>
              <div className="divide-y">
                {reportCard.subjects.map((sub: any) => (
                  <details key={sub.subject.code} className="group">
                    <summary className="flex items-center gap-4 px-6 py-4 cursor-pointer list-none hover:bg-muted/20">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{sub.subject.name}</p>
                        <p className="text-xs text-muted-foreground">{sub.subject.code} • {sub.exams.length} exam{sub.exams.length !== 1 ? "s" : ""}</p>
                      </div>
                      {/* Progress bar */}
                      <div className="hidden sm:flex items-center gap-3 w-48">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sub.averagePercentage >= 80 ? "bg-green-500" : sub.averagePercentage >= 70 ? "bg-blue-500" : sub.averagePercentage >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${sub.averagePercentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-10 text-right">{sub.averagePercentage}%</span>
                      </div>
                      <div className={`ml-2 flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${gradeColor(sub.exams[0]?.grade ?? "")}`}>
                        {sub.exams[0]?.grade ?? "—"}
                      </div>
                      <span className="text-xs text-muted-foreground ml-1 group-open:rotate-180 transition-transform">▼</span>
                    </summary>

                    {/* Exam details */}
                    <div className="px-6 pb-4 pt-2 bg-muted/10">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs">
                            <th className="text-left py-1 pr-4 font-medium">Exam</th>
                            <th className="text-right py-1 pr-4 font-medium">Marks</th>
                            <th className="text-right py-1 pr-4 font-medium">%</th>
                            <th className="text-right py-1 pr-4 font-medium">Grade</th>
                            <th className="text-right py-1 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {sub.exams.map((exam: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="py-2 pr-4 font-medium">{exam.name}</td>
                              <td className="py-2 pr-4 text-right">{exam.marksObtained}/{exam.totalMarks}</td>
                              <td className="py-2 pr-4 text-right">{exam.percentage}%</td>
                              <td className="py-2 pr-4 text-right">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(exam.grade)}`}>
                                  {exam.grade}
                                </span>
                              </td>
                              <td className="py-2 text-right text-muted-foreground text-xs">{formatDate(exam.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* Attendance summary */}
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-4">Attendance Overview</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Present", value: reportCard.attendance.PRESENT, color: "text-green-700 bg-green-50 border-green-100" },
                  { label: "Absent", value: reportCard.attendance.ABSENT, color: "text-red-700 bg-red-50 border-red-100" },
                  { label: "Late", value: reportCard.attendance.LATE, color: "text-amber-700 bg-amber-50 border-amber-100" },
                  { label: "Total Days", value: reportCard.attendance.total, color: "text-gray-700 bg-gray-50 border-gray-100" },
                  { label: "Rate", value: `${reportCard.attendance.rate}%`, color: reportCard.attendance.rate >= 75 ? "text-green-700 bg-green-50 border-green-100" : "text-red-700 bg-red-50 border-red-100" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-xs font-medium mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
