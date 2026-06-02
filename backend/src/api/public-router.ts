import { Router, type Request, type Response } from "express";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";

const router = Router();

// PUBLIC — no auth required
// Used by layout.tsx to fetch sitewide scripts for injection
router.get("/site-scripts", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("id, value")
      .in("id", ["head_scripts", "body_scripts"]);

    if (error) throw error;

    const settings: Record<string, string> = {};
    data?.forEach((row) => {
      settings[row.id as string] = row.value as string;
    });

    res.json({
      headScripts: settings["head_scripts"] || "",
      bodyScripts: settings["body_scripts"] || "",
    });
  } catch (err) {
    logger.error("Failed to fetch public site scripts", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ headScripts: "", bodyScripts: "" });
  }
});

export default router;
