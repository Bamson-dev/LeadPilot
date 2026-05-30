import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import type { Server } from "http";
import { getEnv, loadEnv } from "./config/env";
import { searchRouter, handleFreeTrialSearch } from "./api/search-router";
import { adminRouter } from "./api/admin-router";
import { authRouter } from "./api/auth-router";
import { webhookRouter } from "./api/webhook-router";
import affiliateRouter from "./api/affiliate-router";
import checkoutRouter from "./api/checkout-router";
import healthRouter from "./api/health-router";
import { rateLimit } from "./middleware/rate-limit";
import { getBrowserPool } from "./scraper/browser/browser-pool";
import { logger } from "./utils/logger";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

const alwaysAllowedOrigins = [
  "https://www.leadthur.com",
  "https://leadthur.com",
  "https://staging.leadthur.com",
  "https://www.leadpilot.live",
  "https://leadpilot.live",
  "http://localhost:3000",
  "http://localhost:3001",
];

const allowedOrigins = [
  ...new Set(
    [
      ...alwaysAllowedOrigins,
      process.env.FRONTEND_URL,
      ...(process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
    ].filter((origin): origin is string => Boolean(origin))
  ),
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Admin-Secret",
    "x-paystack-signature",
    "verif-hash",
    "x-license-key",
    "x-license-email",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Health routes — CORS applied above so browser fetches from www.leadthur.com work.
app.use("/health", healthRouter);
app.use("/api/health", healthRouter);

let routesRegistered = false;

function registerRoutes(): void {
  if (routesRegistered) return;
  routesRegistered = true;

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use("/webhooks", webhookRouter);
  app.use(express.json({ limit: "1mb" }));
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);
  app.use("/affiliate", affiliateRouter);
  app.use("/checkout", checkoutRouter);
  app.post("/freetrial", rateLimit, handleFreeTrialSearch);
  app.use("/search", rateLimit, searchRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled error", { message: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

async function initBrowserPoolSafe(): Promise<void> {
  if (!routesRegistered) return;
  try {
    await getBrowserPool().init();
    logger.info("Browser pool ready");
  } catch (err) {
    logger.error("Browser pool init failed — server stays up, /health remains available", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function listen(port: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", reject);
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
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const host = "0.0.0.0";

  const server = await listen(PORT, host);
  logger.info("Backend listening", { port: PORT, host });

  server.requestTimeout = 120_000;
  server.headersTimeout = 125_000;

  try {
    loadEnv();
    registerRoutes();
    const env = getEnv();
    logger.info("Backend routes ready", {
      nodeEnv: env.NODE_ENV,
      scraperConcurrency: env.SCRAPER_CONCURRENCY,
      corsOrigins: corsOptions.origin,
    });
  } catch (err) {
    logger.error("Backend configuration failed — /health works, API routes disabled", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  void initBrowserPoolSafe();

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
