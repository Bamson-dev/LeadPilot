import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { isPgConfigured } from "./pg-pool";
import { pgFrom } from "./pg-query-builder";

const rawSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false },
    realtime: {
      transport: ws as unknown as import("@supabase/supabase-js").WebSocketLikeConstructor,
    },
  }
);

/**
 * When SUPABASE_DB_PASSWORD is set, route `.from()` through direct Postgres.
 * This bypasses Supabase REST when egress quota blocks PostgREST (free tier).
 */
export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === "from") {
      return (table: string) => {
        if (isPgConfigured()) {
          return pgFrom(table);
        }
        return target.from(table);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
}) as SupabaseClient;

export { rawSupabase };
