"use client";

import { motion } from "framer-motion";

const useCases = [
  "Freelancers pitching local businesses",
  "Marketing agencies building prospect lists",
  "Web designers finding clients without websites",
  "Recruiters sourcing company contacts",
  "Virtual assistants doing lead research",
  "Outreach teams scaling cold campaigns",
];

export function UseCases() {
  return (
    <section className="border-y border-white/[0.06] bg-[#111113]/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">
          Built for people who need clients
        </h2>
        <p className="mt-4 text-center text-zinc-400">
          Whether you&apos;re solo or scaling a team, LeadPilot powers your pipeline.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-xs font-bold text-violet-300">
                {i + 1}
              </span>
              <span className="text-sm text-zinc-300">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
