import Link from "next/link";

export default function AboutPage() {
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

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.2)",
            padding: "7px 16px",
            borderRadius: 100,
            fontSize: 12,
            color: "#A78BFA",
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          Built in Lagos. Used worldwide.
        </div>

        <h1
          style={{
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: -2,
            color: "#F2F1FF",
            marginBottom: 20,
            lineHeight: 1.05,
          }}
        >
          About LeadThur
        </h1>

        <p style={{ fontSize: 18, color: "#8888A8", lineHeight: 1.8, marginBottom: 48 }}>
          LeadThur is a business contact discovery platform built for freelancers, agency owners,
          consultants, digital marketers, and anyone who sells services to other businesses.
        </p>

        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#F2F1FF",
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            Why We Built This
          </h2>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8, marginBottom: 16 }}>
            LeadThur was created by Bamidele, founder of Pdigital Marketstore Ltd, after experiencing
            firsthand how much time service providers waste searching for clients manually.
          </p>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8, marginBottom: 16 }}>
            The average freelancer spends 3 to 5 hours every week just finding businesses to pitch.
            That is time that should be spent doing the work, not hunting for it.
          </p>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8 }}>
            We built LeadThur to give that time back. Type any business type and any city. Get a full
            list of contacts instantly. No manual searching. No tab switching. No copying numbers into
            spreadsheets. Just results.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            { number: "195+", label: "Countries covered" },
            { number: "1,000+", label: "Leads per search" },
            { number: "60s", label: "To first result" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#A78BFA",
                  letterSpacing: -1,
                  marginBottom: 4,
                }}
              >
                {stat.number}
              </div>
              <div style={{ fontSize: 12, color: "#555570" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#F2F1FF",
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            Who We Are
          </h2>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8, marginBottom: 16 }}>
            LeadThur is owned and operated by Pdigital Marketstore Ltd (RC 8015428), a digital
            technology company based in Lagos, Nigeria.
          </p>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8, marginBottom: 16 }}>
            We serve freelancers, agencies, and digital marketers across Nigeria, Ghana, Kenya, South
            Africa, the United Arab Emirates, the United Kingdom, Canada, and beyond.
          </p>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8 }}>
            We are a small team that cares deeply about the product we are building and the people
            using it. Every feature on LeadThur came from a real user request. Every update we ship
            solves a real problem.
          </p>
        </div>

        <div
          style={{
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 48,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#F2F1FF",
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            Our Promise
          </h2>
          {[
            "We will always be honest about what LeadThur can and cannot do.",
            "We will always respond to support messages personally.",
            "We will always build features that make your work easier not more complicated.",
            "We will never sell your data to anyone.",
          ].map((promise, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: i < 3 ? 12 : 0,
              }}
            >
              <span
                style={{
                  color: "#10B981",
                  fontWeight: 800,
                  fontSize: 15,
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.7, margin: 0 }}>{promise}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 32,
            marginBottom: 48,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#F2F1FF",
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            Get In Touch
          </h2>
          <p style={{ fontSize: 15, color: "#8888A8", lineHeight: 1.8, marginBottom: 20 }}>
            If you have a question, a suggestion, or a problem reach us at any time. A real person
            will reply.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Email", value: "support@leadthur.com", href: "mailto:support@leadthur.com" },
              { label: "WhatsApp", value: "+2349067285890", href: "https://wa.link/87ruc1" },
              { label: "Website", value: "leadthur.com", href: "https://www.leadthur.com" },
            ].map((contact) => (
              <div key={contact.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#555570",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    width: 72,
                    flexShrink: 0,
                  }}
                >
                  {contact.label}
                </span>
                <a
                  href={contact.href}
                  style={{
                    fontSize: 15,
                    color: "#A78BFA",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {contact.value}
                </a>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#7C3AED",
              color: "white",
              fontWeight: 800,
              fontSize: 16,
              padding: "16px 40px",
              borderRadius: 14,
              textDecoration: "none",
              boxShadow: "0 0 50px rgba(124,58,237,0.4)",
            }}
          >
            Try LeadThur Free →
          </Link>
        </div>
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
