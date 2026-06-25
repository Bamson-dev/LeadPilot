"use client";

import Link from "next/link";
import { COMPARE_AT_PRICE_USD, SALE_PRICE_USD } from "@/constants/pricing";
import { CHECKOUT, C, FONT } from "./theme";

const CHECKLIST = [
  "1,000+ businesses per search in any city worldwide",
  "Direct phone numbers and email addresses",
  "Websites and Google ratings per business",
  "Live streaming results in under 60 seconds",
  "One-click CSV export unlimited searches",
  "195+ countries covered",
  "Search history saved automatically",
  "All future updates included at no extra cost",
];

const VALUE_ROWS = [
  { item: "1,000+ business contacts per search", value: "$200+ per list" },
  { item: "Direct phone numbers and emails", value: "$150+ from data providers" },
  { item: "Unlimited searches, 195 countries", value: "$97/month on competitors" },
  { item: "Lifetime access, all future updates", value: "$0 extra. Ever." },
];

const MARKET_VALUE_TOTAL = "$1,460+";

export function AssuranceBlock() {
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 12,
        background: C.bgCard,
        border: "1px solid rgba(16,185,129,0.25)",
        fontSize: 14,
        lineHeight: 1.65,
        color: C.muted,
      }}
    >
      <span style={{ color: C.green, fontWeight: 700 }}>✓ We are confident this works.</span>{" "}
      LeadThur has returned results in every city and country it has been tested in. If for any
      reason your very first search comes back empty, reach out to us directly and we will make
      it right. We have never had to do this. But we want you to know the option is there.
    </div>
  );
}

function PaymentTrustRow() {
  return (
    <div style={{ marginTop: 14, textAlign: "center" }}>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 12,
          color: C.muted,
          lineHeight: 1.5,
        }}
      >
        Secure payment. Instant access. Cancel anytime.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          opacity: 0.55,
        }}
        aria-label="Accepted payment methods"
      >
        <svg width="36" height="14" viewBox="0 0 36 14" fill="none" aria-hidden>
          <text
            x="0"
            y="11"
            fill={C.muted}
            fontSize="11"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
            letterSpacing="0.5"
          >
            VISA
          </text>
        </svg>
        <svg width="44" height="14" viewBox="0 0 44 14" fill="none" aria-hidden>
          <circle cx="14" cy="7" r="5" fill="#7878A0" opacity="0.7" />
          <circle cx="20" cy="7" r="5" fill="#7878A0" opacity="0.45" />
          <text
            x="28"
            y="11"
            fill={C.muted}
            fontSize="9"
            fontWeight="600"
            fontFamily="Arial, sans-serif"
          >
            MC
          </text>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="2"
            stroke={C.muted}
            strokeWidth="1.5"
          />
          <path
            d="M8 11V8a4 4 0 0 1 8 0v3"
            stroke={C.muted}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function PricingCard() {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        border: `2px solid ${C.purple}`,
        background: C.bgCard,
        overflow: "hidden",
        boxShadow: "0 0 80px rgba(124,58,237,0.15)",
      }}
    >
      <div
        style={{
          background: `linear-gradient(90deg, ${C.purple}, #9461FA)`,
          textAlign: "center",
          padding: "8px 16px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#fff",
        }}
      >
        LIFETIME ACCESS
      </div>
      <div style={{ padding: "28px 24px" }}>
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              fontSize: 16,
              color: C.muted,
              textDecoration: "line-through",
              marginRight: 10,
            }}
          >
            ${COMPARE_AT_PRICE_USD}
          </span>
          <span
            style={{
              fontSize: "clamp(48px, 8vw, 72px)",
              fontWeight: 900,
              color: C.text,
              letterSpacing: -2,
            }}
          >
            ${SALE_PRICE_USD}
          </span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 20px" }}>
          One-time payment · No monthly fees · No renewal · Ever.
        </p>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: C.muted,
              marginBottom: 8,
            }}
          >
            <span>Filling up fast</span>
            <span>Limited slots remaining</span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: C.bgSecondary,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "70%",
                height: "100%",
                background: C.green,
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        <ul
          style={{
            listStyle: "none",
            margin: "0 0 24px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {CHECKLIST.map((item) => (
            <li
              key={item}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 14,
                color: C.muted,
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>✓</span>
              {item}
            </li>
          ))}
        </ul>

        <AssuranceBlock />

        <Link
          href={CHECKOUT}
          className="marketing-cta-glow"
          style={{
            display: "block",
            marginTop: 20,
            padding: "16px 24px",
            borderRadius: 12,
            background: C.purple,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Get Lifetime Access Now →
        </Link>

        <PaymentTrustRow />
      </div>
    </div>
  );
}

interface PricingSectionProps {
  variant?: "primary" | "secondary";
}

export function PricingSection({ variant = "primary" }: PricingSectionProps) {
  const isPrimary = variant === "primary";

  return (
    <section
      id={isPrimary ? "pricing" : undefined}
      style={{
        backgroundColor: C.bg,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {isPrimary ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.red,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  marginBottom: 16,
                }}
              >
                ⚡ Lifetime deal — limited slots
              </span>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 900,
                  color: C.text,
                  margin: "0 0 12px",
                  letterSpacing: -1,
                }}
              >
                Pay once. Access forever.
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: C.muted,
                  maxWidth: 620,
                  margin: "0 auto",
                  lineHeight: 1.65,
                }}
              >
                No subscription. No monthly charge. No renewal. Pay once and LeadThur is yours
                forever. The lifetime deal closes when the remaining slots are gone. After that it
                moves to a yearly plan.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderRadius: 12,
                  background: "rgba(16,185,129,0.06)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <div style={{ fontWeight: 800, color: C.green, marginBottom: 8 }}>Get in now</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
                  One payment. Access forever. Zero next year.
                </div>
              </div>
              <div
                style={{
                  padding: "20px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <div style={{ fontWeight: 800, color: C.red, marginBottom: 8 }}>
                  Wait and pay later
                </div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
                  Yearly plan. Pay every year. Renew or lose access.
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "24px",
                borderRadius: 14,
                border: `1px solid rgba(167,139,250,0.35)`,
                background: C.bgCard,
                marginBottom: 32,
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.purpleLight,
                  margin: "0 0 20px",
                }}
              >
                What you get for the price of one client
              </h3>
              {VALUE_ROWS.map((row) => (
                <div
                  key={row.item}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "12px 0",
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: C.text }}>{row.item}</span>
                  <span style={{ color: C.muted, whiteSpace: "nowrap" }}>
                    market value {row.value}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 20,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <span style={{ color: C.muted, textDecoration: "line-through", fontSize: 15 }}>
                  Market value of all this combined: {MARKET_VALUE_TOTAL}
                </span>
                <span style={{ color: C.green, fontWeight: 800, fontSize: 16 }}>
                  Your price today: ${SALE_PRICE_USD}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 900,
                color: C.text,
                margin: "0 0 12px",
                letterSpacing: -1,
              }}
            >
              Still here? You already know you need this.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: C.muted,
                maxWidth: 560,
                margin: "0 auto",
                lineHeight: 1.65,
              }}
            >
              The people who acted earlier today made a good decision. Every slot that goes is one
              less at the lifetime price.
            </p>
          </div>
        )}

        <PricingCard />
      </div>
    </section>
  );
}
