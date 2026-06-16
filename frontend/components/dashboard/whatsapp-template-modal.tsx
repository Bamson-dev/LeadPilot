"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildWhatsappUrl,
  personalizeWhatsappMessage,
  WHATSAPP_NICHE_LABELS,
} from "@/lib/whatsapp";
import { fetchWhatsappTemplates, type WhatsappTemplate } from "@/services/api";
import type { Lead } from "@/types/lead";

interface WhatsappTemplateModalProps {
  lead: Lead | null;
  searchLocation: string;
  onClose: () => void;
}

export function WhatsappTemplateModal({
  lead,
  searchLocation,
  onClose,
}: WhatsappTemplateModalProps) {
  const [templatesByNiche, setTemplatesByNiche] = useState<
    Record<string, WhatsappTemplate[]>
  >({});
  const [selectedNiche, setSelectedNiche] = useState<string>("general");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setLoading(true);
    void (async () => {
      try {
        const data = await fetchWhatsappTemplates();
        setTemplatesByNiche(data.templates ?? {});
        const niches = Object.keys(data.templates ?? {});
        if (niches.length > 0) {
          setSelectedNiche((current) =>
            niches.includes(current) ? current : niches.includes("general") ? "general" : niches[0]
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [lead]);

  const templates = templatesByNiche[selectedNiche] ?? [];
  const template = templates[0];

  const personalizedMessage = useMemo(() => {
    if (!lead || !template) return "";
    return personalizeWhatsappMessage(
      template.message,
      lead.business_name,
      searchLocation
    );
  }, [lead, template, searchLocation]);

  const whatsappUrl = useMemo(() => {
    if (!lead) return null;
    return buildWhatsappUrl(lead.phone, personalizedMessage);
  }, [lead, personalizedMessage]);

  if (!lead) return null;

  async function handleCopy() {
    if (!personalizedMessage) return;
    try {
      await navigator.clipboard.writeText(personalizedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: 24,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "#F4F4FF",
                fontSize: 18,
                fontWeight: 800,
                fontFamily: "Bricolage Grotesque, sans-serif",
              }}
            >
              WhatsApp Templates
            </h3>
            <p style={{ margin: "6px 0 0", color: "#6B6B80", fontSize: 13 }}>
              {lead.business_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#6B6B80",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#6B6B80", fontSize: 13 }}>Loading templates...</p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {Object.keys(templatesByNiche).map((niche) => (
                <button
                  key={niche}
                  type="button"
                  onClick={() => setSelectedNiche(niche)}
                  style={{
                    background:
                      selectedNiche === niche
                        ? "rgba(124,58,237,0.2)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${
                      selectedNiche === niche
                        ? "rgba(124,58,237,0.4)"
                        : "rgba(255,255,255,0.08)"
                    }`,
                    color: selectedNiche === niche ? "#A855F7" : "#A1A1B5",
                    borderRadius: 100,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {WHATSAPP_NICHE_LABELS[niche] ?? niche}
                </button>
              ))}
            </div>

            {template && (
              <>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#A855F7",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {template.title}
                </div>
                <textarea
                  readOnly
                  value={personalizedMessage}
                  rows={6}
                  style={{
                    width: "100%",
                    background: "#0A0A10",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 12,
                    color: "#F4F4FF",
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: "vertical",
                    fontFamily: "Inter, sans-serif",
                    marginBottom: 14,
                  }}
                />

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button
                    type="button"
                    disabled={!whatsappUrl}
                    onClick={() => {
                      if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                    }}
                    style={{
                      background: whatsappUrl ? "#25D366" : "#1A1A24",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: whatsappUrl ? "pointer" : "not-allowed",
                    }}
                  >
                    Send via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    style={{
                      background: "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#A855F7",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "Copied!" : "Copy Message"}
                  </button>
                </div>

                {!lead.phone && (
                  <p style={{ color: "#F87171", fontSize: 12, marginTop: 12 }}>
                    This business has no phone number on file.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
