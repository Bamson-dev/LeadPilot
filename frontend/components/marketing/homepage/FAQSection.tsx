"use client";

import { useState } from "react";
import { C, FONT, TAP_TARGET } from "./theme";

const FAQ_ITEMS = [
  {
    q: "Can I test it before I pay.",
    a: "Yes and you should. Two full searches free, no card needed. Run it on your own service in whichever city you want to sell into, and look at the real phone numbers and real email addresses that come back. Decide after you have proved it works for your situation rather than somebody else's.",
  },
  {
    q: "Do my clients have to live near me.",
    a: "No, and this is where most people leave money on the table. LeadThur covers 195 countries, so you can pull businesses in London, Toronto, Dubai or Nairobi in the same sixty seconds it takes to search your own street. Those businesses pay in pounds and dollars and they care about the work rather than where you sit while you do it.",
  },
  {
    q: "Where do the emails send from.",
    a: "From your own inbox. You connect your email once, then LeadThur sends on your behalf. The business sees your name and your address, and their reply comes straight back to you with nobody standing between you and your client.",
  },
  {
    q: "What do I even say to these businesses.",
    a: "Describe what you sell and the AI writes the email for you, opening with something specific about that business and ending with a clear ask. You can change any word before it goes, and there are done for you templates by service if you would rather start from one of those.",
  },
  {
    q: "Where does the data come from.",
    a: "Public business listings and the businesses own websites. Everything LeadThur returns is information the business already publishes so that customers can reach them.",
  },
  {
    q: "What happens after the 20 slots are gone.",
    a: "The price becomes $100 per year. Everybody who claimed a slot before then keeps lifetime access at $25 and never pays again, including every feature we build later.",
  },
  {
    q: "Is this hard to use.",
    a: "You type a business type, you type a city, you press search. If you can use Google you can use LeadThur. Most people run their first search in under two minutes and send their first pitch the same day.",
  },
  {
    q: "What if it does not work for me.",
    a: "Then you get your money back within 30 days and you keep everything you downloaded. We would rather refund you than have you sitting on something you never use.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div>
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  style={{
                    ...TAP_TARGET,
                    width: "100%",
                    justifyContent: "space-between",
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
