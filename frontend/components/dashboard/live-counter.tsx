"use client";

import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

interface LiveCounterProps {
  count: number;
  isSearching: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

export function LiveCounter({ count, isSearching }: LiveCounterProps) {
  return (
    <AnimatePresence mode="wait">
      {isSearching || count > 0 ? (
        <motion.p
          key="counter"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-lg font-semibold text-white"
        >
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent tabular-nums">
            <AnimatedNumber value={count} />
          </span>{" "}
          <span className="text-zinc-400">
            prospect{count !== 1 ? "s" : ""} discovered
            {isSearching ? (
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                …
              </motion.span>
            ) : null}
          </span>
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
