"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ResultsTable } from "@/features/results/results-table";
import {
  OutreachSendPanel,
  OUTREACH_COMPOSE_PANEL_WIDTH,
} from "@/components/dashboard/outreach-send-panel";
import { OutreachSendSuccessBanner } from "@/components/dashboard/outreach-send-success-banner";
import { WhatsappTemplateModal } from "@/components/dashboard/whatsapp-template-modal";
import { getLeadSelectionId } from "@/lib/lead-selection";
import { applyRatingFilter } from "@/lib/rating-filter";
import { applyStatusFilter } from "@/lib/lead-status";
import { getApiUrl } from "@/utils/env";
import { markRecipientReplied } from "@/services/outreach-api";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { RatingFilterValue } from "@/lib/rating-filter";
import type { Lead } from "@/types/lead";
import type { OutreachMailbox, QueueSendResponse } from "@/types/outreach";

interface Contact {
  name: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  website: string;
  category: string;
  country: string;
}

const PRESET_SEARCHES = [
  { label: "Restaurants — Lagos", businessType: "Restaurants", city: "Lagos, Nigeria" },
  { label: "Salons — Accra", businessType: "Salons", city: "Accra, Ghana" },
  { label: "Gyms — Nairobi", businessType: "Gyms", city: "Nairobi, Kenya" },
  { label: "Law Firms — London", businessType: "Law Firms", city: "London, UK" },
  { label: "Hotels — Dubai", businessType: "Hotels", city: "Dubai, UAE" },
  { label: "Dental Clinics — New York", businessType: "Dental Clinics", city: "New York, USA" },
  { label: "Agencies — Cape Town", businessType: "Marketing Agencies", city: "Cape Town, South Africa" },
  { label: "Restaurants — Toronto", businessType: "Restaurants", city: "Toronto, Canada" },
];

const DEMO_MAILBOX: OutreachMailbox = {
  id: "demo-mailbox",
  email_address: "Bamzonline01@gmail.com",
  account_type: "personal",
  status: "active",
  daily_cap: 50,
  daily_send_count: 0,
  daily_count_reset_at: null,
  last_verified_at: new Date().toISOString(),
  last_error: null,
};

const DEMO_SEND_BALANCE = 999;

function resolveDemoApiUrl(): string {
  const configured = getApiUrl();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const host = window.location.host.toLowerCase();
    if (host.includes("staging")) {
      return "https://staging-backend.leadthur.com";
    }
  }

  return "";
}

function contactToLead(contact: Contact): Lead {
  const email = contact.email?.trim() || "";
  const emails = email ? [email] : [];
  const id = `demo:${contact.name}|${contact.phone}|${email}|${contact.address}`;

  return {
    id,
    search_id: "demo",
    business_name: contact.name,
    phone: contact.phone || null,
    email: email || null,
    emails,
    verified_emails: emails,
    predicted_emails: [],
    extracted_email: email || null,
    generated_email: null,
    email_source: emails.length > 0 ? "extracted" : null,
    website: contact.website || null,
    address: contact.address || null,
    rating: contact.rating ?? null,
    reviews_count: null,
    category: contact.category || null,
    google_maps_url: null,
    created_at: new Date().toISOString(),
    email_scraped: emails.length > 0,
  };
}

