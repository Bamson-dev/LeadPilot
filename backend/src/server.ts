import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { getCorsOrigins, getEnv, loadEnv } from "./config/env";
import { searchRouter } from "./api/search-router";
import { mountHealthRoutes } from "./api/health-router";
import { rateLimit } from "./middleware/rate-limit";
import { getBrowserPool } from "./scraper/browser/browser-pool";
import { logger } from "./utils/logger";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

// Health routes first — no env/CORS dependency; must work for Docker/Coolify probes.
mountHealthRoutes(app, "/health");
mountHealthRoutes(app, "/api/health");

let routesRegistered = false;

function registerRoutes(): void {
  if (routesRegistered) return;
  routesRegistered = true;

  const corsOrigins = getCorsOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use("/search", rateLimit, searchRouter);

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err.message.startsWith("CORS blocked")) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    next(err);
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled error", { message: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

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
  const host = "0.0.0.0";
  const port = Number(process.env.PORT) || 3000;

  const server = app.listen(port, host, () => {
    logger.info("Backend listening", {
      host,
      port,
      healthPaths: ["/health", "/health/ready", "/api/health", "/api/health/ready"],
    });
  });

  try {
    loadEnv();
    registerRoutes();
    const env = getEnv();
    logger.info("Backend routes ready", {
      nodeEnv: env.NODE_ENV,
      scraperConcurrency: env.SCRAPER_CONCURRENCY,
      corsOrigins: getCorsOrigins(),
    });
  } catch (err) {
    logger.error("Backend configuration failed — /health works, API routes disabled", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  server.requestTimeout = 120_000;
  server.headersTimeout = 125_000;

  if (routesRegistered) {
    void getBrowserPool()
      .init()
      .then(() => logger.info("Browser pool ready"))
      .catch((err) => {
        logger.error("Browser pool init failed", {
          error: err instanceof Error ? err.message : "unknown",
        });
      });
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down", { signal });

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    const forceExit = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 15_000);

    if (routesRegistered) {
      try {
        await getBrowserPool().shutdown();
      } catch (err) {
        logger.error("Browser pool shutdown error", {
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    clearTimeout(forceExit);
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
