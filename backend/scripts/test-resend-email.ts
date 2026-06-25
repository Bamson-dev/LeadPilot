/**
 * One-off Resend smoke test. Run from repo root:
 *
 *   RESEND_API_KEY=re_xxx EMAIL_FROM=access@leadthur.com \
 *     npx tsx backend/scripts/test-resend-email.ts [recipient@email.com]
 */
import { sendAccessEmail } from "../src/services/email";

const to = process.argv[2]?.trim() || "bamzonline01@gmail.com";

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set.");
  process.exit(1);
}

sendAccessEmail(to, "TEST-KEY-12345")
  .then(() => {
    console.log(JSON.stringify({ success: true, to }));
  })
  .catch((error) => {
    console.error(JSON.stringify({ success: false, error: String(error) }));
    process.exit(1);
  });
