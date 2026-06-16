"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  resolveWhatsappTemplates,
  WHATSAPP_NICHE_ORDER,
} from "@/lib/whatsapp-template-defaults";
import { parseSearchLocation } from "@/lib/search-location";
import {
  buildWhatsappUrl,
  personalizeWhatsappMessage,
  WHATSAPP_NICHE_LABELS,
} from "@/lib/whatsapp";
import { fetchWhatsappTemplates, generateAiMessage } from "@/services/api";
import { hasAnyEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

const AI_INTRO_DISMISSED_KEY = "leadthur_ai_modal_intro_dismissed";
const AI_MODAL_OPEN_COUNT_KEY = "leadthur_ai_modal_open_count";

interface WhatsappTemplateModalProps {
  lead: Lead | null;
  searchLocation: string;
  userEmail: string;
  creditsRemaining: number;
  onClose: () => void;
  onCreditsUpdated: (balance: number) => void;
  onCreditDeducted: () => void;
  onGetMoreCredits: () => void;
}

export function WhatsappTemplateModal({
  lead,
  searchLocation,
  userEmail,
  creditsRemaining,
  onClose,
  onCreditsUpdated,
  onCreditDeducted,
  onGetMoreCredits,
}: WhatsappTemplateModalProps) {
  const [templatesByNiche, setTemplatesByNiche] = useState(
    DEFAULT_WHATSAPP_TEMPLATES
  );
  const [selectedNiche, setSelectedNiche] = useState<string>("general");
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isAiMessage, setIsAiMessage] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [showAiIntro, setShowAiIntro] = useState(false);

  const cityLabel = useMemo(() => {
    const { city } = parseSearchLocation(searchLocation);
    return city || searchLocation;
  }, [searchLocation]);

  const staticMessage = useMemo(() => {
    const template = templatesByNiche[selectedNiche]?.[0];
    if (!lead || !template) return "";
    return personalizeWhatsappMessage(
      template.message,
      lead.business_name,
      searchLocation
    );
  }, [lead, templatesByNiche, selectedNiche, searchLocation]);

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
    setIsAiMessage(false);
    setAiError(null);
    setAiGenerating(false);
    setInsufficientCredits(creditsRemaining < 3);
    void loadTemplates();

    const dismissed =
      localStorage.getItem(AI_INTRO_DISMISSED_KEY) === "true";
    const openCount =
      parseInt(localStorage.getItem(AI_MODAL_OPEN_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(AI_MODAL_OPEN_COUNT_KEY, String(openCount));
    setShowAiIntro(!dismissed && openCount <= 3);
  }, [lead, loadTemplates, creditsRemaining]);

  useEffect(() => {
    if (!lead || isAiMessage) return;
    setMessageText(staticMessage);
  }, [lead, staticMessage, isAiMessage]);

  useEffect(() => {
    setInsufficientCredits(creditsRemaining < 3);
  }, [creditsRemaining]);

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

  const whatsappUrl = useMemo(() => {
    if (!lead) return null;
    return buildWhatsappUrl(lead.phone, messageText);
  }, [lead, messageText]);

  const visibleNiches = WHATSAPP_NICHE_ORDER.filter(
    (niche) => templatesByNiche[niche]?.length
  );

  if (!lead) return null;

  function dismissAiIntro() {
    localStorage.setItem(AI_INTRO_DISMISSED_KEY, "true");
    setShowAiIntro(false);
  }

  function handleSelectNiche(niche: string) {
    setSelectedNiche(niche);
    setIsAiMessage(false);
    setAiError(null);
  }

  async function handleGenerateAi() {
    if (!lead) return;

    if (insufficientCredits) {
      onGetMoreCredits();
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    const result = await generateAiMessage({
      email: userEmail,
      business_name: lead.business_name,
      city: cityLabel,
      niche: selectedNiche,
      rating: lead.rating,
      has_website: Boolean(lead.website?.trim()),
      has_email: hasAnyEmail(lead),
    });

    setAiGenerating(false);

    if (!result.ok) {
      if (result.status === 402) {
        setInsufficientCredits(true);
        if (typeof result.balance === "number") {
          onCreditsUpdated(result.balance);
        }
        return;
      }

      setAiError(
        result.code === "ai_not_configured"
          ? "AI generation is not configured on the server yet. Credits refunded."
          : result.message
      );
      if (typeof result.balance === "number") {
        onCreditsUpdated(result.balance);
      }
      return;
    }

    setMessageText(result.message);
    setIsAiMessage(true);
    onCreditsUpdated(result.balance);
    onCreditDeducted();
  }

  async function handleCopy() {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const aiButtonLabel = insufficientCredits
    ? "Get more credits to generate"
    : aiGenerating
      ? "Generating..."
      : "Generate with AI (3 credits)";

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
            {showAiIntro && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#C4B5FD",
                    lineHeight: 1.5,
                  }}
                >
                  New: Generate a personalized message with AI for 3 credits, or use
                  a free template below.
                </p>
                <button
                  type="button"
                  onClick={dismissAiIntro}
                  aria-label="Dismiss"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#6B6B80",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleGenerateAi()}
              disabled={aiGenerating}
              style={{
                width: "100%",
                marginBottom: 12,
                background: insufficientCredits
                  ? "rgba(124,58,237,0.08)"
                  : "rgba(124,58,237,0.16)",
                border: "1px solid rgba(124,58,237,0.35)",
                color: "#A855F7",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: aiGenerating ? "not-allowed" : "pointer",
                fontFamily: "Inter, sans-serif",
                opacity: aiGenerating ? 0.7 : 1,
              }}
            >
              {aiButtonLabel}
            </button>

            {aiError && (
              <p
                style={{
                  color: "#F87171",
                  fontSize: 12,
                  margin: "0 0 12px",
                  lineHeight: 1.5,
                }}
              >
                {aiError}
              </p>
            )}

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
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6B6B80",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Free templates
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#22C55E",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 100,
                  padding: "2px 8px",
                }}
              >
                Free
              </span>
            </div>

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
                  onClick={() => handleSelectNiche(niche)}
                  style={{
                    background:
                      selectedNiche === niche && !isAiMessage
                        ? "rgba(124,58,237,0.2)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${
                      selectedNiche === niche && !isAiMessage
                        ? "rgba(124,58,237,0.4)"
                        : "rgba(255,255,255,0.08)"
                    }`,
                    color:
                      selectedNiche === niche && !isAiMessage ? "#A855F7" : "#A1A1B5",
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

            {template || isAiMessage ? (
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
                  {isAiMessage ? "AI generated message" : template?.title}
                </div>
                <textarea
                  readOnly={!isAiMessage}
                  value={messageText}
                  onChange={(e) => {
                    if (isAiMessage) setMessageText(e.target.value);
                  }}
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
