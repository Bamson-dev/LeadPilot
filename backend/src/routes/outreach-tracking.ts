import { Router, type Request, type Response } from "express";
import {
  getSentEmailByTrackingToken,
  recordOutreachEmailOpen,
  suppressRecipientForUser,
} from "../database/outreach-repository";
import { logger } from "../utils/logger";

export const outreachTrackingRouter = Router();

const OPEN_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

outreachTrackingRouter.get("/open/:token", async (req: Request, res: Response) => {
  const token = String(req.params.token || "").trim();

  try {
    if (token) {
      await recordOutreachEmailOpen(token);
    }
  } catch (err) {
    logger.error("Outreach email open tracking failed", {
      token,
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.status(200).send(OPEN_PIXEL_GIF);
  }
});

function outreachUnsubscribeHtml(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opt out</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111111; }
    .card { max-width: 420px; background: #fff; border: 1px solid #e5e5e5; border-radius: 4px; padding: 40px; text-align: center; }
    h1 { font-size: 20px; color: #111111; margin: 0 0 12px; font-weight: 700; }
    p { font-size: 15px; color: #444444; line-height: 1.7; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? "You're opted out" : "Unable to opt out"}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

outreachTrackingRouter.get("/unsubscribe", async (req: Request, res: Response) => {
  const token = String(req.query.token || "").trim();

  if (!token) {
    res.status(400).send(outreachUnsubscribeHtml("This opt-out link is invalid.", false));
    return;
  }

  try {
    const sentEmail = await getSentEmailByTrackingToken(token);
    if (!sentEmail) {
      res
        .status(404)
        .send(outreachUnsubscribeHtml("This opt-out link is invalid or has expired.", false));
      return;
    }

    await suppressRecipientForUser(sentEmail.user_id, sentEmail.recipient_email);
    res.send(
      outreachUnsubscribeHtml("You will not receive further messages from this sender.", true)
    );
  } catch (err) {
    logger.error("Outreach unsubscribe failed", {
      token,
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).send(outreachUnsubscribeHtml("Something went wrong. Please try again.", false));
  }
});
