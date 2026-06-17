import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import {
  getLeadStatusesByEmail,
  type LeadStatusValue,
  updateLeadStatusById,
  upsertLeadStatus,
} from "../database/lead-status-repository";
import { logger } from "../utils/logger";

const router = Router();

const VALID_STATUSES = new Set<LeadStatusValue>([
  "new",
  "contacted",
  "interested",
  "closed",
  "not_interested",
]);

router.post("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const {
      email,
      business_name,
      business_phone,
      business_address,
      search_id,
      status,
      notes,
    } = req.body as {
      email?: string;
      business_name?: string;
      business_phone?: string;
      business_address?: string;
      search_id?: string;
      status?: string;
      notes?: string;
    };

    const authEmail = req.licenseEmail!;
    const normalizedEmail = (email ?? authEmail).toLowerCase().trim();

    if (normalizedEmail !== authEmail) {
      res.status(403).json({ error: "Email does not match authenticated license" });
      return;
    }

    if (!business_name?.trim()) {
      res.status(400).json({ error: "business_name is required" });
      return;
    }

    const nextStatus = (status ?? "new") as LeadStatusValue;
    if (!VALID_STATUSES.has(nextStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const record = await upsertLeadStatus({
      email: normalizedEmail,
      business_name,
      business_phone: business_phone ?? null,
      business_address: business_address ?? null,
      search_id: search_id ?? null,
      status: nextStatus,
      notes: notes ?? null,
    });

    res.status(201).json(record);
  } catch (err) {
    logger.error("POST /lead-status failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to save lead status" });
  }
});

router.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const email = req.licenseEmail!;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const records = await getLeadStatusesByEmail(email, status);
    res.json({ statuses: records });
  } catch (err) {
    logger.error("GET /lead-status failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch lead statuses" });
  }
});

router.put("/:id", requireLicense, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status, notes } = req.body as { status?: string; notes?: string };

    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    if (status && !VALID_STATUSES.has(status as LeadStatusValue)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const record = await updateLeadStatusById(id, req.licenseEmail!, {
      status: status as LeadStatusValue | undefined,
      notes: notes ?? undefined,
    });

    res.json(record);
  } catch (err) {
    logger.error("PUT /lead-status/:id failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to update lead status" });
  }
});

export default router;