export function DemoPageContent() {
  const isMobile = useIsMobile();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [sendPanelOpen, setSendPanelOpen] = useState(false);
  const [sendNotice, setSendNotice] = useState<{
    result: QueueSendResponse;
    recipientCount: number;
  } | null>(null);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilterValue>("all");
  const [templateLead, setTemplateLead] = useState<Lead | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [creditsRemaining, setCreditsRemaining] = useState(0);

  const tableRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const leads = useMemo(() => contacts.map(contactToLead), [contacts]);
  const ratingFilteredTableLeads = useMemo(
    () => applyRatingFilter(leads, ratingFilter),
    [leads, ratingFilter]
  );
  const statusFilteredTableLeads = useMemo(
    () => applyStatusFilter(ratingFilteredTableLeads, statusFilter, leadStatuses),
    [ratingFilteredTableLeads, statusFilter, leadStatuses]
  );
  const apiUrl = useMemo(() => resolveDemoApiUrl(), []);

  const selectedLeads = useMemo(
    () =>
      statusFilteredTableLeads.filter((lead) =>
        selectedLeadIds.has(getLeadSelectionId(lead))
      ),
    [statusFilteredTableLeads, selectedLeadIds]
  );

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const setLeadStatus = useCallback((leadId: string, status: string) => {
    setLeadStatuses((prev) => ({ ...prev, [leadId]: status }));
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!sendNotice) return;
    const timer = window.setTimeout(() => setSendNotice(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [sendNotice]);

  useEffect(() => {
    setUserEmail(localStorage.getItem("leadthur_email") || "");
  }, []);

  function startDemo(bt?: string, c?: string) {
    const bType = bt || businessType;
    const bCity = c || city;

    if (!bType || !bCity) return;

    if (!apiUrl) {
      setApiError("Demo API is not configured. Set NEXT_PUBLIC_API_URL on this frontend deployment.");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setApiError(null);
    setContacts([]);
    setTotalCount(0);
    setSearchDone(false);
    setIsSearching(true);
    setSelectedLeadIds(new Set());
    setLeadStatuses({});
    setStatusFilter("all");
    setRatingFilter("all");
    setSendPanelOpen(false);
    setSendNotice(null);

    const baseCount = 900 + Math.floor(Math.random() * 300);
    const url = `${apiUrl}/demo/search?businessType=${encodeURIComponent(bType)}&city=${encodeURIComponent(bCity)}&count=${baseCount}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        done?: boolean;
        contact?: Contact;
        total?: number;
      };

      if (data.done) {
        setSearchDone(true);
        setIsSearching(false);
        eventSource.close();
        return;
      }

      if (data.contact) {
        setContacts((prev) => [...prev, data.contact!]);
        setTotalCount(data.total ?? 0);

        if (tableRef.current) {
          tableRef.current.scrollTop = tableRef.current.scrollHeight;
        }
      }
    };

    eventSource.onerror = () => {
      setIsSearching(false);
      setSearchDone(true);
      setApiError("Failed to stream demo results. Check backend /demo/search route and CORS.");
      eventSource.close();
    };
  }

  function exportCSV() {
    const headers = ["Business Name", "Phone", "Email", "Website", "Address", "Rating", "Category"];
    const rows = contacts.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.website,
      c.address,
      c.rating,
      c.category,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadthur-${businessType}-${city}`.toLowerCase().replace(/\s+/g, "-") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSent(result: QueueSendResponse) {
    if (result.queued > 0) {
      setSendPanelOpen(false);
      setSendNotice({ result, recipientCount: selectedLeads.length });
      setSelectedLeadIds(new Set());
    }
  }

  return (
    <div
      style={{
        background: "#050508",
        minHeight: "100vh",
        color: "#F2F1FF",
        fontFamily: "Inter, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          transition: "margin 300ms ease-out",
          marginRight: sendPanelOpen ? OUTREACH_COMPOSE_PANEL_WIDTH : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "#7C3AED",
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 20, fontWeight: 800 }}>
            Lead<span style={{ color: "#A78BFA" }}>Thur</span>
          </span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#555570",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Quick searches
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESET_SEARCHES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setBusinessType(preset.businessType);
                  setCity(preset.city);
                  startDemo(preset.businessType, preset.city);
                }}
                disabled={isSearching}
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#A78BFA",
                  cursor: isSearching ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  opacity: isSearching ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Business Type
            </label>
            <input
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Restaurants, Salons, Gyms"
              style={{
                width: "100%",
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 14,
                color: "#F2F1FF",
                fontFamily: "Inter, sans-serif",
                outline: "none",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#8888A8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              City / Country
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Lagos Nigeria, London UK, Dubai UAE"
              style={{
                width: "100%",
                background: "#0A0A10",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 14,
                color: "#F2F1FF",
                fontFamily: "Inter, sans-serif",
                outline: "none",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => startDemo()}
            disabled={isSearching || !businessType || !city}
            style={{
              background: isSearching || !businessType || !city ? "#1A1A24" : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 28px",
              fontSize: 14,
              fontWeight: 700,
              cursor: isSearching || !businessType || !city ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: isSearching || !businessType || !city ? 0.6 : 1,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {apiError && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.12)",
              color: "#FCA5A5",
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            {apiError}
          </div>
        )}

        {(isSearching || searchDone) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#A78BFA" }}>
                {totalCount.toLocaleString()}
              </span>
              <span style={{ fontSize: 14, color: "#8888A8" }}>
                {isSearching ? "businesses found and counting..." : "businesses found"}
              </span>
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-[#A855F7]" />}
            </div>

            {searchDone && contacts.length > 0 && (
              <button
                type="button"
                onClick={exportCSV}
                style={{
                  background: "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Export CSV — {contacts.length.toLocaleString()} contacts
              </button>
            )}
          </div>
        )}

        {sendNotice && (
          <OutreachSendSuccessBanner
            result={sendNotice.result}
            recipientCount={sendNotice.recipientCount}
            onDismiss={() => setSendNotice(null)}
          />
        )}

        {(isSearching || leads.length > 0) ? (
          <div ref={tableRef} data-outreach-results-table>
            <ResultsTable
              leads={statusFilteredTableLeads}
              isLoading={isSearching && leads.length === 0}
              isMobile={isMobile}
              hideEmptyPlaceholder
              ratingFilter={ratingFilter}
              onRatingFilterChange={setRatingFilter}
              totalLeadCount={leads.length}
              ratingMatchCount={ratingFilteredTableLeads.length}
              summaryLeads={ratingFilteredTableLeads}
              leadStatuses={leadStatuses}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onLeadStatusChange={setLeadStatus}
              onUseTemplate={setTemplateLead}
              selectedLeadIds={selectedLeadIds}
              onToggleLeadSelect={toggleLeadSelect}
              onSendSelected={() => setSendPanelOpen(true)}
              hasMailbox
              onMarkReplied={(lead) => {
                const recipient = (lead.verified_emails?.[0] || lead.email || "").trim();
                if (!recipient) return;
                void markRecipientReplied(recipient).then(() => {
                  setLeadStatus(lead.id, "interested");
                });
              }}
            />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#555570" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#F2F1FF" }}>
              Search any business in any country
            </div>
            <div style={{ fontSize: 13, marginBottom: 24 }}>
              Type a business type and city above, or click a quick search
            </div>
          </div>
        )}
      </div>

      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads}
        mailboxes={[DEMO_MAILBOX]}
        sendBalance={DEMO_SEND_BALANCE}
        hasMailbox
        targetBusinessType={businessType}
        onClose={() => setSendPanelOpen(false)}
        onSent={handleSent}
      />

      <WhatsappTemplateModal
        lead={templateLead}
        searchLocation={city}
        userEmail={userEmail}
        creditsRemaining={creditsRemaining}
        onClose={() => setTemplateLead(null)}
        onCreditsUpdated={(balance) => setCreditsRemaining(balance)}
        onCreditDeducted={() => {}}
        onGetMoreCredits={() => {}}
      />
    </div>
  );
}
