"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroLiveFeed } from "./hero-live-feed";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ repeat: Infinity, duration: 8 }}
      >
        <motion.div
          className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[130px]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 6 }}
        />
        <div className="absolute right-0 top-1/3 h-[320px] w-[320px] rounded-full bg-indigo-600/15 blur-[110px]" />
        <motion.div
          className="absolute -left-20 bottom-0 h-[240px] w-[240px] rounded-full bg-fuchsia-600/10 blur-[90px]"
          animate={{ x: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 10 }}
        />
      </motion.div>

      <motion.div
        className="relative mx-auto max-w-6xl px-6 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          Business discovery intelligence
        </span>

        <h1 className="mt-8 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Find Businesses To Pitch
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            In Seconds
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Discover targeted business leads instantly. Build prospect lists for
          outreach, client acquisition, and unlimited pitching opportunities —
          built for freelancers, agencies, and growth teams.
        </p>

        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <Link href="/dashboard">
            <Button variant="glow" size="lg" className="group">
              Start Finding Leads
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>

        <HeroLiveFeed />
      </motion.div>
    </section>
  );
}
