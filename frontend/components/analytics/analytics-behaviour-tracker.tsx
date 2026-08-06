"use client";

import { useEffect } from "react";
import { track, flushAnalytics } from "@/lib/analytics";

/**
 * Passive behaviour signals — clicks, dead clicks, page exit, scroll depth.
 * No UI. Never blocks interaction.
 */
export function AnalyticsBehaviourTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pageEnteredAt = Date.now();
    let maxScrollPct = 0;
    let clickBurst = 0;
    let clickBurstReset: ReturnType<typeof setTimeout> | null = null;

    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const tag = target.tagName?.toLowerCase() || "";
        const interactive =
          tag === "button" ||
          tag === "a" ||
          tag === "input" ||
          tag === "select" ||
          tag === "textarea" ||
          Boolean(target.closest("button, a, [role='button'], input, select, textarea"));

        if (!interactive) {
          track("dead_click", {
            properties: {
              tag,
              x: e.clientX,
              y: e.clientY,
            },
            idempotencyKey: `dead_click:${window.location.pathname}:${Math.floor(Date.now() / 2000)}`,
          });
          return;
        }

        clickBurst += 1;
        if (clickBurstReset) clearTimeout(clickBurstReset);
        clickBurstReset = setTimeout(() => {
          clickBurst = 0;
        }, 800);

        if (clickBurst >= 4) {
          track("click", {
            properties: { burst: clickBurst, tag, spam: true },
            idempotencyKey: `click_spam:${window.location.pathname}:${Math.floor(Date.now() / 2000)}`,
          });
        }
      } catch {
        /* ignore */
      }
    };

    const onScroll = () => {
      try {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
        if (pct > maxScrollPct + 24) {
          maxScrollPct = pct;
          track("page_view", {
            properties: { scrollDepth: maxScrollPct, kind: "scroll_depth" },
            idempotencyKey: `scroll:${window.location.pathname}:${maxScrollPct}`,
          });
        }
      } catch {
        /* ignore */
      }
    };

    const onPageExit = () => {
      track("page_exit", {
        durationMs: Date.now() - pageEnteredAt,
        properties: { maxScrollPct, exitPath: window.location.pathname },
        idempotencyKey: `page_exit:${window.location.pathname}:${Math.floor(Date.now() / 30_000)}`,
      });
      flushAnalytics();
    };

    document.addEventListener("click", onClick, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageExit);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageExit);
      if (clickBurstReset) clearTimeout(clickBurstReset);
    };
  }, []);

  return null;
}
