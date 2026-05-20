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
app.use(express.json());

app.use("/search", searchRouter);
app.use("/health", healthRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", { message: err.message });
  res.status(500).json({ error: "Internal server error" });
});

async function start(): Promise<void> {
  const env = getEnv();
  const pool = getBrowserPool();
  await pool.init();

  const server = app.listen(env.PORT, () => {
    logger.info("Backend server started", { port: env.PORT });
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await pool.shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (require.main === module) {
  start().catch((err) => {
    logger.error("Failed to start server", {
      error: err instanceof Error ? err.message : "unknown",
    });
    process.exit(1);
  });
}
