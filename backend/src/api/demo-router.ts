import { Router, type Request, type Response } from "express";
import { generateDemoContacts } from "../utils/demo-data-generator";
import { logger } from "../utils/logger";

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { businessType, city, count = "1000" } = req.query;
    const demoCount = Math.min(Number(count) || 1000, 1200);
    const contacts = generateDemoContacts(
      (businessType as string) || "Restaurant",
      (city as string) || "Lagos Nigeria",
      demoCount
    );

    const origin = req.headers.origin;
    const allowOrigin =
      typeof origin === "string" && origin.length > 0 ? origin : "*";

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
    });
    res.flushHeaders();

    let sent = 0;
    const batchSize = 15;
    const delay = 120;

    const sendBatch = () => {
      if (res.writableEnded) return;

      const batch = contacts.slice(sent, sent + batchSize);

      if (batch.length === 0) {
        res.write(`data: ${JSON.stringify({ done: true, total: sent })}\n\n`);
        res.end();
        return;
      }

      batch.forEach((contact) => {
        res.write(
          `data: ${JSON.stringify({ contact, total: sent + batch.length })}\n\n`
        );
      });

      sent += batch.length;
      setTimeout(sendBatch, delay);
    };

    sendBatch();

    req.on("close", () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (err) {
    logger.error("Demo search error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Demo search failed" });
    }
  }
});

export default router;
