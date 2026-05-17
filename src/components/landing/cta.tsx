"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl px-6 text-center"
      >
        <div className="glass glow-violet rounded-3xl px-8 py-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Unlimited businesses to pitch
          </h2>
          <p className="mt-4 text-zinc-400">
            Stop guessing where your next client is. Start finding them in under 60 seconds.
          </p>
          <Link href="/dashboard" className="mt-8 inline-block">
            <Button variant="glow" size="lg">
              Start Finding Leads
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
