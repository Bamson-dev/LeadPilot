import { createClient } from "@supabase/supabase-js";
import ws from "ws";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false },
    realtime: {
      transport: ws as unknown as import("@supabase/supabase-js").WebSocketLikeConstructor,
    },
  }
);
