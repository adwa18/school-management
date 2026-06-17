"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/lib/auth-store";
import { timetableApi, classesApi } from "@/lib/api";
import { Loader2, Calendar, Clock, MapPin } from "lucide-react";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri",
};

const SLOT_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-amber-100 border-amber-300 text-amber-800",
  "bg-rose-100 border-rose-300 text-rose-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-indigo-100 border-indigo-300 text-indigo-800",
];

export default function TeacherTimetablePage() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<"teacher" | "class">("teacher");
  const [selectedClassId, setSelectedClassId] = useState("");

  // Get teacher ID from user
  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => classesApi.list({ limit: 50 }).then((r) => r.data.data),
  });

  const { data: teacherSchedule, isLoading: teacherLoading } = useQuery({
    queryKey: ["teacher-timetable", user?.id],
    queryFn: async () => {
      // In a real app, get teacher ID from profile
      const res = await timetableApi.forClass(selectedClassId || classes?.[0]?.id || "");
      return res.data.data;
    },
    enabled: viewMode === "teacher" && !!user,
  });

  const { data: classSchedule, isLoading: classLoading } = useQuery({
    queryKey: ["class-timetable", selectedClassId],
    queryFn: () => timetableApi.forClass(selectedClassId).then((r) => r.data.data),
    enabled: viewMode === "class" && !!selectedClassId,
  });

  const schedule = viewMode === "class" ? classSchedule?.schedule : teacherSchedule?.schedule;
  const isLoading = teacherLoading || classLoading;

  // Collect unique time slots from the schedule
  const allSlots = schedule
    ? Object.values(schedule).flat() as any[]
    : [];
  const timeSlots = [...new Set(allSlots.map((s: any) => s.startTime))].sort();

  // Subject color mapping
  const subjectColors = new Map<string, string>();
  let colorIdx = 0;
  allSlots.forEach((slot: any) => {
    if (!subjectColors.has(slot.subjectId)) {
      subjectColors.set(slot.subjectId, SLOT_COLORS[colorIdx % SLOT_COLORS.length]);
      colorIdx++;
    }
  });

  const today = DAYS[new Date().getDay() - 1]; // 0=Sun offset

  return (
    <DashboardLayout allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1>Timetable</h1>
            <p className="text-muted-foreground text-sm mt-1">Weekly class schedule</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedClassId}
              onChange={(e) => { setSelectedClassId(e.target.value); setViewMode("class"); }}
              className="rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-40"
            >
              <option value="">My schedule</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !schedule || allSlots.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No timetable available</p>
            <p className="text-sm mt-1">
              {selectedClassId ? "No slots configured for this class" : "Select a class to view its schedule"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-6 divide-x border-b bg-muted/40">
                <div className="p-3 text-xs font-medium text-muted-foreground">Time</div>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className={`p-3 text-center text-xs font-semibold ${day === today ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {day === today && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mb-1 mx-auto" />}
                    {DAY_LABELS[day]}
                  </div>
                ))}
              </div>

              {timeSlots.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No time slots</div>
              ) : (
                timeSlots.map((time) => (
                  <div key={time} className="grid grid-cols-6 divide-x border-b last:border-0">
                    <div className="p-3 flex items-center">
                      <span className="text-xs text-muted-foreground font-mono">{time}</span>
                    </div>
                    {DAYS.map((day) => {
                      const slot = schedule[day]?.find((s: any) => s.startTime === time);
                      return (
                        <div key={day} className={`p-2 min-h-16 ${day === today ? "bg-primary/5" : ""}`}>
                          {slot ? (
                            <div className={`rounded-lg border p-2 h-full text-xs ${subjectColors.get(slot.subjectId) ?? SLOT_COLORS[0]}`}>
                              <p className="font-semibold leading-tight">{slot.subject?.name}</p>
                              {slot.class && <p className="mt-0.5 opacity-75">{slot.class?.name}</p>}
                              <div className="flex items-center gap-1 mt-1 opacity-75">
                                <Clock className="h-2.5 w-2.5" />
                                <span>{slot.startTime}–{slot.endTime}</span>
                              </div>
                              {slot.roomNumber && (
                                <div className="flex items-center gap-1 mt-0.5 opacity-75">
                                  <MapPin className="h-2.5 w-2.5" />
                                  <span>{slot.roomNumber}</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Mobile list view */}
            <div className="md:hidden space-y-4">
              {DAYS.map((day) => {
                const daySlots = schedule[day] ?? [];
                const isToday = day === today;
                return (
                  <div key={day} className={`rounded-xl border bg-card overflow-hidden ${isToday ? "border-primary/30 shadow-sm" : ""}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${isToday ? "bg-primary/5" : "bg-muted/40"}`}>
                      {isToday && <span className="h-2 w-2 rounded-full bg-primary" />}
                      <h3 className={`font-semibold text-sm ${isToday ? "text-primary" : ""}`}>{day}</h3>
                      {isToday && <span className="text-xs text-primary font-medium ml-auto">Today</span>}
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No classes</p>
                    ) : (
                      <div className="divide-y">
                        {daySlots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)).map((slot: any) => (
                          <div key={slot.id} className="flex items-start gap-3 px-4 py-3">
                            <span className="text-xs text-muted-foreground font-mono w-10 mt-0.5 shrink-0">{slot.startTime}</span>
                            <div className={`flex-1 rounded-lg border px-3 py-2 text-sm ${subjectColors.get(slot.subjectId) ?? SLOT_COLORS[0]}`}>
                              <p className="font-semibold">{slot.subject?.name}</p>
                              <p className="text-xs opacity-75 mt-0.5">{slot.startTime}–{slot.endTime}{slot.roomNumber ? ` · Room ${slot.roomNumber}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
