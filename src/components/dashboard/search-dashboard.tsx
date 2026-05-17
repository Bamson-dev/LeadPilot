"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LeadsTable } from "./leads-table";
import { LiveCounter } from "./live-counter";
import { ExportModal } from "./export-modal";
import type { Lead, StreamEvent } from "@/lib/types";
import { downloadCsv } from "@/lib/csv";
import { slugify } from "@/lib/utils";
import { MAX_EXPORT_ROWS } from "@/lib/constants";

export function SearchDashboard() {
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [searchMeta, setSearchMeta] = useState({ business: "", location: "" });
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchCompletedRef = useRef(false);

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const handleSearch = async () => {
    if (!businessType.trim() || !location.trim()) {
      setError("Please enter both business type and location.");
      return;
    }

    closeStream();
    setError(null);
    setLeads([]);
    setProgress(0);
    setIsSearching(true);
    searchCompletedRef.current = false;
    setSearchMeta({ business: businessType.trim(), location: location.trim() });
    setPhaseMessage("Starting discovery…");

    try {
      const healthPromise = fetch("/api/health")
        .then((r) => r.json())
        .catch(() => ({}));

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm: businessType.trim(),
          location: location.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setIsSearching(false);
        setPhaseMessage(null);
        return;
      }

      void healthPromise.then((healthData: { network?: string; message?: string }) => {
        if (healthData.network === "failed" && healthData.message) {
          setError(healthData.message);
        }
      });

      const streamUrl = new URL(`/api/search/${data.searchId}/stream`, window.location.origin);
      streamUrl.searchParams.set("term", data.searchTerm);
      streamUrl.searchParams.set("location", data.location);
      const es = new EventSource(streamUrl.toString());
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const payload = JSON.parse(event.data) as StreamEvent;

        if (payload.type === "phase" && payload.phase) {
          setPhaseMessage(payload.phase);
        }

        if (payload.type === "progress" && payload.count != null && payload.max) {
          setProgress(Math.min(100, (payload.count / payload.max) * 100));
        }

        if (payload.type === "lead" && payload.lead) {
          setLeads((prev) => {
            const exists = prev.some((l) => l.id === payload.lead!.id);
            if (exists) return prev;
            return [...prev, payload.lead!];
          });
        }

        if (payload.type === "lead_update" && payload.leadId) {
          const patch = payload.leadEmail ?? {
            email: payload.email ?? null,
            extracted_email: payload.email ?? null,
            generated_email: null,
            email_source: payload.email ? ("extracted" as const) : null,
          };
          setLeads((prev) =>
            prev.map((l) => (l.id === payload.leadId ? { ...l, ...patch } : l))
          );
        }

        if (payload.type === "complete") {
          searchCompletedRef.current = true;
          setProgress(100);
          setPhaseMessage(null);
          setTimeout(() => setIsSearching(false), 3000);
          closeStream();
        }

        if (payload.type === "error") {
          setError(payload.message ?? "Discovery failed. Please try again.");
          setIsSearching(false);
          closeStream();
        }
      };

      es.onerror = () => {
        if (!searchCompletedRef.current) {
          setError(
            (prev) =>
              prev ??
              "Connection lost during search. Restart the dev server, run: npm run setup — then try again. Check http://localhost:3000/api/health"
          );
          setIsSearching(false);
        }
        closeStream();
      };
    } catch {
      setError("Failed to start search. Check your connection.");
      setIsSearching(false);
    }
  };

  const handleExport = () => {
    if (leads.length === 0) return;
    setExportOpen(true);
  };

  const handleDownload = () => {
    downloadCsv(
      leads.slice(0, MAX_EXPORT_ROWS),
      slugify(searchMeta.business || businessType),
      slugify(searchMeta.location || location)
    );
    setExportOpen(false);
  };

  const handleClear = () => {
    closeStream();
    setLeads([]);
    setProgress(0);
    setError(null);
    setIsSearching(false);
  };

  const handleNewSearch = () => {
    closeStream();
    setLeads([]);
    setProgress(0);
    setError(null);
    setIsSearching(false);
    setBusinessType("");
    setLocation("");
  };

  return (
    <div className="space-y-8">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white">Discover Prospects</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Build client lists by niche and location — contacts stream in realtime.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Business type
            </label>
            <Input
              placeholder="e.g. restaurants, dentists, salons"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={isSearching}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Location
            </label>
            <Input
              placeholder="e.g. Lekki, Abuja, Lagos"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSearching}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="glow"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Find Leads
          </Button>
          {leads.length > 0 && (
            <>
              <Button variant="outline" onClick={handleExport} disabled={isSearching}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="ghost" onClick={handleNewSearch}>
                <RotateCcw className="h-4 w-4" />
                New Search
              </Button>
              <Button variant="ghost" onClick={handleClear}>
                <Trash2 className="h-4 w-4" />
                Clear Results
              </Button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
            {error.toLowerCase().includes("dns") ||
            error.toLowerCase().includes("internet") ||
            error.toLowerCase().includes("connection") ? (
              <p className="mt-2 text-xs text-red-400/80">
                Tip: confirm you are online, then retry. Run{" "}
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  /api/health
                </a>{" "}
                to diagnose.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {(isSearching || leads.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <LiveCounter count={leads.length} isSearching={isSearching} />
            {isSearching && (
              <span className="flex items-center gap-2 text-xs text-violet-400 max-w-[50%] truncate">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                {phaseMessage ?? "Live discovery in progress…"}
              </span>
            )}
          </div>
          {isSearching && <Progress value={progress} className="h-2" />}
        </motion.div>
      )}

      <LeadsTable leads={leads} isLoading={isSearching && leads.length === 0} />

      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        count={Math.min(leads.length, MAX_EXPORT_ROWS)}
        onDownload={handleDownload}
      />
    </div>
  );
}
