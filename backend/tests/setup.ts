import { PrismaClient } from "@prisma/client";

// Silence logs in test environment
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-must-be-32-chars-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-must-be-32-chars-long";
process.env.FRONTEND_URL = "http://localhost:3000";

// Global test database client
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/school_test" },
  },
  log: [],
});

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Expose prisma for tests that need it
(global as any).__prisma = prisma;

export { prisma };
