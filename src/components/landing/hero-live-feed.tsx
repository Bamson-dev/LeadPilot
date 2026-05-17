"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FEED_POOL = [
  {
    name: "Luna Bistro",
    phone: "+234 801 234 5678",
    email: "hello@lunabistro.com",
    rating: "4.8",
  },
  {
    name: "Prime Dental Clinic",
    phone: "+234 802 345 6789",
    email: "info@primedental.ng",
    rating: "4.6",
  },
  {
    name: "Glow Beauty Salon",
    phone: "+234 803 456 7890",
    email: "book@glowsalon.com",
    rating: "4.9",
  },
  {
    name: "Harbor Grill Lagos",
    phone: "+234 805 112 3344",
    email: "reservations@harborgrill.ng",
    rating: "4.7",
  },
  {
    name: "Skyline Fitness",
    phone: "+234 807 998 2211",
    email: "contact@skylinefit.com",
    rating: "4.5",
  },
];

export function HeroLiveFeed() {
  const [count, setCount] = useState(184);
  const [visible, setVisible] = useState(FEED_POOL.slice(0, 1));

  useEffect(() => {
    const countTimer = setInterval(() => {
      setCount((c) => (c >= 237 ? 184 : c + Math.floor(Math.random() * 4) + 1));
    }, 2200);
    return () => clearInterval(countTimer);
  }, []);

  useEffect(() => {
    let index = 1;
    const rowTimer = setInterval(() => {
      const next = FEED_POOL[index % FEED_POOL.length];
      setVisible((prev) => [next, ...prev].slice(0, 4));
      index++;
    }, 2800);
    return () => clearInterval(rowTimer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="mx-auto mt-16 max-w-4xl"
    >
      <motion.div
        className="glass glow-violet rounded-2xl p-1"
        animate={{ boxShadow: ["0 0 40px rgba(124,58,237,0.15)", "0 0 60px rgba(99,102,241,0.2)", "0 0 40px rgba(124,58,237,0.15)"] }}
        transition={{ repeat: Infinity, duration: 4 }}
      >
        <motion.div
          className="rounded-xl bg-[#111113] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Live discovery feed
            </span>
            <motion.span
              key={count}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-400"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {count} businesses found…
            </motion.span>
          </div>

          <motion.div layout className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((row) => (
                <motion.div
                  key={row.name}
                  layout
                  initial={{ opacity: 0, x: -24, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 12, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/10 bg-gradient-to-r from-violet-500/[0.06] to-transparent px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <span className="font-medium text-white">{row.name}</span>
                  <span className="text-zinc-500">{row.phone}</span>
                  <span className="text-violet-300">{row.email}</span>
                  <span className="text-amber-400">★ {row.rating}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
