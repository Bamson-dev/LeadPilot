/**
 * Ground-truth DB check for a completed search (step 5 diagnostic).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   node backend/scripts/query-search-leads.mjs [searchId]
 */
import { createClient } from "@supabase/supabase-js";

const searchId =
  process.argv[2]?.trim() || "0c12d5dd-9be1-4eab-8621-5667bea3c145";
const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_KEY?.trim();

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("business_leads")
  .select(
    "name, email, verified_email, predicted_email, predicted_email_secondary, email_source, email_scraped"
  )
  .eq("search_id", searchId)
  .or(
    "name.ilike.%JOHANNESBURG DEVELOPMENT AGENCY%,name.ilike.%Leadhome%"
  )
  .order("name");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const { count } = await supabase
  .from("business_leads")
  .select("id", { count: "exact", head: true })
  .eq("search_id", searchId)
  .not("verified_email", "is", null);

const { count: emailCount } = await supabase
  .from("business_leads")
  .select("id", { count: "exact", head: true })
  .eq("search_id", searchId)
  .not("email", "is", null);

console.log(JSON.stringify({ searchId, sampleRows: data, verifiedEmailRows: count, emailColumnRows: emailCount }, null, 2));
