import Link from "next/link";

export default function TermsPage() {
  return (
    <div
      style={{
        background: "#050508",
        minHeight: "100vh",
        color: "#F2F1FF",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "rgba(5,5,8,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: "#7C3AED",
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "white",
            }}
          >
            LT
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#F2F1FF" }}>
            Lead<span style={{ color: "#A78BFA" }}>Thur</span>
          </span>
        </Link>
        <Link href="/" style={{ color: "#A78BFA", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          ← Back to Home
        </Link>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: -1.5,
            color: "#F2F1FF",
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          Terms of Service
        </h1>

        <p style={{ fontSize: 13, color: "#555570", marginBottom: 48 }}>Last updated: June 2026</p>

        {[
          {
            title: null,
            body: "These terms govern your use of LeadThur, owned and operated by Pdigital Marketstore Ltd (RC 8015428), Lagos, Nigeria. By accessing or using LeadThur you agree to these terms. If you do not agree do not use the platform.",
          },
          {
            title: "What LeadThur Does",
            body: "LeadThur is a business contact discovery platform. It helps users find publicly available business information including business names, phone numbers, emails, addresses, websites, and Google ratings. All information returned by LeadThur is sourced from publicly accessible listings.",
          },
          {
            title: "Your Account",
            body: "You are responsible for keeping your login credentials secure. You may not share your account with other people. Each license covers use on up to 4 devices. If we detect account sharing we reserve the right to suspend access without a refund.",
          },
          {
            title: "Acceptable Use",
            body: "You agree to use LeadThur only for lawful business prospecting and outreach purposes. You agree not to use LeadThur to spam, harass, or contact businesses in violation of applicable laws including but not limited to GDPR, CAN-SPAM, and CASL where applicable.\n\nYou agree not to resell, redistribute, or scrape data from LeadThur for commercial purposes beyond your own outreach.\n\nWe reserve the right to suspend or terminate accounts that violate these terms without prior notice.",
          },
          {
            title: "Payment and Refunds",
            body: "LeadThur is sold as a subscription or one time payment depending on the plan available at the time of purchase. All payments are final. We do not offer refunds except in cases where LeadThur fails to function as described on your first search after purchase. In that case contact us within 7 days at support@leadthur.com and we will assist you personally.",
          },
          {
            title: "Data and Results",
            body: "LeadThur pulls information from publicly available sources. We do not guarantee the accuracy, completeness, or freshness of any result. Contact details change. Some businesses may have outdated information. LeadThur is a discovery tool and results should be verified before use in critical business decisions.",
          },
          {
            title: "Intellectual Property",
            body: "All code, design, branding, and content on LeadThur is owned by Pdigital Marketstore Ltd. You may not copy, reproduce, or distribute any part of the platform without written permission.",
          },
          {
            title: "Limitation of Liability",
            body: "LeadThur is provided as is. We are not liable for any loss of business, revenue, or data arising from your use of the platform. Our maximum liability to you in any circumstance is limited to the amount you paid for your LeadThur subscription.",
          },
          {
            title: "Changes to These Terms",
            body: "We may update these terms at any time. Continued use of LeadThur after changes means you accept the updated terms. We will notify active users of significant changes by email.",
          },
          {
            title: "Governing Law",
            body: "These terms are governed by the laws of the Federal Republic of Nigeria.",
          },
          {
            title: "Contact",
            body: "Pdigital Marketstore Ltd (RC 8015428)\nLagos, Nigeria\nsupport@leadthur.com\nWhatsApp: +2349067285890",
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 36 }}>
            {section.title && (
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#F2F1FF",
                  marginBottom: 12,
                  letterSpacing: -0.5,
                }}
              >
                {section.title}
              </h2>
            )}
            {section.body.split("\n\n").map((para, j) => (
              <p
                key={j}
                style={{
                  fontSize: 15,
                  color: "#8888A8",
                  lineHeight: 1.8,
                  marginBottom: 12,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {para}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "#555570",
        }}
      >
        <p style={{ marginBottom: 8 }}>
          <strong style={{ color: "#F2F1FF" }}>LeadThur</strong> — Business Discovery Intelligence
        </p>
        <p>Built by Pdigital Marketstore Ltd (RC 8015428) · Lagos, Nigeria</p>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/privacy" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 12 }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 12 }}>
            Terms of Service
          </Link>
          <Link href="/about" style={{ color: "#A78BFA", textDecoration: "none", fontSize: 12 }}>
            About
          </Link>
        </div>
      </div>
    </div>
  );
}
