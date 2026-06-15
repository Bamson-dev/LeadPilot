import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import {
  getSearchHistoryByEmail,
  insertSearchHistory,
} from "../database/search-history-repository";
import { logger } from "../utils/logger";

const router = Router();

router.post("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const {
      email,
      business_type,
      city,
      country,
      results_count,
    } = req.body as {
      email?: string;
      business_type?: string;
      city?: string;
      country?: string;
      results_count?: number;
    };

    const authEmail = req.licenseEmail!;
    const normalizedEmail = (email ?? authEmail).toLowerCase().trim();

    if (normalizedEmail !== authEmail) {
      res.status(403).json({ error: "Email does not match authenticated license" });
      return;
    }

    if (!business_type?.trim() || !city?.trim()) {
      res.status(400).json({ error: "business_type and city are required" });
      return;
    }

    const count = Number(results_count);
    if (!Number.isFinite(count) || count < 0) {
      res.status(400).json({ error: "results_count must be a non-negative number" });
      return;
    }

    const record = await insertSearchHistory({
      email: normalizedEmail,
      business_type: business_type.trim(),
      city: city.trim(),
      country: country?.trim() || null,
      results_count: count,
    });

    res.status(201).json(record);
  } catch (err) {
    logger.error("POST /search-history failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to save search history" });
  }
});

router.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const email = req.licenseEmail!;
    const history = await getSearchHistoryByEmail(email, 50);
    res.json({ history });
  } catch (err) {
    logger.error("GET /search-history failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch search history" });
  }
});

export default router;
