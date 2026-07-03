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
    <div class="logo">LeadThur</div>
    ${success ? '<div class="ok">Unsubscribed</div>' : ""}
    <h1>${success ? "You have been unsubscribed" : "Unable to unsubscribe"}</h1>
    <p>${message}</p>
    <p class="footer">Pdigital Marketstore Ltd · RC 8015428 · Lagos, Nigeria</p>
  </div>
</body>
</html>`;
}
