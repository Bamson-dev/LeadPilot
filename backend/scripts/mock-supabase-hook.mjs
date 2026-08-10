import { createRequire } from "module";

const require = createRequire(import.meta.url);
const captured = { updates: null, table: null };

const mockSupabase = {
  from(table) {
    captured.table = table;
    return {
      select() {
        return {
          eq() {
            return {
              async single() {
                return { data: { published_at: null }, error: null };
              },
            };
          },
        };
      },
      update(payload) {
        captured.updates = payload;
        return {
          eq() {
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: "post-1", ...payload }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

export function getCapturedUpdates() {
  return captured.updates;
}

export async function registerSupabaseMock() {
  const Module = await import("node:module");
  const originalLoad = Module.default._load;
  Module.default._load = function (request, parent, isMain) {
    if (request.endsWith("/database/client") || request.endsWith("/database/client.js")) {
      return { supabase: mockSupabase };
    }
    return originalLoad(request, parent, isMain);
  };
}
