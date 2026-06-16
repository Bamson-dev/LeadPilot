"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { WebsiteLink } from "@/components/dashboard/website-link";
import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface MobileLeadCardProps {
  lead: Lead;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  status?: string;
  onStatusChange?: (leadId: string, status: string) => void;
  onUseTemplate?: (lead: Lead) => void;
}

export function MobileLeadCard({
  lead,
  copiedId,
  onCopy,
  status = "new",
  onStatusChange,
  onUseTemplate,
}: MobileLeadCardProps) {
  const emails = getAllEmailsForDisplay(lead);
  const isPredicted = lead.email_source === "predicted";

  return (
    <div
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            color: "#F4F4FF",
            fontWeight: 700,
            fontSize: 15,
            fontFamily: "Bricolage Grotesque, sans-serif",
            marginBottom: 2,
          }}
        >
          {lead.business_name}
        </div>
        {lead.category && (
          <div style={{ color: "#6B6B80", fontSize: 12 }}>{lead.category}</div>
        )}
      </div>

      {lead.rating != null && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(251,191,36,0.1)",
            padding: "3px 8px",
            borderRadius: 100,
            marginBottom: 12,
          }}
        >
          <span style={{ color: "#FBBF24", fontSize: 12 }}>★</span>
          <span style={{ color: "#FBBF24", fontSize: 12, fontWeight: 600 }}>
            {lead.rating}
          </span>
          {lead.reviews_count != null && (
            <span style={{ color: "#6B6B80", fontSize: 11 }}>
              ({lead.reviews_count.toLocaleString()})
            </span>
          )}
        </div>
      )}

      {lead.address && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "#6B6B80", fontSize: 12, flexShrink: 0 }}>📍</span>
          <span style={{ color: "#A1A1AA", fontSize: 12, lineHeight: 1.4 }}>
            {lead.address}
          </span>
        </div>
      )}

      {lead.phone && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={{ color: "#6B6B80", fontSize: 12 }}>📞</span>
          <a
            href={`tel:${lead.phone}`}
            style={{
              color: "#F4F4FF",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              flex: 1,
            }}
          >
            {lead.phone}
          </a>
          <CopyButton
            value={lead.phone}
            copyId={`phone-${lead.id}`}
            copiedId={copiedId}
            onCopy={onCopy}
            alwaysVisible
            variant="pill"
          />
        </div>
      )}

      {emails.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {emails.map((email, ei) => (
            <div
              key={`${lead.id}-email-${ei}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ color: "#6B6B80", fontSize: 12 }}>✉️</span>
              {isPredicted && (
                <div
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#3B82F6",
                    flexShrink: 0,
                  }}
                />
              )}
              <a
                href={`mailto:${email}`}
                style={{
                  color: "#F4F4FF",
                  fontSize: 12,
                  textDecoration: "none",
                  flex: 1,
                  wordBreak: "break-all",
                }}
              >
                {email}
              </a>
              <CopyButton
                value={email}
                copyId={`email-${lead.id}-${ei}`}
                copiedId={copiedId}
                onCopy={onCopy}
                alwaysVisible
                variant="pill"
              />
            </div>
          ))}
        </div>
      )}

      {lead.website && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#6B6B80", fontSize: 12 }}>🌐</span>
          <WebsiteLink website={lead.website} maxLength={30} />
        </div>
      )}

      {onStatusChange && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <LeadStatusSelect
            leadId={lead.id}
            status={status}
            onChange={onStatusChange}
            fullWidth
          />
          {onUseTemplate && (
            <button
              type="button"
              onClick={() => onUseTemplate(lead)}
              style={{
                width: "100%",
                background: "rgba(37,211,102,0.1)",
                border: "1px solid rgba(37,211,102,0.25)",
                color: "#25D366",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Use Template
            </button>
          )}
        </div>
      )}
    </div>
  );
}
