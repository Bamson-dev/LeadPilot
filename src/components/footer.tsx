"use client";

import { motion } from "framer-motion";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#09090B]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center">
        <p className="text-sm font-medium text-zinc-300">
          Lead<span className="text-violet-400">Pilot</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">Built by Bamidele Matthew</p>
        <p className="mt-2 text-xs text-zinc-500">
          Need a custom software for your business?
        </p>
        <motion.a
          href="https://wa.link/v2tg5k"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-full border border-violet-500/30 bg-violet-600/10 px-5 py-2 text-sm font-medium text-violet-300 transition-all duration-300 hover:border-violet-400/50 hover:bg-violet-600/20 hover:text-white hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] cursor-pointer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          Work With Me
        </motion.a>
      </div>
    </footer>
  );
}
