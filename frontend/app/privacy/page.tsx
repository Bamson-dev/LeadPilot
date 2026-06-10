import Link from "next/link";

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>

        <p style={{ fontSize: 13, color: "#555570", marginBottom: 48 }}>Last updated: June 2026</p>

        {[
          {
            title: null,
            body: "LeadThur is owned and operated by Pdigital Marketstore Ltd (RC 8015428), Lagos, Nigeria. We take your privacy seriously. This policy explains what information we collect, how we use it, and what rights you have over it.",
          },
          {
            title: "Information We Collect",
            body: "When you create an account or make a purchase on LeadThur we collect your email address and payment reference. We do not store your card details. All payments are processed securely by Paystack and Flutterwave who handle all financial data directly.\n\nWhen you use the free trial we collect no personal information. No signup is required.\n\nWhen you contact us via WhatsApp or email we collect the information you share in that conversation in order to respond to you.\n\nWe automatically collect basic usage data such as which searches you run and how often you use the platform. This helps us improve the product. We do not sell this data to anyone.",
          },
          {
            title: "How We Use Your Information",
            body: "We use your email address to send you your license key after purchase, important updates about your account, and occasional product announcements. You can unsubscribe from marketing emails at any time by replying to any email with the word unsubscribe.\n\nWe use usage data to understand how people use LeadThur so we can make it better.\n\nWe do not use your information for advertising. We do not sell your information to third parties. Ever.",
          },
          {
            title: "Data Storage",
            body: "Your account data is stored securely on Supabase infrastructure. All data is encrypted in transit using SSL. We retain your data for as long as your account is active. If you want your data deleted contact us at support@leadthur.com and we will remove it within 7 days.",
          },
          {
            title: "Cookies",
            body: "LeadThur uses minimal cookies required for the platform to function. We do not use advertising cookies or tracking cookies from third parties beyond the analytics tools we use to understand site traffic.",
          },
          {
            title: "Third Party Services",
            body: "LeadThur uses the following third party services to operate. Paystack and Flutterwave for payment processing. Brevo for transactional emails. Supabase for data storage. Cloudflare for DNS and security. These services have their own privacy policies which govern how they handle your data.",
          },
          {
            title: "Your Rights",
            body: "You have the right to access the personal data we hold about you. You have the right to request correction of inaccurate data. You have the right to request deletion of your data. You have the right to withdraw consent for marketing communications at any time.\n\nTo exercise any of these rights contact us at support@leadthur.com or WhatsApp +2349067285890.",
          },
          {
            title: "Changes to This Policy",
            body: "We may update this policy from time to time. When we do we will update the date at the top of this page. Continued use of LeadThur after any changes means you accept the updated policy.",
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
