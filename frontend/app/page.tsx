"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { GraduationCap, Loader2 } from "lucide-react";

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
  PARENT: "/dashboard/parent",
};

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        router.replace(ROLE_ROUTES[user.role] ?? "/auth/login");
      } else {
        router.replace("/auth/login");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white mb-4 shadow-lg">
          <GraduationCap className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">School Management System</h1>
        <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading your dashboard…</span>
        </div>
      </div>
    </div>
  );
}
