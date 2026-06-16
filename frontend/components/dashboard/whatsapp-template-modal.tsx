"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  resolveWhatsappTemplates,
  WHATSAPP_NICHE_ORDER,
} from "@/lib/whatsapp-template-defaults";
import {
  buildWhatsappUrl,
  personalizeWhatsappMessage,
  WHATSAPP_NICHE_LABELS,
} from "@/lib/whatsapp";
import { fetchWhatsappTemplates } from "@/services/api";
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
  const [templatesByNiche, setTemplatesByNiche] = useState(
    DEFAULT_WHATSAPP_TEMPLATES
  );
  const [selectedNiche, setSelectedNiche] = useState<string>("general");
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchWhatsappTemplates();
      const resolved = resolveWhatsappTemplates(data.templates ?? {});
      const isFallback = Object.keys(data.templates ?? {}).length === 0;
      setTemplatesByNiche(resolved);
      setUsingFallback(isFallback);
      if (isFallback) {
        setLoadError(
          "Could not load templates from the server. Showing built-in templates instead."
        );
      }
      const niches = WHATSAPP_NICHE_ORDER.filter((n) => resolved[n]);
      setSelectedNiche((current) =>
        niches.includes(current as (typeof WHATSAPP_NICHE_ORDER)[number])
          ? current
          : niches.includes("general")
            ? "general"
            : niches[0] ?? "general"
      );
    } catch {
      setTemplatesByNiche(DEFAULT_WHATSAPP_TEMPLATES);
      setUsingFallback(true);
      setLoadError(
        "Could not load templates from the server. Showing built-in templates instead."
      );
      setSelectedNiche("general");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lead) return;
    setCopied(false);
    void loadTemplates();
  }, [lead, loadTemplates]);

  useEffect(() => {
    if (!lead) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lead, onClose]);

  const template = templatesByNiche[selectedNiche]?.[0];

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

  const visibleNiches = WHATSAPP_NICHE_ORDER.filter(
    (niche) => templatesByNiche[niche]?.length
  );

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-template-title"
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
              id="whatsapp-template-title"
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
              {searchLocation ? ` · ${searchLocation}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
          <p style={{ color: "#6B6B80", fontSize: 13, margin: "8px 0 0" }}>
            Loading templates...
          </p>
        ) : (
          <>
            {loadError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: usingFallback
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(239,68,68,0.08)",
                  border: `1px solid ${
                    usingFallback
                      ? "rgba(251,191,36,0.2)"
                      : "rgba(239,68,68,0.2)"
                  }`,
                  color: usingFallback ? "#FBBF24" : "#F87171",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {loadError}
                {usingFallback && (
                  <button
                    type="button"
                    onClick={() => void loadTemplates()}
                    style={{
                      display: "block",
                      marginTop: 8,
                      background: "transparent",
                      border: "none",
                      color: "#A855F7",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "underline",
                    }}
                  >
                    Retry loading from server
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {visibleNiches.map((niche) => (
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
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {WHATSAPP_NICHE_LABELS[niche] ?? niche}
                </button>
              ))}
            </div>

            {template ? (
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
                  rows={7}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
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
                      if (whatsappUrl) {
                        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                      }
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
                      fontFamily: "Inter, sans-serif",
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
                      fontFamily: "Inter, sans-serif",
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
            ) : (
              <p style={{ color: "#6B6B80", fontSize: 13 }}>
                No template available for this niche.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
