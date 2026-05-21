import { config } from "../config/env";
import { logger } from "../utils/logger";

export async function sendActivationEmail(email: string, licenseKey: string): Promise<void> {
  const apiKey = config.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const activateUrl = `${config.FRONTEND_URL}/activate?key=${encodeURIComponent(licenseKey)}`;

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <h1 style="color: #7c3aed;">Your LeadPilot access is ready</h1>
      <p>Thank you for your purchase. Use your license key to activate lifetime access:</p>
      <p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${licenseKey}</p>
      <p><a href="${activateUrl}" style="background:#7c3aed;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;">Activate LeadPilot</a></p>
      <p style="color:#666;font-size:14px;">If the button does not work, copy your key into the dashboard activation screen.</p>
    </div>
  `;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.BREVO_SENDER_EMAIL, name: "LeadPilot" },
      to: [{ email }],
      subject: "Your LeadPilot activation key",
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error("Brevo send failed", { status: res.status, body: body.slice(0, 200) });
    throw new Error("Failed to send activation email");
  }
}
