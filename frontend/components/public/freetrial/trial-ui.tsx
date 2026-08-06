"use client";

import { Lock } from "lucide-react";
import {
  TRIAL_SEARCH_EXAMPLES,
  type TrialSearchSuggestion,
} from "@leadthur/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/utils/utils";

export interface TrialLeadRow {
  id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  verifiedEmails: string[];
  emails: string[];
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export function LockIcon({ className }: { className?: string }) {
  return <Lock className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
}

export function LockedContactValue({ value }: { value: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="select-none rounded px-2 py-0.5 text-xs text-[var(--lt-text-muted)] blur-[5px] bg-[var(--lt-accent)]/10">
        {value}
      </span>
      <StatusBadge status="paused" label="Locked" className="shrink-0" />
    </span>
  );
}

export function PaywallValueRow({
  label,
  compareAt,
  free,
}: {
  label: string;
  compareAt?: string;
  free?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 text-sm text-[var(--lt-text-muted)]">
      <span className="leading-snug">{label}</span>
      {compareAt ? (
        <span className="shrink-0 font-semibold text-[var(--lt-text-subtle)] line-through">
          {compareAt}
        </span>
      ) : free ? (
        <span className="shrink-0 font-bold text-[var(--lt-success)]">FREE</span>
      ) : null}
    </li>
  );
}

export function StarRating() {
  return (
    <div className="mb-5 flex flex-col items-center gap-1.5">
      <div
        className="text-lg tracking-widest text-[var(--lt-warning)]"
        aria-label="Five star rating"
      >
        ★★★★★
      </div>
      <p className="m-0 text-center text-xs text-[var(--lt-text-subtle)]">
        Trusted by freelancers and agencies finding clients every day
      </p>
    </div>
  );
}

export function TrialSearchGuidance() {
  return (
    <Alert className="mb-4 border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/10">
      <AlertDescription className="space-y-1 text-[var(--lt-text)]">
        <p className="m-0 text-sm font-semibold">Search one business type in one city</p>
        <p className="m-0 text-xs text-[var(--lt-text-muted)]">
          Good:{" "}
          <span className="text-[var(--lt-accent-soft)]">restaurants</span> in{" "}
          <span className="text-[var(--lt-accent-soft)]">London UK</span>
        </p>
        <p className="m-0 text-xs text-[var(--lt-text-subtle)]">
          Avoid lists of countries, job titles, or comma-separated business types.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function TrialExamplePills({
  onSelect,
}: {
  onSelect: (example: TrialSearchSuggestion) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2.5 text-center text-[11px] text-[var(--lt-text-subtle)]">
        Try one of these
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {TRIAL_SEARCH_EXAMPLES.map((ex) => (
          <Button
            key={`${ex.query}-${ex.location}`}
            type="button"
            variant="outline"
            size="sm"
            className="min-h-12 rounded-full border-[var(--lt-accent)]/30 text-[var(--lt-accent-soft)] hover:bg-[var(--lt-accent)]/10"
            onClick={() => onSelect(ex)}
          >
            {ex.query} in {ex.location}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function TrialSearchHint({
  message,
  suggestion,
  onApply,
}: {
  message: string;
  suggestion?: TrialSearchSuggestion;
  onApply: (suggestion: TrialSearchSuggestion) => void;
}) {
  return (
    <Alert variant="warning" className="mt-4">
      <AlertDescription>
        <p className="m-0 text-sm leading-relaxed">{message}</p>
        {suggestion ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2.5 border-[var(--lt-warning)]/40 text-[var(--lt-warning)]"
            onClick={() => onApply(suggestion)}
          >
            Try {suggestion.query} in {suggestion.location} instead
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function TrialPhoneValue({ phone }: { phone: string | null }) {
  if (phone?.trim()) {
    return (
      <span className="text-sm font-semibold text-[var(--lt-text-muted)]">{phone.trim()}</span>
    );
  }
  return (
    <span
      className="select-none rounded px-2 py-0.5 text-xs text-[var(--lt-text-muted)] blur-[5px] bg-[var(--lt-accent)]/10"
      aria-label="Phone not listed"
    >
      Not listed
    </span>
  );
}

export function LeadRowMobile({ lead }: { lead: TrialLeadRow }) {
  const emailDisplay =
    lead.verifiedEmails[0] ?? lead.emails[0] ?? lead.email ?? "contact@business.com";
  const ratingDisplay =
    lead.rating != null
      ? `★ ${lead.rating}${
          lead.reviews_count != null ? ` (${lead.reviews_count.toLocaleString()} reviews)` : ""
        }`
      : "n/a";

  return (
    <Panel className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PanelContent className="space-y-2 p-4">
        <p className="text-base font-semibold text-[var(--lt-text)]">{lead.business_name}</p>
        {lead.address ? (
          <div className="flex gap-2 text-xs">
            <span className="shrink-0 text-[var(--lt-text-subtle)]">Address</span>
            <span className="text-[var(--lt-text-muted)]">{lead.address}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="shrink-0 text-[var(--lt-text-subtle)]">Phone</span>
          <TrialPhoneValue phone={lead.phone} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="shrink-0 text-[var(--lt-text-subtle)]">Email</span>
          <LockedContactValue value={emailDisplay} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="shrink-0 text-[var(--lt-text-subtle)]">Rating</span>
          <LockedContactValue value={ratingDisplay} />
        </div>
      </PanelContent>
    </Panel>
  );
}

export function TrialResultsTable({
  leads,
  lockedDisplayValue,
  truncateAddress,
}: {
  leads: TrialLeadRow[];
  lockedDisplayValue: (value: string, fallback: string) => string;
  truncateAddress: (address: string, maxLen: number) => string;
}) {
  return (
    <Panel className="hidden overflow-hidden md:block">
      <div className="grid grid-cols-[1.8fr_2fr_1.4fr_2fr_1fr] border-b border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--lt-text-subtle)]">
        <span>Business</span>
        <span>Address</span>
        <span>Phone</span>
        <span>Email</span>
        <span>Rating</span>
      </div>
      {leads.map((lead, i) => {
        const emailDisplay = lockedDisplayValue(
          lead.verifiedEmails[0] ?? lead.emails[0] ?? lead.email ?? "",
          "contact@business.com"
        );
        const ratingDisplay = lead.rating != null ? `★ ${lead.rating}` : "n/a";

        return (
          <div
            key={lead.id}
            className="grid grid-cols-[1.8fr_2fr_1.4fr_2fr_1fr] items-center border-b border-[var(--lt-border)] px-4 py-3.5 text-sm last:border-b-0 animate-in fade-in slide-in-from-bottom-1 duration-300"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="font-semibold text-[var(--lt-text)]">{lead.business_name}</span>
            <span className="text-[var(--lt-text-muted)]" title={lead.address || undefined}>
              {lead.address ? truncateAddress(lead.address, 35) : "n/a"}
            </span>
            <span>
              <TrialPhoneValue phone={lead.phone} />
            </span>
            <span>
              <LockedContactValue value={emailDisplay} />
            </span>
            <span>
              <LockedContactValue value={ratingDisplay} />
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

export function TrialPaywallPanel({
  visible,
  maxTrialLeads,
  activeSearchQuery,
  activeSearchLocation,
  paywallHeading,
  tierOne,
  tierTwo,
  salePriceUsd,
  checkoutUrl,
}: {
  visible: boolean;
  maxTrialLeads: number;
  activeSearchQuery: string;
  activeSearchLocation: string;
  paywallHeading: string;
  tierOne: readonly { label: string; compareAt: string }[];
  tierTwo: readonly string[];
  salePriceUsd: number;
  checkoutUrl: string;
}) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[var(--lt-bg)] via-[var(--lt-bg)]/95 to-transparent px-4 pb-5 pt-6"
      aria-live="polite"
    >
      <Panel className="pointer-events-auto mx-auto max-h-[min(78vh,560px)] max-w-md overflow-y-auto border-[var(--lt-accent)]/40 shadow-[0_0_80px_rgba(124,58,237,0.2)]">
        <PanelContent className="space-y-4 p-6">
          <p className="m-0 text-sm font-semibold leading-relaxed text-[var(--lt-text-muted)]">
            You are seeing {maxTrialLeads} of 1,000+ businesses found for {activeSearchQuery}{" "}
            in {activeSearchLocation}.
          </p>
          <p className="m-0 text-xl font-extrabold leading-tight text-[var(--lt-text)]">
            {paywallHeading}
          </p>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--lt-accent-soft)]">
              What you are getting
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tierOne.map((item) => (
                <PaywallValueRow key={item.label} label={item.label} compareAt={item.compareAt} />
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--lt-success)]">
              Included when you claim a slot today
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {tierTwo.map((item) => (
                <PaywallValueRow key={item} label={item} free />
              ))}
            </ul>
          </div>

          <div className="text-center">
            <p className="m-0 mb-1 text-sm text-[var(--lt-text-subtle)]">
              <span className="line-through">Total value $300</span>
            </p>
            <p className="m-0 mb-2 text-sm text-[var(--lt-text-subtle)]">
              <span className="line-through">$100 per year</span>
            </p>
            <p className="m-0 text-3xl font-black text-[var(--lt-text)]">${salePriceUsd}</p>
            <p className="mt-1.5 text-sm font-bold text-[var(--lt-text-muted)]">Once. Never again.</p>
          </div>

          <Button size="lg" className="h-12 w-full text-base font-extrabold shadow-lg" asChild>
            <a href={checkoutUrl}>Get lifetime access for ${salePriceUsd}</a>
          </Button>
        </PanelContent>
      </Panel>
    </div>
  );
}
