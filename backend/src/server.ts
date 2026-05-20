import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { getEnv, loadEnv } from "./config/env";
import { searchRouter } from "./api/search-router";
import { healthRouter } from "./api/health-router";
import { getBrowserPool } from "./scraper/browser/browser-pool";
import { logger } from "./utils/logger";

loadEnv();

export const app = express();

app.use(
  cors({
    origin: getEnv().FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/search", searchRouter);
app.use("/health", healthRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

async function start(): Promise<void> {
  const env = getEnv();
  const host = "0.0.0.0";
  const port = Number(process.env.PORT) || 3000;

  const server = app.listen(port, host, () => {
    logger.info("Backend server started", {
      host,
      port,
      nodeEnv: env.NODE_ENV,
      scraperConcurrency: env.SCRAPER_CONCURRENCY,
    });
  });

  void getBrowserPool()
    .init()
    .then(() => logger.info("Browser pool ready"))
    .catch((err) => {
      logger.error("Browser pool init failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    });

  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });
    server.close();
    await getBrowserPool().shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (require.main === module) {
  start().catch((err) => {
    logger.error("Failed to start server", {
      error: err instanceof Error ? err.message : "unknown",
    });
    process.exit(1);
  });
}
