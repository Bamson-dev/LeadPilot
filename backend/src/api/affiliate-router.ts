import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import { supabase } from "../database/client";
import { getAffiliateStats } from "../services/license-service";
import { MIN_PAYOUT_NGN } from "../constants/pricing";
import {
  createTransferRecipient,
  getPaystack,
  paystackAsync,
  resolveBankAccount,
} from "../services/paystack-client";
import { sendPayoutRequestedEmail } from "../services/brevo-service";
import { logger } from "../utils/logger";

const router = Router();

router.get("/stats", requireLicense, async (req: Request, res: Response) => {
  try {
    const email = req.licenseEmail!;
    const stats = await getAffiliateStats(email);

    if (!stats) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json(stats);
  } catch (err) {
    logger.error("Failed to fetch affiliate stats", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch affiliate stats" });
  }
});

router.post("/bank-details", requireLicense, async (req: Request, res: Response) => {
  try {
    const email = req.licenseEmail!;
    const { accountNumber, bankCode, bankName, accountName } = req.body as {
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
      accountName?: string;
    };

    if (!accountNumber || !bankCode || !bankName || !accountName) {
      res.status(400).json({ error: "All bank details are required" });
      return;
    }

    const recipient = await createTransferRecipient({
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
    });

    const recipientCode = recipient.recipient_code;

    const { error } = await supabase
      .from("license_keys")
      .update({
        bank_name: bankName,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        paystack_recipient_code: recipientCode,
      })
      .eq("email", email);

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      message: "Bank details saved successfully",
      recipientCode,
    });
  } catch (err) {
    logger.error("Failed to save bank details", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to save bank details" });
  }
});

router.post("/resolve-account", requireLicense, async (req: Request, res: Response) => {
  try {
    const { accountNumber, bankCode } = req.body as {
      accountNumber?: string;
      bankCode?: string;
    };

    if (!accountNumber || !bankCode) {
      res.status(400).json({ error: "Account number and bank code required" });
      return;
    }

    const response = await resolveBankAccount({
      account_number: accountNumber,
      bank_code: bankCode,
    });

    res.json({
      accountName: response.account_name,
      accountNumber: response.account_number,
    });
  } catch {
    res.status(400).json({
      error: "Could not resolve account. Check your account number and bank.",
    });
  }
});

router.get("/banks", async (_req: Request, res: Response) => {
  try {
    const paystack = getPaystack();
    const response = await paystackAsync<{ data: unknown[] }>((cb) =>
      paystack.misc.list_banks({ country: "nigeria" }, cb)
    );
    res.json({ banks: response.data });
  } catch (err) {
    logger.error("Failed to fetch banks", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch banks" });
  }
});

router.post("/request-payout", requireLicense, async (req: Request, res: Response) => {
  try {
    const email = req.licenseEmail!;

    const { data: license, error: licenseError } = await supabase
      .from("license_keys")
      .select(
        "ref_code, total_earned_ngn, total_paid_ngn, bank_name, bank_code, account_number, account_name, paystack_recipient_code"
      )
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (licenseError || !license) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const pendingNgn =
      ((license.total_earned_ngn as number) || 0) - ((license.total_paid_ngn as number) || 0);

    if (pendingNgn < MIN_PAYOUT_NGN) {
      res.status(400).json({
        error: `Minimum payout is ₦${MIN_PAYOUT_NGN.toLocaleString()}. You have ₦${pendingNgn.toLocaleString()} pending.`,
      });
      return;
    }

    if (!license.paystack_recipient_code) {
      res.status(400).json({
        error: "Please save your bank details before requesting a payout.",
      });
      return;
    }

    const { data: existing } = await supabase
      .from("payout_requests")
      .select("id")
      .eq("referrer_email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      res.status(400).json({
        error: "You already have a pending payout request.",
      });
      return;
    }

    const { error: insertError } = await supabase.from("payout_requests").insert({
      referrer_email: email,
      ref_code: license.ref_code,
      amount_ngn: pendingNgn,
      amount_usd: pendingNgn / 1000,
      bank_name: license.bank_name,
      bank_code: license.bank_code,
      account_number: license.account_number,
      account_name: license.account_name,
      paystack_recipient_code: license.paystack_recipient_code,
      status: "pending",
    });

    if (insertError) throw new Error(insertError.message);

    try {
      await sendPayoutRequestedEmail(
        email,
        pendingNgn,
        pendingNgn / 1000,
        (license.account_name as string) || "",
        (license.bank_name as string) || ""
      );
      logger.info("Payout request email sent", { email });
    } catch (err) {
      logger.error("Failed to send payout request email", {
        email,
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    res.json({
      success: true,
      message: `Payout request of ₦${pendingNgn.toLocaleString()} submitted. You will receive payment within 24 hours.`,
    });
  } catch (err) {
    logger.error("Payout request failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to submit payout request" });
  }
});

export default router;
