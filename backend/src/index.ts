import app from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";
import prisma from "./config/database";

const PORT = config.PORT;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connected");

    const server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT} [${config.NODE_ENV}]`);
      logger.info(`   API: http://localhost:${PORT}${config.API_PREFIX}`);
      logger.info(`   Health: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Server closed");
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error("Force exit after timeout");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception:", err);
      process.exit(1);
    });

  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
