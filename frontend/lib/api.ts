import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send cookies (refresh token)
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ─── Request interceptor — attach access token ─────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — handle 401 with token refresh ─────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      // Don't retry auth endpoints (would loop)
      if (original.url?.includes("/auth/")) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the token is refreshed
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers!.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post("/auth/refresh");
        const newToken = data.data.accessToken;

        useAuthStore.getState().setAccessToken(newToken);

        // Process queued requests
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        original.headers!.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshQueue = [];
        useAuthStore.getState().clearAuth();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login?reason=session_expired";
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API helpers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ accessToken: string }>>("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
  refresh: () => api.post<ApiResponse<{ accessToken: string }>>("/auth/refresh"),
  me: () => api.get<ApiResponse<any>>("/auth/me"),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
};

export const studentsApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/students", { params }),
  get: (id: string) => api.get<ApiResponse<any>>(`/students/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>("/students", data),
  update: (id: string, data: any) => api.put<ApiResponse<any>>(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  attendanceSummary: (id: string, params?: any) => api.get<ApiResponse<any>>(`/students/${id}/attendance-summary`, { params }),
  grades: (id: string) => api.get<ApiResponse<any[]>>(`/students/${id}/grades`),
};

export const teachersApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/teachers", { params }),
  get: (id: string) => api.get<ApiResponse<any>>(`/teachers/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>("/teachers", data),
  update: (id: string, data: any) => api.put<ApiResponse<any>>(`/teachers/${id}`, data),
};

export const classesApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/classes", { params }),
  get: (id: string) => api.get<ApiResponse<any>>(`/classes/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>("/classes", data),
  update: (id: string, data: any) => api.put<ApiResponse<any>>(`/classes/${id}`, data),
  students: (id: string) => api.get<ApiResponse<any[]>>(`/classes/${id}/students`),
};

export const attendanceApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/attendance", { params }),
  mark: (data: any) => api.post<ApiResponse<any>>("/attendance", data),
  report: (params: any) => api.get<ApiResponse<any>>("/attendance/report", { params }),
  todayForClass: (classId: string) => api.get<ApiResponse<any>>(`/attendance/class/${classId}/today`),
};

export const gradesApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/grades", { params }),
  submit: (data: any) => api.post<ApiResponse<any>>("/grades", data),
  bulkSubmit: (data: any) => api.post<ApiResponse<any>>("/grades/bulk", data),
  reportCard: (studentId: string, params?: any) => api.get<ApiResponse<any>>(`/grades/report-card/${studentId}`, { params }),
  analytics: (params: any) => api.get<ApiResponse<any>>("/grades/analytics", { params }),
};

export const feesApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/fees", { params }),
  create: (data: any) => api.post<ApiResponse<any>>("/fees", data),
  createInvoice: (feeId: string, notes?: string) => api.post<ApiResponse<any>>("/fees/invoice", { feeId, notes }),
  checkout: (invoiceId: string) => api.post<ApiResponse<any>>("/fees/checkout", { invoiceId }),
  summary: () => api.get<ApiResponse<any>>("/fees/summary"),
};

export const assignmentsApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/assignments", { params }),
  get: (id: string) => api.get<ApiResponse<any>>(`/assignments/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>("/assignments", data),
  submit: (id: string, data: any) => api.post<ApiResponse<any>>(`/assignments/${id}/submit`, data),
  grade: (id: string, submissionId: string, data: any) =>
    api.put<ApiResponse<any>>(`/assignments/${id}/submissions/${submissionId}/grade`, data),
  submissions: (id: string) => api.get<ApiResponse<any[]>>(`/assignments/${id}/submissions`),
};

export const announcementsApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/announcements", { params }),
  create: (data: any) => api.post<ApiResponse<any>>("/announcements", data),
  update: (id: string, data: any) => api.put<ApiResponse<any>>(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

export const messagesApi = {
  inbox: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/messages/inbox", { params }),
  send: (data: any) => api.post<ApiResponse<any>>("/messages", data),
  markRead: (id: string) => api.patch(`/messages/${id}/read`),
  unreadCount: () => api.get<ApiResponse<{ count: number }>>("/messages/unread-count"),
};

export const notificationsApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/notifications", { params }),
  markAllRead: () => api.patch("/notifications/read-all"),
  preferences: () => api.get<ApiResponse<any>>("/notifications/preferences"),
  updatePreferences: (data: any) => api.put<ApiResponse<any>>("/notifications/preferences", data),
};

export const reportsApi = {
  dashboard: () => api.get<ApiResponse<any>>("/reports/dashboard"),
  financial: (params?: any) => api.get<ApiResponse<any>>("/reports/financial", { params }),
  attendanceOverview: (params: any) => api.get<ApiResponse<any>>("/reports/attendance-overview", { params }),
};

export const timetableApi = {
  forClass: (classId: string) => api.get<ApiResponse<any>>(`/timetable/class/${classId}`),
  forTeacher: (teacherId: string) => api.get<ApiResponse<any[]>>(`/timetable/teacher/${teacherId}`),
  addSlot: (data: any) => api.post<ApiResponse<any>>("/timetable/slot", data),
  deleteSlot: (id: string) => api.delete(`/timetable/slot/${id}`),
};

export const examsApi = {
  list: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/exams", { params }),
  get: (id: string) => api.get<ApiResponse<any>>(`/exams/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>("/exams", data),
};

export const libraryApi = {
  books: (params?: Record<string, any>) => api.get<ApiResponse<any[]>>("/library/books", { params }),
  issue: (data: any) => api.post<ApiResponse<any>>("/library/issue", data),
  return: (issueId: string) => api.post<ApiResponse<any>>(`/library/return/${issueId}`),
  activeIssues: (params?: any) => api.get<ApiResponse<any[]>>("/library/issues", { params }),
};

export const transportApi = {
  routes: () => api.get<ApiResponse<any[]>>("/transport/routes"),
  assignments: (studentId: string) => api.get<ApiResponse<any[]>>(`/transport/assignments/${studentId}`),
  assign: (data: any) => api.post<ApiResponse<any>>("/transport/assign", data),
};

export const parentsApi = {
  myChildren: () => api.get<ApiResponse<any[]>>("/parents/me/children"),
};
