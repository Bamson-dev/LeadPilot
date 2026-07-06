import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import type { Server } from "http";
import { getEnv, loadEnv, config } from "./config/env";
import { searchRouter, handleFreeTrialSearch } from "./api/search-router";
import { adminRouter } from "./api/admin-router";
import { authRouter } from "./api/auth-router";
import { trialRouter } from "./api/trial-router";
import { unsubscribeRouter } from "./api/unsubscribe-router";
import { webhookRouter } from "./api/webhook-router";
import affiliateRouter from "./api/affiliate-router";
import checkoutRouter from "./api/checkout-router";
import { topupRouter } from "./api/topup-router";
import healthRouter from "./api/health-router";
import publicRouter from "./api/public-router";
import demoRouter from "./api/demo-router";
import searchHistoryRouter from "./routes/searchHistory";
import leadStatusRouter from "./routes/leadStatus";
import whatsappTemplatesRouter from "./routes/whatsappTemplates";
import aiMessageRouter from "./routes/aiMessage";
import { mailboxesRouter } from "./routes/mailboxes";
import { sendRouter } from "./routes/send";
import { outreachTrackingRouter } from "./routes/outreach-tracking";
import { outreachCheckoutRouter } from "./routes/outreach-checkout";
import { balanceRouter } from "./routes/balance";
import { emailTemplatesRouter } from "./routes/email-templates";
import { sendsRouter } from "./routes/sends";
import { rateLimit } from "./middleware/rate-limit";
import { getBrowserPool } from "./scraper/browser/browser-pool";
import { logger } from "./utils/logger";
import { getDeepseekKeyFingerprint, isDeepseekConfigured } from "./utils/deepseek-config";
import { startTrialSequenceScheduler } from "./services/trial-sequence";
import { initSearchQueue, shutdownSearchQueue } from "./queue/search-queue";
import { initOutreachSendQueue, shutdownOutreachSendQueue } from "./queue/outreach-send-queue";
import { ensureOutreachPaystackPlans } from "./services/outreach-paystack-plans";
import { startOutreachGraceScheduler } from "./services/outreach-grace-scheduler";

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
  app.use("/unsubscribe", unsubscribeRouter);
  // Admin blog posts may include base64 cover images and rich HTML — allow larger payloads.
  app.use("/admin", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/auth", authRouter);
  app.use("/trial", trialRouter);
  app.use("/admin", adminRouter);
  app.use("/affiliate", affiliateRouter);
  app.use("/checkout", checkoutRouter);
  app.use("/topup", topupRouter);
  app.use("/public", publicRouter);

  if (process.env.DEMO_MODE === "true") {
    app.use("/demo", demoRouter);
    logger.info("DEMO MODE ACTIVE — /demo/search endpoint enabled");
  }

  app.post("/freetrial", rateLimit, handleFreeTrialSearch);
  app.use("/search", rateLimit, searchRouter);
  app.use("/search-history", rateLimit, searchHistoryRouter);
  app.use("/lead-status", rateLimit, leadStatusRouter);
  app.use("/whatsapp-templates", rateLimit, whatsappTemplatesRouter);
  app.use("/ai-message", rateLimit, aiMessageRouter);
  app.use("/mailboxes", rateLimit, mailboxesRouter);
  app.use("/send", rateLimit, sendRouter);
  app.use("/outreach", outreachTrackingRouter);
  app.use("/checkout", rateLimit, outreachCheckoutRouter);
  app.use("/balance", rateLimit, balanceRouter);
  app.use("/email-templates", rateLimit, emailTemplatesRouter);
  app.use("/sends", rateLimit, sendsRouter);

  app.use(
    (err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      logger.error("Unhandled error", { message: err.message, stack: err.stack, type: err.type });

      if (!res.headersSent) {
        if (err.type === "entity.too.large") {
          res.status(413).json({
            error:
              "Request too large. Use an external image URL for the cover, or upload a smaller image.",
          });
          return;
        }

        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}

async function initBrowserPoolSafe(): Promise<void> {
  if (!routesRegistered) return;
  const pool = getBrowserPool();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ready = await pool.ensureReady();
      if (ready) {
        logger.info("Browser pool ready", { attempt });
        return;
      }
    } catch (err) {
      logger.error("Browser pool init failed — server stays up, /health remains available", {
        attempt,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 10_000));
    }
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
    if (!process.env.RESEND_API_KEY) {
      console.warn("WARNING: RESEND_API_KEY is not set. Emails will not be sent.");
    }
    registerRoutes();
    const env = getEnv();
    logger.info("Backend routes ready", {
      nodeEnv: env.NODE_ENV,
      scraperConcurrency: env.SCRAPER_CONCURRENCY,
      corsOrigins: corsOptions.origin,
      deepseekConfigured: isDeepseekConfigured(),
      deepseekKeyFingerprint: getDeepseekKeyFingerprint(),
    });
    startTrialSequenceScheduler();
    await initSearchQueue();
    await initOutreachSendQueue();
    startOutreachGraceScheduler();
    if (config.PAYSTACK_SECRET_KEY) {
      void ensureOutreachPaystackPlans().catch((err) => {
        logger.error("Outreach Paystack plan setup failed", {
          error: err instanceof Error ? err.message : "unknown",
        });
      });
    }
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
        await shutdownSearchQueue();
        await shutdownOutreachSendQueue();
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
