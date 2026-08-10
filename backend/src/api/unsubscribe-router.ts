import { Router, type Request, type Response } from "express";
import { pauseTrialSequence } from "../database/free-trial-repository";
import { logger } from "../utils/logger";

export const unsubscribeRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET must NOT pause. Email scanners / Safe Links / prefetch bots commonly
 * fetch unsubscribe URLs and were pausing every trial user after welcome email.
 * Actual pause happens only on explicit POST confirmation.
 */
unsubscribeRouter.get("/", (req: Request, res: Response) => {
  const rawEmail = typeof req.query.email === "string" ? req.query.email : "";
  const email = rawEmail.toLowerCase().trim();

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).send(unsubscribeHtml("Invalid email address.", "error"));
    return;
  }

  res.send(unsubscribeHtml("", "confirm", email));
});

unsubscribeRouter.post("/", async (req: Request, res: Response) => {
  const rawEmail =
    typeof (req.body as { email?: string })?.email === "string"
      ? (req.body as { email: string }).email
      : typeof req.query.email === "string"
        ? req.query.email
        : "";
  const email = rawEmail.toLowerCase().trim();

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).send(unsubscribeHtml("Invalid email address.", "error"));
    return;
  }

  try {
    await pauseTrialSequence(email);
    logger.info("Trial sequence paused via unsubscribe confirm", {
      emailDomain: email.includes("@") ? email.split("@")[1] : "unknown",
    });
    res.send(
      unsubscribeHtml(
        "You have been unsubscribed. You will not receive any more emails from LeadThur.",
        "success"
      )
    );
  } catch (err) {
    logger.error("Unsubscribe failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).send(unsubscribeHtml("Something went wrong. Please try again.", "error"));
  }
});

function unsubscribeHtml(
  message: string,
  mode: "confirm" | "success" | "error",
  email?: string
): string {
  const confirmBlock =
    mode === "confirm" && email
      ? `<p>Click the button below to stop LeadThur trial emails for <strong>${escapeHtml(email)}</strong>.</p>
    <form method="POST" action="/unsubscribe" style="margin-top:24px;">
      <input type="hidden" name="email" value="${escapeHtml(email)}" />
      <button type="submit" style="background:#7C3AED;color:#fff;border:0;border-radius:6px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer;">
        Confirm unsubscribe
      </button>
    </form>
    <p class="footer">If you did not mean to unsubscribe, close this page.</p>`
      : `<p>${escapeHtml(message)}</p>
    <p class="footer">Pdigital Marketstore Ltd · RC 8015428 · Lagos, Nigeria</p>`;

  const title =
    mode === "success"
      ? "You have been unsubscribed"
      : mode === "confirm"
        ? "Confirm unsubscribe"
        : "Unable to unsubscribe";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe — LeadThur</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111111; }
    .card { max-width: 420px; background: #fff; border: 1px solid #e5e5e5; border-radius: 4px; padding: 40px; text-align: center; }
    h1 { font-size: 20px; color: #111111; margin: 0 0 12px; font-weight: 700; }
    p { font-size: 15px; color: #444444; line-height: 1.7; margin: 0; }
    .logo { font-size: 18px; font-weight: 700; margin-bottom: 24px; color: #111111; }
    .ok { color: #111111; font-size: 24px; margin-bottom: 16px; }
    .footer { margin-top: 24px; font-size: 12px; color: #777777; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Lead<span style="color:#7C3AED;">Thur</span></div>
    ${mode === "success" ? '<div class="ok">Unsubscribed</div>' : ""}
    <h1>${title}</h1>
    ${confirmBlock}
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
