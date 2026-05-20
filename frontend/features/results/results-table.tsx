"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { getDisplayEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

type SortKey = keyof Pick<
  Lead,
  "business_name" | "phone" | "email" | "rating" | "reviews_count" | "category"
>;
type SortDir = "asc" | "desc";

interface ResultsTableProps {
  leads: Lead[];
  isLoading: boolean;
}

export function ResultsTable({ leads, isLoading }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [hasEmail, setHasEmail] = useState<boolean | null>(null);
  const [minRating, setMinRating] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (hasWebsite === true && !lead.website) return false;
      if (hasWebsite === false && lead.website) return false;
      if (hasEmail === true && !getDisplayEmail(lead)) return false;
      if (hasEmail === false && getDisplayEmail(lead)) return false;
      if (minRating > 0 && (lead.rating ?? 0) < minRating) return false;
      return true;
    });
  }, [leads, hasWebsite, hasEmail, minRating]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const useVirtual = sorted.length > 100;
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
    enabled: useVirtual,
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (!isLoading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0F0F14] py-24 text-center">
        <p className="text-lg font-medium text-[#F4F4FF]">No leads yet</p>
        <p className="mt-2 max-w-sm text-sm text-[#6B6B80]">
          Enter a business type and location, then hit Find Leads.
        </p>
      </div>
    );
  }

  const renderRow = (lead: Lead) => {
    const displayEmail = getDisplayEmail(lead);
    return (
      <motion.tr
        key={lead.id}
        initial={{ opacity: 0, backgroundColor: "rgba(124,58,237,0.12)" }}
        animate={{ opacity: 1, backgroundColor: "transparent" }}
        transition={{ duration: 0.35 }}
        className="border-b border-white/[0.04] hover:bg-[#7C3AED]/[0.06]"
      >
        <td className="px-4 py-3 font-medium text-[#F4F4FF]">{lead.business_name}</td>
        <td className="px-4 py-3 text-[#6B6B80]">{lead.category ?? "—"}</td>
        <td className="px-4 py-3 text-[#6B6B80] max-w-[180px] truncate">{lead.address ?? "—"}</td>
        <td className="px-4 py-3 text-[#6B6B80]">{lead.phone ?? "—"}</td>
        <td className="px-4 py-3">
          {displayEmail ? (
            <span className={lead.email_source === "generated" ? "text-amber-300" : "text-[#10B981]"}>
              {displayEmail}
              <span className="ml-1 text-[10px] uppercase">
                {lead.email_source === "generated" ? "est." : "verified"}
              </span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-3">
          {lead.website ? (
            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noopener noreferrer" className="text-[#A855F7] hover:underline truncate block max-w-[120px]">
              {lead.website.replace(/^https?:\/\//, "")}
            </a>
          ) : "—"}
        </td>
        <td className="px-4 py-3 text-amber-400">{lead.rating != null ? `★ ${lead.rating}` : "—"}</td>
        <td className="px-4 py-3 text-[#6B6B80]">{lead.reviews_count ?? "—"}</td>
      </motion.tr>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F14]">
      <div className="flex flex-col gap-2 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:flex-wrap sm:gap-3">
        <select value={hasWebsite === null ? "all" : hasWebsite ? "yes" : "no"}
          onChange={(e) => setHasWebsite(e.target.value === "all" ? null : e.target.value === "yes")}
          className="rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-xs text-[#F4F4FF]">
          <option value="all">All websites</option>
          <option value="yes">Has website</option>
          <option value="no">No website</option>
        </select>
        <select value={hasEmail === null ? "all" : hasEmail ? "yes" : "no"}
          onChange={(e) => setHasEmail(e.target.value === "all" ? null : e.target.value === "yes")}
          className="rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-xs text-[#F4F4FF]">
          <option value="all">All emails</option>
          <option value="yes">Has email</option>
          <option value="no">No email</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-[#6B6B80]">
          Min rating
          <input type="number" min={0} max={5} step={0.5} value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="w-16 rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-[#F4F4FF]" />
        </label>
      </div>

      <div ref={parentRef} className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm sm:min-w-[1000px]">
          <thead className="sticky top-0 z-10 bg-[#0F0F14]/95 backdrop-blur">
            <tr className="border-b border-white/[0.08]">
              {(["business_name", "category", "address", "phone", "email", "website", "rating", "reviews_count"] as const).map((key) => (
                <th key={key} className="px-4 py-3 text-left text-xs uppercase text-[#6B6B80]">
                  {["business_name", "rating", "reviews_count"].includes(key) ? (
                    <button type="button" onClick={() => toggleSort(key as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-[#F4F4FF]">
                      {key.replace("_", " ")}
                      {sortKey === key ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : key.replace("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && leads.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td></tr>
                ))
              : useVirtual
                ? rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const lead = sorted[virtualRow.index];
                    return renderRow(lead);
                  })
                : (
                  <AnimatePresence initial={false}>
                    {sorted.map((lead) => renderRow(lead))}
                  </AnimatePresence>
                )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.08] px-4 py-2 text-xs text-[#6B6B80]">
        {sorted.length} leads shown
      </div>
    </div>
  );
}
