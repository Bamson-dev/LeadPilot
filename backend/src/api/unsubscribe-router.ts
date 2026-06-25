import { Router, type Request, type Response } from "express";
import { pauseTrialSequence } from "../database/free-trial-repository";
import { logger } from "../utils/logger";

export const unsubscribeRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

unsubscribeRouter.get("/", async (req: Request, res: Response) => {
  const rawEmail = typeof req.query.email === "string" ? req.query.email : "";
  const email = rawEmail.toLowerCase().trim();

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).send(unsubscribeHtml("Invalid email address.", false));
    return;
  }

  try {
    await pauseTrialSequence(email);
    res.send(
      unsubscribeHtml(
        "You have been unsubscribed. You will not receive any more emails from LeadThur.",
        true
      )
    );
  } catch (err) {
    logger.error("Unsubscribe failed", {
      email,
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).send(unsubscribeHtml("Something went wrong. Please try again.", false));
  }
});

function unsubscribeHtml(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe — LeadThur</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f4f5; font-family: -apple-system, 'Segoe UI', Inter, sans-serif; padding: 24px; }
    .card { max-width: 420px; background: #fff; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; color: #09090b; margin: 0 0 12px; }
    p { font-size: 15px; color: #3f3f46; line-height: 1.6; margin: 0; }
    .logo { font-size: 16px; font-weight: 800; margin-bottom: 24px; color: #09090b; }
    .logo span { color: #7C3AED; }
    .ok { color: #10B981; font-size: 32px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Lead<span>Thur</span></div>
    ${success ? '<div class="ok">✓</div>' : ""}
    <h1>${success ? "Unsubscribed" : "Unable to unsubscribe"}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
