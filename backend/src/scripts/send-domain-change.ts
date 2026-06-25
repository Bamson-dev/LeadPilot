import { loadEnv } from "../config/env";
import { supabase } from "../database/client";
import { sendDomainChangeEmail } from "../services/email";

async function main() {
  loadEnv();

  console.log("Fetching all activated users...");

  const { data: users, error } = await supabase
    .from("license_keys")
    .select("email")
    .eq("activated", true);

  if (error || !users) {
    console.error("Failed to fetch users:", error);
    process.exit(1);
  }

  console.log(`Found ${users.length} activated users. Sending emails...`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendDomainChangeEmail(user.email as string);
      sent++;
      console.log(`Sent to ${user.email} (${sent}/${users.length})`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      failed++;
      console.error(`Failed for ${user.email}:`, err);
    }
  }

  console.log(`Done. Sent: ${sent}. Failed: ${failed}.`);
  process.exit(0);
}

main();
