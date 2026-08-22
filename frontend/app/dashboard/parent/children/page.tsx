"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentsApi, studentsApi, gradesApi, assignmentsApi } from "@/lib/api";
import { formatDate, gradeColor } from "@/lib/utils";
import { Users, GraduationCap, Trophy, ClipboardCheck, Loader2, ChevronDown } from "lucide-react";

export default function ParentChildrenPage() {
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grades" | "attendance" | "assignments">("grades");

  const { data: childrenData, isLoading } = useQuery({
    queryKey: ["parent-children"],
    queryFn: () => parentsApi.myChildren().then((r) => r.data.data as any[]),
  });

  // Add this useEffect right below the useQuery call
  useEffect(() => {
    if (childrenData && Array.isArray(childrenData) && childrenData.length > 0 && !activeChildId) {
      setActiveChildId(childrenData[0].student.id);
    }
  }, [childrenData]);  

  const children : any[] = Array.isArray(childrenData) ? childrenData : [];
  const activeChild = children.find((c: any) => c.student.id === activeChildId)?.student;

  const { data: reportCard } = useQuery({
    queryKey: ["child-report-card", activeChildId],
    queryFn: () => gradesApi.reportCard(activeChildId!).then((r) => r.data.data),
    enabled: !!activeChildId && activeTab === "grades",
  });

  const { data: attSummary } = useQuery({
    queryKey: ["child-attendance-summary", activeChildId],
    queryFn: () =>
      studentsApi.attendanceSummary(activeChildId!, {
        startDate: new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      }).then((r) => r.data.data),
    enabled: !!activeChildId && activeTab === "attendance",
  });

  const { data: assignments } = useQuery({
    queryKey: ["child-assignments", activeChildId],
    queryFn: () => assignmentsApi.list({ limit: 20 }).then((r) => r.data.data),
    enabled: !!activeChildId && activeTab === "assignments",
  });

  if (isLoading) {
    return (
      <DashboardLayout allowedRoles={["PARENT"]}>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={["PARENT"]}>
      <div className="space-y-6">
        <div>
          <h1>My Children</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your children's academic progress</p>
        </div>

        {children.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No children linked to your account</p>
            <p className="text-sm mt-1">Contact the school office to link your children.</p>
          </div>
        ) : (
          <>
            {/* Child selector */}
            {children.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {children.map((c: any) => (
                  <button
                    key={c.student.id}
                    onClick={() => setActiveChildId(c.student.id)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeChildId === c.student.id
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-card hover:bg-muted border-border"
                    }`}
                  >
                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                      {c.student.user?.firstName?.[0]}
                    </div>
                    {c.student.user?.firstName} {c.student.user?.lastName}
                  </button>
                ))}
              </div>
            )}

            {/* Child profile card */}
            {activeChild && (
              <div className="rounded-xl border bg-gradient-to-r from-primary/5 via-blue-50 to-primary/5 p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold shadow">
                    {activeChild.user?.firstName?.[0]}{activeChild.user?.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{activeChild.user?.firstName} {activeChild.user?.lastName}</h2>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                      <span>ID: <span className="font-mono font-medium text-foreground">{activeChild.studentId}</span></span>
                      {activeChild.class && <span>Class: <span className="font-medium text-foreground">{activeChild.class.name}</span></span>}
                      {activeChild.user?.email && <span>{activeChild.user.email}</span>}
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-4 mt-5">
                  {[
                    { label: "Overall GPA", value: reportCard?.overallGpa?.toFixed(2) ?? "—", icon: Trophy, color: "text-amber-600" },
                    { label: "Attendance", value: attSummary ? `${attSummary.attendanceRate}%` : "—", icon: ClipboardCheck, color: "text-green-600" },
                    { label: "Class", value: activeChild.class?.name ?? "—", icon: GraduationCap, color: "text-blue-600" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white/60 border border-white p-4 text-center backdrop-blur-sm">
                      <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b">
              {[
                { key: "grades", label: "Grades" },
                { key: "attendance", label: "Attendance" },
                { key: "assignments", label: "Assignments" },
              ].map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Grades tab */}
            {activeTab === "grades" && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/40">
                  <h3 className="font-semibold">Subject Grades</h3>
                </div>
                {reportCard?.subjects?.length > 0 ? (
                  <div className="divide-y">
                    {reportCard.subjects.map((sub: any) => (
                      <details key={sub.subject.code} className="group">
                        <summary className="flex items-center gap-4 px-6 py-4 cursor-pointer list-none hover:bg-muted/20">
                          <div className="flex-1">
                            <p className="font-medium">{sub.subject.name}</p>
                            <p className="text-xs text-muted-foreground">{sub.exams?.length ?? 0} assessments</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 rounded-full bg-muted overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${sub.averagePercentage >= 80 ? "bg-green-500" : sub.averagePercentage >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${sub.averagePercentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{sub.averagePercentage}%</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${gradeColor(sub.exams?.[0]?.grade ?? "F")}`}>
                              {sub.exams?.[0]?.grade ?? "—"}
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                          </div>
                        </summary>
                        <div className="px-6 pb-4 bg-muted/5">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-muted-foreground text-xs border-b">
                                <th className="text-left py-2">Exam</th>
                                <th className="text-right py-2">Score</th>
                                <th className="text-right py-2">%</th>
                                <th className="text-right py-2">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sub.exams?.map((exam: any, i: number) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="py-2">{exam.name}</td>
                                  <td className="py-2 text-right">{exam.marksObtained}/{exam.totalMarks}</td>
                                  <td className="py-2 text-right">{exam.percentage}%</td>
                                  <td className="py-2 text-right">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${gradeColor(exam.grade)}`}>{exam.grade}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Trophy className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">No grades available yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Attendance tab */}
            {activeTab === "attendance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Present", value: attSummary?.PRESENT ?? 0, color: "text-green-700 bg-green-50 border-green-100" },
                    { label: "Absent", value: attSummary?.ABSENT ?? 0, color: "text-red-700 bg-red-50 border-red-100" },
                    { label: "Late", value: attSummary?.LATE ?? 0, color: "text-amber-700 bg-amber-50 border-amber-100" },
                    { label: "Excused", value: attSummary?.EXCUSED ?? 0, color: "text-blue-700 bg-blue-50 border-blue-100" },
                    { label: "Rate", value: `${attSummary?.attendanceRate ?? 0}%`, color: (attSummary?.attendanceRate ?? 0) >= 75 ? "text-green-700 bg-green-50 border-green-100" : "text-red-700 bg-red-50 border-red-100" },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs font-medium mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
                {(attSummary?.attendanceRate ?? 100) < 75 && (
                  <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
                    <ClipboardCheck className="h-5 w-5 shrink-0 text-red-600" />
                    <p><span className="font-semibold">Attendance Warning:</span> {activeChild?.user?.firstName}'s attendance is below the 75% minimum requirement. Please contact the school.</p>
                  </div>
                )}
              </div>
            )}

            {/* Assignments tab */}
            {activeTab === "assignments" && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/40">
                  <h3 className="font-semibold">Recent Assignments</h3>
                </div>
                {(assignments?.length ?? 0) > 0 ? (
                  <div className="divide-y">
                    {(assignments ?? []).map((a: any) => {
                      const isOverdue = new Date(a.dueDate) < new Date();
                      return (
                        <div key={a.id} className="flex items-center gap-4 px-6 py-4">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-green-500"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{a.title}</p>
                            <p className="text-xs text-muted-foreground">{a.subject?.name} • Due {formatDate(a.dueDate)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOverdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {isOverdue ? "Overdue" : "Active"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <p className="text-sm">No assignments found</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
