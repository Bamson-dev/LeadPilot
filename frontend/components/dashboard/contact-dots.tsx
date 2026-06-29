"use client";

import type { Lead } from "@/types/lead";

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-emerald-400" : "bg-zinc-600"
      }`}
      title={active ? "Available" : "Not found"}
    />
  );
}

export function ContactDots({ lead }: { lead: Lead }) {
  const hasPhone = Boolean(lead.phone?.trim());
  const hasEmail = Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verified_emails?.length ?? 0) > 0
  );
  const hasWebsite = Boolean(lead.website?.trim());

  return (
    <div className="flex items-center gap-1" title="Phone · Email · Website">
      <Dot active={hasPhone} />
      <Dot active={hasEmail} />
      <Dot active={hasWebsite} />
    </div>
  );
}
