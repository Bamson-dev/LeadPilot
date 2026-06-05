import { Router, type Request, type Response } from "express";
import { generateDemoContacts } from "../utils/demo-data-generator";
import { logger } from "../utils/logger";

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { businessType, city, count = "1000" } = req.query;

    // Generate a realistic varying count based on city and business type
    // Real scrapes never return round numbers
    const baseCount = Number(count) || 1000;
    const variance = Math.floor(Math.random() * 400) - 150;
    const minimums: Record<string, number> = {
      nigeria: 180,
      ghana: 120,
      kenya: 140,
      southafrica: 160,
      uk: 200,
      usa: 220,
      uae: 130,
      canada: 150,
      india: 250,
      australia: 140,
      default: 100,
    };

    const cityParam = ((city as string) || "").toLowerCase();
    let countryKey = "default";
    if (cityParam.includes("nigeria") || cityParam.includes("lagos") || cityParam.includes("abuja")) {
      countryKey = "nigeria";
    } else if (cityParam.includes("ghana") || cityParam.includes("accra")) {
      countryKey = "ghana";
    } else if (cityParam.includes("kenya") || cityParam.includes("nairobi")) {
      countryKey = "kenya";
    } else if (
      cityParam.includes("south africa") ||
      cityParam.includes("johannesburg") ||
      cityParam.includes("cape town")
    ) {
      countryKey = "southafrica";
    } else if (cityParam.includes("uk") || cityParam.includes("london") || cityParam.includes("manchester")) {
      countryKey = "uk";
    } else if (cityParam.includes("usa") || cityParam.includes("new york") || cityParam.includes("los angeles")) {
      countryKey = "usa";
    } else if (cityParam.includes("uae") || cityParam.includes("dubai")) {
      countryKey = "uae";
    } else if (cityParam.includes("canada") || cityParam.includes("toronto")) {
      countryKey = "canada";
    }

    const minimum = minimums[countryKey];
    const demoCount = Math.max(minimum, Math.min(baseCount + variance, 1247));
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
