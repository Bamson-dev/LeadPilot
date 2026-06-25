"use client";

import { useState } from "react";
import { C, FONT } from "./theme";

const FAQ_ITEMS = [
  {
    q: "Does this work in my country?",
    a: "LeadThur works in 195 countries. London, New York, Dubai, Lagos, Nairobi, Toronto, Accra, Sydney, Johannesburg and everywhere in between. If businesses exist there, LeadThur finds them.",
  },
  {
    q: "Can I try before paying?",
    a: "Yes. Go to the free trial page. No account. No card. Run two real searches and see exactly what comes back before you commit to anything.",
  },
  {
    q: "Is there really no monthly fee?",
    a: "None. You pay once and that is it. No renewal. No subscription. No charge next month or next year. The only reason we mention a yearly option is because this lifetime deal closes when the slots run out.",
  },
  {
    q: "What happens after I pay?",
    a: "Card payments get instant automatic access. Bank transfer, send proof to WhatsApp 09067285890 and access is activated within minutes. Either way you are running searches the same day you pay.",
  },
  {
    q: "How many businesses can I find?",
    a: "Each search returns up to 1,000 businesses. LeadThur then suggests nearby areas so you can keep searching. Most users build lists of 2,000 to 5,000 contacts in a single session.",
  },
  {
    q: "Can I use this for cold email or WhatsApp outreach?",
    a: "Yes. Every result includes a direct phone number and email. Export the list and use it however you pitch, WhatsApp, cold email, direct calling, or all three.",
  },
  {
    q: "Is this hard to use?",
    a: "If you can type into Google, you can use LeadThur. Two fields. One button. Results in 60 seconds. Nothing to install or configure.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            textAlign: "center",
            margin: "0 0 40px",
            letterSpacing: -0.5,
          }}
        >
          A few questions people ask before signing up.
        </h2>

        <div>
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    padding: "20px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: FONT,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{item.q}</span>
                  <span
                    style={{
                      fontSize: 22,
                      color: C.purpleLight,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.3s ease",
                  }}
                >
                  <p
                    style={{
                      fontSize: 15,
                      color: C.muted,
                      lineHeight: 1.65,
                      margin: "0 0 20px",
                      paddingRight: 32,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
