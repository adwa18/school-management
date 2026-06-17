import request from "supertest";
import app from "../../src/app";
import prisma from "../../src/config/database";
import bcrypt from "bcryptjs";

// Test database should be separate from production
// Set NODE_ENV=test to disable console noise

let adminToken: string;
let teacherToken: string;
let studentToken: string;
let createdStudentId: string;

beforeAll(async () => {
  // Clean test database
  await prisma.attendance.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();
  await prisma.academicYear.deleteMany();

  // Create test academic year
  await prisma.academicYear.create({
    data: { id: "test-ay", name: "2024-2025", startDate: new Date("2024-09-01"), endDate: new Date("2025-06-30"), isCurrent: true },
  });

  // Seed admin user
  const adminPw = await bcrypt.hash("Admin@123", 12);
  await prisma.user.create({
    data: { id: "test-admin", email: "admin@test.com", passwordHash: adminPw, role: "ADMIN", firstName: "Admin", lastName: "User", isEmailVerified: true },
  });
  await prisma.notificationPreference.create({ data: { userId: "test-admin" } });

  // Seed teacher
  const teacherPw = await bcrypt.hash("Teacher@123", 12);
  const teacherUser = await prisma.user.create({
    data: { email: "teacher@test.com", passwordHash: teacherPw, role: "TEACHER", firstName: "Test", lastName: "Teacher", isEmailVerified: true },
  });
  await prisma.teacher.create({ data: { userId: teacherUser.id, employeeId: "TCH-TEST-001", joiningDate: new Date() } });
  await prisma.notificationPreference.create({ data: { userId: teacherUser.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Auth Tests ──────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/login", () => {
  it("logs in admin and returns access token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@test.com", password: "Admin@123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined(); // refreshToken cookie

    adminToken = res.body.data.accessToken;
  });

  it("logs in teacher successfully", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "teacher@test.com", password: "Teacher@123" });

    expect(res.status).toBe(200);
    teacherToken = res.body.data.accessToken;
  });

  it("rejects invalid password with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@test.com", password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects non-existent user with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@test.com", password: "SomePass@123" });

    expect(res.status).toBe(401);
  });

  it("rejects missing fields with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@test.com" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns current user with valid token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("admin@test.com");
    expect(res.body.data.role).toBe("ADMIN");
    expect(res.body.data.passwordHash).toBeUndefined(); // Never expose hash
  });

  it("rejects request without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects request with invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });
});

// ─── Student CRUD Tests ───────────────────────────────────────────────────────

describe("POST /api/v1/students", () => {
  it("admin can create a student", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "student.test@test.com",
        password: "Student@123",
        firstName: "Test",
        lastName: "Student",
        admissionDate: "2024-09-01",
        gender: "MALE",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("student.test@test.com");
    expect(res.body.data.studentId).toMatch(/^STU-\d{4}-\d{4}$/);

    createdStudentId = res.body.data.id;
  });

  it("teacher cannot create a student (RBAC)", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ email: "another@test.com", password: "Test@123", firstName: "A", lastName: "B", admissionDate: "2024-09-01" });

    expect(res.status).toBe(403);
  });

  it("rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "student.test@test.com", password: "Student@123", firstName: "Dup", lastName: "User", admissionDate: "2024-09-01" });

    expect(res.status).toBe(409);
  });

  it("validates required fields", async () => {
    const res = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "bad-email", firstName: "A" }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe("GET /api/v1/students", () => {
  it("admin can list all students with pagination", async () => {
    const res = await request(app)
      .get("/api/v1/students?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
  });

  it("teacher can list students", async () => {
    const res = await request(app)
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
  });

  it("unauthenticated request is rejected", async () => {
    const res = await request(app).get("/api/v1/students");
    expect(res.status).toBe(401);
  });

  it("supports search filter", async () => {
    const res = await request(app)
      .get("/api/v1/students?search=Test")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/students/:id", () => {
  it("returns student by ID", async () => {
    const res = await request(app)
      .get(`/api/v1/students/${createdStudentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdStudentId);
  });

  it("returns 404 for non-existent student", async () => {
    const res = await request(app)
      .get("/api/v1/students/nonexistent-id-xyz")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/students/:id", () => {
  it("admin can update student", async () => {
    const res = await request(app)
      .put(`/api/v1/students/${createdStudentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ city: "Springfield", guardianName: "Updated Guardian" });

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Springfield");
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with service info", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

describe("404 routes", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
