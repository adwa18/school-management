import { PrismaClient } from "@prisma/client";
import { config, isProduction } from "./index";
import { logger } from "../utils/logger";

// Singleton pattern — prevents multiple connections in dev hot-reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction
      ? ["error", "warn"]
      : [
          { emit: "event", level: "query" },
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ],
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;

  // Log slow queries in dev
  (prisma as any).$on("query", (e: any) => {
    if (e.duration > 2000) {
      logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

// Graceful shutdown
async function disconnect() {
  await prisma.$disconnect();
  logger.info("Database connection closed");
}

process.on("SIGINT", disconnect);
process.on("SIGTERM", disconnect);

export default prisma;
