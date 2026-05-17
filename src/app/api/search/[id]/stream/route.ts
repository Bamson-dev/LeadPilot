import { resolveSearch, updateSearchTotal } from "@/lib/search-store";
import {
  scrapeGoogleMaps,
  waitForPendingEmailJobs,
} from "@/lib/scraper/maps-scraper";
import { formatScraperError } from "@/lib/scraper/scraper-errors";
import type { Lead, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function encode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: searchId } = await params;
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("term");
  const location = searchParams.get("location");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encode(event)));
      };

      const keepalive = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      }, 10000);

      try {
        const search = resolveSearch(searchId, term, location);

        if (!search) {
          send({
            type: "error",
            message: "Search session expired. Click Find Leads again.",
          });
          return;
        }

        send({ type: "progress", count: 0, max: 200 });

        const total = await scrapeGoogleMaps(
          search.search_term,
          search.location,
          {
            onProgress: (count, max) => {
              send({ type: "progress", count, max });
            },
            onPhase: (phase) => {
              send({ type: "phase", phase });
            },
            onLead: async (leadInput, leadId) => {
              const lead: Lead = {
                id: leadId,
                search_id: searchId,
                created_at: new Date().toISOString(),
                ...leadInput,
              };
              send({ type: "lead", lead });
            },
            onLeadEmail: async (leadId, leadEmail) => {
              send({ type: "lead_update", leadId, leadEmail });
            },
          }
        );

        await waitForPendingEmailJobs();

        updateSearchTotal(searchId, total);
        send({ type: "complete", total });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        console.error("[LeadPilot Stream]", raw);
        send({ type: "error", message: formatScraperError(err) });
      } finally {
        closed = true;
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
