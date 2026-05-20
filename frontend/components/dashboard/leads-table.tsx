"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortKey = keyof Pick<
  Lead,
  "business_name" | "phone" | "email" | "rating" | "reviews_count" | "category"
>;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

const columns: {
  key: SortKey | "website" | "address";
  label: string;
  sortable?: boolean;
  wide?: boolean;
}[] = [
  { key: "business_name", label: "Business Name", sortable: true },
  { key: "phone", label: "Phone", sortable: true },
  { key: "email", label: "Email", sortable: true, wide: true },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "rating", label: "Rating", sortable: true },
  { key: "reviews_count", label: "Reviews", sortable: true },
  { key: "category", label: "Category", sortable: true },
];

interface LeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
}

export function LeadsTable({ leads, isLoading }: LeadsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
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
  }, [leads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  if (!isLoading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#111113] py-24 text-center">
        <p className="text-lg font-medium text-zinc-300">No leads yet</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          Enter a business type and location, then hit Find Leads to start discovering businesses.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_0_60px_rgba(124,58,237,0.06)]">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-20 bg-[#111113]/95 backdrop-blur-lg shadow-[0_1px_0_rgba(255,255,255,0.06)]">
            <tr className="border-b border-white/[0.08]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && leads.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="skeleton h-4 w-full rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            <AnimatePresence initial={false}>
              {paginated.map((lead) => {
                const displayEmail = getDisplayEmail(lead);
                return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, backgroundColor: "rgba(124,58,237,0.15)" }}
                  animate={{ opacity: 1, backgroundColor: "transparent" }}
                  transition={{ duration: 0.5 }}
                  className="border-b border-white/[0.04] transition-all duration-200 hover:bg-violet-500/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(124,58,237,0.12)]"
                >
                  <td className="px-4 py-3 font-medium text-white">{lead.business_name}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.phone ?? "—"}</td>
                  <td className="px-4 py-3 min-w-[200px] max-w-[260px] align-top">
                    {displayEmail ? (
                      <motion.div
                        key={`${lead.id}-${displayEmail}`}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35 }}
                        className="text-xs leading-relaxed break-words"
                        title={displayEmail}
                      >
                        {displayEmail.split(", ").map((addr) => (
                          <span
                            key={addr}
                            className={`block truncate ${
                              lead.email_source === "generated"
                                ? "text-amber-300/90"
                                : "text-emerald-300"
                            }`}
                          >
                            {addr}
                          </span>
                        ))}
                        {lead.email_source === "generated" ? (
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-amber-500/70">
                            estimated contact
                          </span>
                        ) : lead.email_source === "extracted" ? (
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-emerald-500/60">
                            verified
                          </span>
                        ) : null}
                      </motion.div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline truncate block max-w-[140px]"
                      >
                        {lead.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 max-w-[180px] truncate">
                    {lead.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-amber-400">
                    {lead.rating != null ? `★ ${lead.rating}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{lead.reviews_count ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.category ?? "—"}</td>
                </motion.tr>
              );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3">
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages} · {sorted.length} leads
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
