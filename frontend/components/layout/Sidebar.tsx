"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  Calendar, DollarSign, Library, Bus, FileText, Bell, MessageSquare,
  BarChart3, Settings, LogOut, ChevronDown, School, ClipboardCheck,
  BookMarked, Trophy,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  children?: NavItem[];
};

const navItems: NavItem[] = [
  // Admin
  { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Students", href: "/dashboard/admin/students", icon: GraduationCap, roles: ["ADMIN"] },
  { label: "Teachers", href: "/dashboard/admin/teachers", icon: Users, roles: ["ADMIN"] },
  { label: "Classes", href: "/dashboard/admin/classes", icon: School, roles: ["ADMIN"] },
  { label: "Subjects", href: "/dashboard/admin/subjects", icon: BookOpen, roles: ["ADMIN"] },
  { label: "Timetable", href: "/dashboard/admin/timetable", icon: Calendar, roles: ["ADMIN"] },
  { label: "Exams", href: "/dashboard/admin/exams", icon: ClipboardList, roles: ["ADMIN"] },
  { label: "Fees", href: "/dashboard/admin/fees", icon: DollarSign, roles: ["ADMIN"] },
  { label: "Library", href: "/dashboard/admin/library", icon: Library, roles: ["ADMIN"] },
  { label: "Transport", href: "/dashboard/admin/transport", icon: Bus, roles: ["ADMIN"] },
  { label: "Announcements", href: "/dashboard/admin/announcements", icon: Bell, roles: ["ADMIN"] },
  { label: "Reports", href: "/dashboard/admin/reports", icon: BarChart3, roles: ["ADMIN"] },
  { label: "Settings", href: "/dashboard/admin/settings", icon: Settings, roles: ["ADMIN"] },

  // Teacher
  { label: "Dashboard", href: "/dashboard/teacher", icon: LayoutDashboard, roles: ["TEACHER"] },
  { label: "My Classes", href: "/dashboard/teacher/classes", icon: School, roles: ["TEACHER"] },
  { label: "Attendance", href: "/dashboard/teacher/attendance", icon: ClipboardCheck, roles: ["TEACHER"] },
  { label: "Timetable", href: "/dashboard/teacher/timetable", icon: Calendar, roles: ["TEACHER"] },
  { label: "Assignments", href: "/dashboard/teacher/assignments", icon: FileText, roles: ["TEACHER"] },
  { label: "Grades", href: "/dashboard/teacher/grades", icon: Trophy, roles: ["TEACHER"] },
  { label: "Messages", href: "/dashboard/teacher/messages", icon: MessageSquare, roles: ["TEACHER"] },
  { label: "Announcements", href: "/dashboard/teacher/announcements", icon: Bell, roles: ["TEACHER"] },

  // Student
  { label: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard, roles: ["STUDENT"] },
  { label: "My Timetable", href: "/dashboard/student/timetable", icon: Calendar, roles: ["STUDENT"] },
  { label: "Assignments", href: "/dashboard/student/assignments", icon: FileText, roles: ["STUDENT"] },
  { label: "My Grades", href: "/dashboard/student/grades", icon: Trophy, roles: ["STUDENT"] },
  { label: "Attendance", href: "/dashboard/student/attendance", icon: ClipboardCheck, roles: ["STUDENT"] },
  { label: "Library", href: "/dashboard/student/library", icon: BookMarked, roles: ["STUDENT"] },
  { label: "Messages", href: "/dashboard/student/messages", icon: MessageSquare, roles: ["STUDENT"] },

  // Parent
  { label: "Dashboard", href: "/dashboard/parent", icon: LayoutDashboard, roles: ["PARENT"] },
  { label: "My Children", href: "/dashboard/parent/children", icon: Users, roles: ["PARENT"] },
  { label: "Attendance", href: "/dashboard/parent/attendance", icon: ClipboardCheck, roles: ["PARENT"] },
  { label: "Grades", href: "/dashboard/parent/grades", icon: Trophy, roles: ["PARENT"] },
  { label: "Fees", href: "/dashboard/parent/fees", icon: DollarSign, roles: ["PARENT"] },
  { label: "Messages", href: "/dashboard/parent/messages", icon: MessageSquare, roles: ["PARENT"] },
  { label: "Announcements", href: "/dashboard/parent/announcements", icon: Bell, roles: ["PARENT"] },
];

const roleColors: Record<string, string> = {
  ADMIN: "bg-school-purple-light text-school-purple",
  TEACHER: "bg-school-blue-light text-school-blue",
  STUDENT: "bg-school-green-light text-school-green",
  PARENT: "bg-school-amber-light text-school-amber",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const role = user?.role ?? "STUDENT";
  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      router.push("/auth/login");
    }
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">School Management</p>
          <p className="text-xs text-muted-foreground">System</p>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", roleColors[role])}>
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "sidebar-link",
                    isActive && "active"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="sidebar-link w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{loggingOut ? "Logging out..." : "Log out"}</span>
        </button>
      </div>
    </aside>
  );
}
