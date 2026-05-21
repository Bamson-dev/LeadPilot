"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDisplayEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";
import {
  acceleratingCount,
  DEMO_SCENARIOS,
  DEMO_TIMING,
  generateDemoLeads,
} from "@/utils/demo-recording/generate-leads";

type Phase =
  | "typing-business"
  | "discovering"
  | "between-searches"
  | "lifetime-offer";

const columns = [
  { key: "business_name", label: "Business Name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "rating", label: "Rating" },
] as const;

function LiveBusinessCounter({
  count,
  isLive,
}: {
  count: number;
  isLive: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
      <span className="relative flex h-2.5 w-2.5">
        {isLive ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <span className="tabular-nums text-white">{count.toLocaleString()}</span>
      <span className="text-zinc-400 font-medium">businesses found</span>
    </div>
  );
}

function LifetimeAccessEnd() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[70vh] flex-col items-center justify-center text-center"
    >
      <p className="text-lg font-medium tracking-wide text-zinc-400">
        You&apos;re getting
      </p>
      <h2 className="mt-4 text-5xl font-extrabold tracking-tight sm:text-6xl">
        <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
          LIFETIME ACCESS
        </span>
      </h2>
      <p className="mt-6 max-w-md text-base text-zinc-400 leading-relaxed">
        Unlimited business discovery, live lead streaming, and exports — one
        payment, forever.
      </p>
      <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
        </span>
        LeadPilot
      </div>
    </motion.div>
  );
}

