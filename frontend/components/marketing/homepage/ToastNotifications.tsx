"use client";

import { useEffect, useState } from "react";
import { C, FONT } from "./theme";

const TOASTS = [
  {
    flag: "🇳🇬",
    initial: "D",
    color: "#10B981",
    name: "Daniel",
    city: "Ibadan",
    message: "just found 1,000+ businesses in Ibadan",
  },
  {
    flag: "🇬🇧",
    initial: "S",
    color: "#7C3AED",
    name: "Sophie",
    city: "London",
    message: "just discovered a new client using LeadThur",
  },
  {
    flag: "🇳🇬",
    initial: "A",
    color: "#F97316",
    name: "Amaka",
    city: "Lagos",
    message: "just got access to LeadThur",
  },
  {
    flag: "🇬🇭",
    initial: "K",
    color: "#10B981",
    name: "Kwame",
    city: "Accra",
    message: "just closed a new client",
  },
  {
    flag: "🇳🇬",
    initial: "T",
    color: "#7C3AED",
    name: "Tunde",
    city: "Abuja",
    message: "just found 1,000+ businesses in Abuja",
  },
  {
    flag: "🇿🇦",
    initial: "L",
    color: "#F97316",
    name: "Lerato",
    city: "Joburg",
    message: "just discovered a new client using LeadThur",
  },
  {
    flag: "🇦🇪",
    initial: "O",
    color: "#10B981",
    name: "Omar",
    city: "Dubai",
    message: "just got access to LeadThur",
  },
  {
    flag: "🇰🇪",
    initial: "W",
    color: "#7C3AED",
    name: "Wanjiru",
    city: "Nairobi",
    message: "just closed a new client",
  },
];

const VISIBLE_MS = 5000;
const INTERVAL_MS = 14000;

export function ToastNotifications() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [hiddenMobile, setHiddenMobile] = useState(true);

  useEffect(() => {
    const check = () => setHiddenMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (hiddenMobile) return;

    let hideTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;

    function showToast(index: number) {
      setActiveIndex(index);
      setVisible(true);

      hideTimer = setTimeout(() => {
        setVisible(false);
      }, VISIBLE_MS);

      if (index < TOASTS.length - 1) {
        nextTimer = setTimeout(() => {
          showToast(index + 1);
        }, INTERVAL_MS);
      }
    }

    const startTimer = setTimeout(() => showToast(0), 2000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, [hiddenMobile]);

  if (hiddenMobile || activeIndex === null) return null;

  const toast = TOASTS[activeIndex];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 9999,
        fontFamily: FONT,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        pointerEvents: "none",
        animation: visible ? "marketing-toast-in 0.35s ease" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 12,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          maxWidth: 320,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: toast.color,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {toast.initial}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          <div style={{ color: C.text, fontWeight: 700 }}>
            {toast.flag} {toast.name} · {toast.city}
          </div>
          <div style={{ color: C.muted }}>{toast.message}</div>
        </div>
      </div>
    </div>
  );
}
