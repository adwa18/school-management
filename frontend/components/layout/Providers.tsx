"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/toaster";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const { accessToken, setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    // On mount, try to refresh and get current user
    const init = async () => {
      if (!accessToken) {
        try {
          const refreshRes = await authApi.refresh();
          const newToken = refreshRes.data.data.accessToken;
          const meRes = await authApi.me();
          setAuth(meRes.data.data, newToken);
        } catch {
          clearAuth();
        }
      } else {
        try {
          const meRes = await authApi.me();
          setAuth(meRes.data.data, accessToken);
        } catch {
          // Token might be expired, try refresh
          try {
            const refreshRes = await authApi.refresh();
            const newToken = refreshRes.data.data.accessToken;
            const meRes = await authApi.me();
            setAuth(meRes.data.data, newToken);
          } catch {
            clearAuth();
          }
        }
      }
      setLoading(false);
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            retry: (failureCount, error: any) => {
              if (error?.response?.status === 401) return false;
              if (error?.response?.status === 403) return false;
              if (error?.response?.status === 404) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthHydrator>{children}</AuthHydrator>
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
