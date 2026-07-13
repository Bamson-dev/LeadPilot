import Link from "next/link";
import { LeadThurLogo } from "./LeadThurLogo";
import { C, FONT, LOGIN } from "./theme";

export function Footer() {
  return (
    <footer
      style={{
        backgroundColor: C.bg,
        borderTop: `1px solid ${C.border}`,
        padding: "40px 24px",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <LeadThurLogo size="sm" />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 20,
            fontSize: 13,
            color: C.muted,
          }}
        >
          <Link href={LOGIN} style={{ color: C.muted, textDecoration: "none" }}>
            Log in
          </Link>
          <span>
            Questions?{" "}
            <a href="mailto:support@leadthur.com" style={{ color: C.green }}>
              support@leadthur.com
            </a>
          </span>
          <span>© 2026 LeadThur. All rights reserved.</span>
          <Link href="/privacy" style={{ color: C.muted, textDecoration: "none" }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: C.muted, textDecoration: "none" }}>
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