export function DemoRecordingDashboard() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing-business");
  const [typedBusiness, setTypedBusiness] = useState("");
  const [typedLocation, setTypedLocation] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [displayCount, setDisplayCount] = useState(0);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const tableEndRef = useRef<HTMLDivElement>(null);
  const streamStartedAt = useRef<number>(0);
  const rowIndexRef = useRef(0);
  const locationDoneRef = useRef(false);

  const scenario = DEMO_SCENARIOS[scenarioIndex]!;
  const allLeads = useMemo(
    () => generateDemoLeads(DEMO_SCENARIOS[scenarioIndex]!),
    [scenarioIndex]
  );

  const resetForScenario = useCallback((index: number) => {
    setScenarioIndex(index);
    setPhase("typing-business");
    setTypedBusiness("");
    setTypedLocation("");
    setLeads([]);
    setDisplayCount(0);
    setProgress(0);
    rowIndexRef.current = 0;
    locationDoneRef.current = false;
    setPhaseMessage(null);
  }, []);

  const beginDiscovering = useCallback(() => {
    const s = DEMO_SCENARIOS[scenarioIndex]!;
    streamStartedAt.current = Date.now();
    rowIndexRef.current = 0;
    locationDoneRef.current = false;
    setPhase("discovering");
    setPhaseMessage(`Searching for ${s.business} in ${s.location}...`);
    setDisplayCount(0);
    setProgress(2);
    setLeads([]);
  }, [scenarioIndex]);

  // Phase 1: type business only
  useEffect(() => {
    if (phase !== "typing-business") return;

    let charIndex = 0;
    const full = scenario.business;

    const timer = setInterval(() => {
      charIndex++;
      setTypedBusiness(full.slice(0, charIndex));

      if (charIndex >= full.length) {
        clearInterval(timer);
        beginDiscovering();
      }
    }, DEMO_TIMING.charMs);

    return () => clearInterval(timer);
  }, [phase, scenario.business, beginDiscovering]);

  // Phase 2: finish typing location WHILE results stream in (scan + generate overlap)
  useEffect(() => {
    if (phase !== "discovering") return;

    let charIndex = 0;
    const full = scenario.location;

    const typeTimer = setInterval(() => {
      charIndex++;
      setTypedLocation(full.slice(0, charIndex));

      if (charIndex >= full.length) {
        clearInterval(typeTimer);
        locationDoneRef.current = true;
        setPhaseMessage(
          `Found ${scenario.targetCount} businesses — loading more…`
        );
      }
    }, DEMO_TIMING.charMs);

    return () => clearInterval(typeTimer);
  }, [phase, scenario.location, scenario.targetCount]);

  // Rows + counter while discovering — starts AS location types (scan + generate together)
  useEffect(() => {
    if (phase !== "discovering") return;

    const rowTimer = setInterval(() => {
      const idx = rowIndexRef.current;
      if (idx >= allLeads.length) {
        clearInterval(rowTimer);
        setDisplayCount(scenario.targetCount);
        setProgress(100);
        setPhaseMessage(null);
        setTimeout(() => setPhase("between-searches"), 1200);
        return;
      }

      const lead = allLeads[idx]!;
      rowIndexRef.current = idx + 1;
      setLeads((prev) => [...prev, lead]);

      const elapsed = Date.now() - streamStartedAt.current;
      setDisplayCount(
        acceleratingCount(elapsed, scenario.targetCount, DEMO_TIMING.counterRampMs)
      );
      setProgress(
        Math.min(100, (rowIndexRef.current / scenario.targetCount) * 100)
      );

      if (!locationDoneRef.current && rowIndexRef.current === 3) {
        setPhaseMessage("Matches appearing as we scan…");
      }
    }, DEMO_TIMING.rowIntervalMs);

    const counterTimer = setInterval(() => {
      const elapsed = Date.now() - streamStartedAt.current;
      setDisplayCount((prev) => {
        const next = acceleratingCount(
          elapsed,
          scenario.targetCount,
          DEMO_TIMING.counterRampMs
        );
        return Math.max(prev, next);
      });
    }, 50);

    return () => {
      clearInterval(rowTimer);
      clearInterval(counterTimer);
    };
  }, [phase, allLeads, scenario.targetCount]);

  useEffect(() => {
    if (phase !== "between-searches") return;
    const t = setTimeout(() => {
      const next = scenarioIndex + 1;
      if (next >= DEMO_SCENARIOS.length) {
        setPhase("lifetime-offer");
        setPhaseMessage(null);
        return;
      }
      resetForScenario(next);
    }, DEMO_TIMING.pauseBetweenSearchesMs);
    return () => clearTimeout(t);
  }, [phase, scenarioIndex, resetForScenario]);

  useEffect(() => {
    if (phase !== "lifetime-offer") return;
    const t = setTimeout(() => {
      setPhaseMessage("Demo complete — refresh the page to replay");
    }, DEMO_TIMING.lifetimeOfferMs);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    tableEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [leads.length]);

  const isActive = phase === "discovering" || phase === "typing-business";
  const showLifetime = phase === "lifetime-offer";
  const isScanning = phase === "discovering";
  const locationTyping =
    isScanning && typedLocation.length < scenario.location.length;
  const feedSubtitle = typedLocation
    ? `${typedBusiness} · ${typedLocation}`
    : `${typedBusiness} · typing location…`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#09090B] px-6 py-10"
    >
      <div className="mx-auto max-w-7xl space-y-8">
        {showLifetime ? (
          <>
            <LifetimeAccessEnd />
            {phaseMessage ? (
              <p className="text-center text-sm text-zinc-500">{phaseMessage}</p>
            ) : null}
          </>
        ) : (
          <>
        <div className="glass rounded-2xl p-6 glow-violet">
          <h1 className="text-2xl font-bold text-white">Discover Prospects</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Build client lists by niche and location — contacts stream in realtime.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Business type
              </label>
              <Input
                value={typedBusiness}
                readOnly
                className="text-base"
                placeholder="Business type"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Location
              </label>
              <Input
                value={typedLocation}
                readOnly
                className={`text-base transition-shadow ${
                  locationTyping
                    ? "ring-2 ring-emerald-500/40 border-emerald-500/30"
                    : ""
                }`}
                placeholder="Location"
              />
              {locationTyping ? (
                <p className="mt-1.5 text-xs text-emerald-400/90">
                  Scanning — generating results live…
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="glow" disabled className="pointer-events-none">
              {isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Find Leads
            </Button>
          </div>

          {phaseMessage ? (
            <p className="mt-3 text-sm text-zinc-400">{phaseMessage}</p>
          ) : null}
        </div>

        {isScanning && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Live discovery feed</h2>
                <p className="mt-1 text-sm text-zinc-500">{feedSubtitle}</p>
              </div>
              <LiveBusinessCounter count={displayCount} isLive />
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_0_60px_rgba(124,58,237,0.06)]">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="sticky top-0 z-20 bg-[#111113]/95 backdrop-blur-lg shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                <tr className="border-b border-white/[0.08]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isScanning && leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-400" />
                      Scanning map data — first matches incoming…
                    </td>
                  </tr>
                ) : null}
                <AnimatePresence initial={false}>
                  {leads.map((lead) => {
                    const displayEmail = getDisplayEmail(lead);
                    return (
                      <motion.tr
                        key={lead.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        className="border-b border-white/[0.04] hover:bg-violet-500/[0.06]"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {lead.business_name}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 max-w-[280px]">
                          {lead.address}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                          {lead.phone}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {displayEmail ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-amber-400 whitespace-nowrap">
                          ★ {lead.rating}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            <div ref={tableEndRef} />
          </div>
          {leads.length > 0 ? (
            <div className="border-t border-white/[0.08] px-4 py-2 text-xs text-zinc-500">
              Showing {leads.length} of {scenario.targetCount} prospects
            </div>
          ) : null}
        </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
