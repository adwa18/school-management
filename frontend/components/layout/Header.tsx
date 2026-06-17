"use client";

import { Bell, Menu, Search } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi, messagesApi } from "@/lib/api";
import Link from "next/link";
import { useState } from "react";

export function Header() {
  const { user } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: unreadNotifs } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await notificationsApi.list({ unread: true, limit: 1 });
      return res.data.meta?.total ?? 0;
    },
    refetchInterval: 60_000, // Poll every minute
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: async () => {
      const res = await messagesApi.unreadCount();
      return res.data.data.count;
    },
    refetchInterval: 30_000,
  });

  const notifCount = (unreadNotifs ?? 0) + (unreadMessages ?? 0);
  const rolePaths: Record<string, string> = {
    ADMIN: "/dashboard/admin",
    TEACHER: "/dashboard/teacher",
    STUDENT: "/dashboard/student",
    PARENT: "/dashboard/parent",
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
      {/* Left: breadcrumb / greeting */}
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2 rounded-lg hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="font-semibold text-sm">
            Welcome back, {user?.firstName} 👋
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Search button */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <Link
          href={`${rolePaths[user?.role ?? "STUDENT"]}/notifications`}
          className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Notifications${notifCount > 0 ? ` (${notifCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>

        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm cursor-pointer">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span>{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
          )}
        </div>
      </div>
    </header>
  );
}
