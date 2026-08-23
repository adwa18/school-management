"use client";

export const dynamic = "force-dynamic";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Metadata } from "next";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
  PARENT: "/dashboard/parent",
};

// Quick-fill demo credentials
const demoUsers = [
  { label: "Admin", email: "admin@school.edu", password: "Admin@123", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { label: "Teacher", email: "john.smith@school.edu", password: "Teacher@123", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { label: "Student", email: "alice.johnson@student.school.edu", password: "Student@123", color: "bg-green-100 text-green-700 border-green-200" },
  { label: "Parent", email: "parent@school.edu", password: "Parent@123", color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaUserId, setMfaUserId] = useState("");

  const reason = searchParams.get("reason");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError("");
    console.log("Submitting login...", data.email);
    try {
      const res = await authApi.login(data.email, data.password);
      console.log("Login response:", res.data);
      const result = res.data.data;

      if ("requiresMfa" in result && result.requiresMfa) {
        setMfaRequired(true);
        setMfaUserId((result as any).mfaToken);
        return;
      }

      const { accessToken } = result as { accessToken: string };
      const meRes = await authApi.me();

      setAuth(meRes.data.data, accessToken);

      const redirect = searchParams.get("redirect");
      const dest = redirect || ROLE_DASHBOARDS[meRes.data.data.role] || "/";
      router.replace(dest);
    } catch (err: any) {
      console.error("Login error full:", err);
      console.error("Login error response:", err.response?.data);
      const msg = err.response?.data?.error;
      if (msg === "Invalid email or password") setServerError("Incorrect email or password.");
      else if (msg?.includes("disabled")) setServerError("Your account has been disabled. Contact support.");
      else setServerError("Something went wrong. Please try again.");
    }
  };

  const handleMfaSubmit = async () => {
    try {
      const res = await authApi.login(form.getValues("email"), form.getValues("password"));
      // In real flow, send MFA code to confirm endpoint
      router.replace("/dashboard/admin");
    } catch {
      setServerError("Invalid MFA code.");
    }
  };

  const fillDemo = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-blue-800 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 mb-8">
            <GraduationCap className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">School Management System</h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            A complete platform for managing students, teachers, classes, attendance, grades, fees, and more.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Students", value: "2,500+" },
              { label: "Teachers", value: "120+" },
              { label: "Classes", value: "80+" },
              { label: "Modules", value: "14+" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="font-bold text-xl">School Management</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          {/* Alerts */}
          {reason === "session_expired" && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Your session expired. Please sign in again.
            </div>
          )}

          {serverError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          {/* Demo user buttons */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground mb-2 font-medium">DEMO ACCOUNTS</p>
            <div className="grid grid-cols-2 gap-2">
              {demoUsers.map((u) => (
                <button
                  key={u.label}
                  type="button"
                  onClick={() => fillDemo(u.email, u.password)}
                  className={`text-xs px-3 py-2 rounded-lg border font-medium transition-opacity hover:opacity-80 ${u.color}`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {!mfaRequired ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium">Password</label>
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border bg-background px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 transition-colors"
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          ) : (
            // MFA form
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleMfaSubmit} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
                Verify
              </button>
              <button onClick={() => setMfaRequired(false)} className="w-full text-sm text-muted-foreground hover:text-foreground">
                Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
