"use client";

import Link from "next/link";
import { LeadThurLogo } from "./LeadThurLogo";
import { CHECKOUT, C, FONT, FREETRIAL } from "./theme";

export function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(5,5,8,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <LeadThurLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Link
            href={FREETRIAL}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: C.purple,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Get Started Free
          </Link>
          <Link
            href={CHECKOUT}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              backgroundColor: "transparent",
            }}
          >
            Get Lifetime Access
          </Link>
        </div>
      </div>
    </nav>
  );
}
