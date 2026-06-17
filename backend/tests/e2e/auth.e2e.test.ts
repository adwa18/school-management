import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard\//);
}

// ─── Admin E2E Tests ──────────────────────────────────────────────────────────

test.describe("Admin — Login and Dashboard", () => {
  test("admin can log in and see dashboard", async ({ page }) => {
    await loginAs(page, "admin@school.edu", "Admin@123");

    // Should be on admin dashboard
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await expect(page.locator("h1")).toContainText("Admin Dashboard");
  });

  test("admin dashboard shows stats cards", async ({ page }) => {
    await loginAs(page, "admin@school.edu", "Admin@123");

    // Stats cards should be visible
    await expect(page.locator("text=Total Students")).toBeVisible();
    await expect(page.locator("text=Total Teachers")).toBeVisible();
    await expect(page.locator("text=Active Classes")).toBeVisible();
  });

  test("admin can navigate to students page", async ({ page }) => {
    await loginAs(page, "admin@school.edu", "Admin@123");

    await page.click('a[href="/dashboard/admin/students"]');
    await expect(page).toHaveURL(/\/dashboard\/admin\/students/);
    await expect(page.locator("h1")).toContainText("Students");
  });

  test("admin can search students", async ({ page }) => {
    await loginAs(page, "admin@school.edu", "Admin@123");
    await page.goto(`${BASE_URL}/dashboard/admin/students`);

    await page.fill('input[placeholder*="Search"]', "Alice");
    await page.waitForResponse((r) => r.url().includes("/students") && r.status() === 200);

    // Results should contain Alice
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toContainText("Alice");
  });

  test("admin can log out", async ({ page }) => {
    await loginAs(page, "admin@school.edu", "Admin@123");

    // Click logout button in sidebar
    await page.click("button:has-text('Log out')");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

// ─── Teacher E2E Tests ────────────────────────────────────────────────────────

test.describe("Teacher — Dashboard and Attendance", () => {
  test("teacher can log in and reach teacher dashboard", async ({ page }) => {
    await loginAs(page, "john.smith@school.edu", "Teacher@123");

    await expect(page).toHaveURL(/\/dashboard\/teacher/);
    await expect(page.locator("h1")).toContainText("Teacher Dashboard");
  });

  test("teacher cannot access admin routes", async ({ page }) => {
    await loginAs(page, "john.smith@school.edu", "Teacher@123");

    // Direct navigation to admin page should redirect
    await page.goto(`${BASE_URL}/dashboard/admin`);
    await expect(page).not.toHaveURL(/\/dashboard\/admin/);
  });

  test("teacher can access attendance page", async ({ page }) => {
    await loginAs(page, "john.smith@school.edu", "Teacher@123");

    await page.click('a[href="/dashboard/teacher/attendance"]');
    await expect(page).toHaveURL(/\/dashboard\/teacher\/attendance/);
    await expect(page.locator("h1")).toContainText("Mark Attendance");
  });
});

// ─── Student E2E Tests ────────────────────────────────────────────────────────

test.describe("Student — Dashboard", () => {
  test("student can log in and see student dashboard", async ({ page }) => {
    await loginAs(page, "alice.johnson@student.school.edu", "Student@123");

    await expect(page).toHaveURL(/\/dashboard\/student/);
    await expect(page.locator("h1")).toContainText("Student Dashboard");
  });

  test("student sees attendance stats", async ({ page }) => {
    await loginAs(page, "alice.johnson@student.school.edu", "Student@123");

    await expect(page.locator("text=Attendance Rate")).toBeVisible();
  });

  test("student cannot access admin routes", async ({ page }) => {
    await loginAs(page, "alice.johnson@student.school.edu", "Student@123");

    await page.goto(`${BASE_URL}/dashboard/admin`);
    await expect(page).not.toHaveURL(/\/dashboard\/admin/);
  });
});

// ─── Parent E2E Tests ─────────────────────────────────────────────────────────

test.describe("Parent — Dashboard", () => {
  test("parent can log in and see parent dashboard", async ({ page }) => {
    await loginAs(page, "parent@school.edu", "Parent@123");

    await expect(page).toHaveURL(/\/dashboard\/parent/);
    await expect(page.locator("h1")).toContainText("Parent Dashboard");
  });

  test("parent sees their child information", async ({ page }) => {
    await loginAs(page, "parent@school.edu", "Parent@123");

    // Should see child's name on dashboard
    await expect(page.locator("text=Alice")).toBeVisible();
  });
});

// ─── Auth Guard Tests ─────────────────────────────────────────────────────────

test.describe("Authentication Guards", () => {
  test("unauthenticated user is redirected to login from protected routes", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/admin`);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("login page shows demo credential buttons", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await expect(page.locator("text=DEMO ACCOUNTS")).toBeVisible();
    await expect(page.locator("button:has-text('Admin')")).toBeVisible();
    await expect(page.locator("button:has-text('Teacher')")).toBeVisible();
  });

  test("demo credential buttons fill in the form", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.click("button:has-text('Admin')");

    const emailValue = await page.inputValue('input[type="email"]');
    expect(emailValue).toBe("admin@school.edu");
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[type="email"]', "admin@school.edu");
    await page.fill('input[type="password"]', "WrongPassword!");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Incorrect email or password")).toBeVisible();
  });

  test("session expired message appears with query param", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login?reason=session_expired`);
    await expect(page.locator("text=session expired")).toBeVisible();
  });
});
