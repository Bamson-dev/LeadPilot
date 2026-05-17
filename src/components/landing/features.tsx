"use client";

import { motion } from "framer-motion";
import { Target, Mail, Download, Radio } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Targeted Discovery",
    description:
      "Search any niche and city. Surface restaurants, clinics, salons, hotels, and more in seconds.",
  },
  {
    icon: Mail,
    title: "Contact Intelligence",
    description:
      "Phones, websites, and emails stream in as each business profile completes — ready for outreach.",
  },
  {
    icon: Radio,
    title: "Realtime Prospecting",
    description:
      "Watch your prospect list grow live. Every row updates as discovery runs — fast, visual, addictive.",
  },
  {
    icon: Download,
    title: "One-Click Export",
    description:
      "Export up to 200 prospects per search. CRM-ready CSV for cold email, calls, and client acquisition.",
  },
];

export function Features() {
  return (
    <section className="py-24">
      <motion.div
        className="mx-auto max-w-6xl px-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Your next clients are one search away
          </h2>
          <p className="mt-4 text-zinc-400">
            Premium prospect intelligence for people who need clients — not
            another spreadsheet tool.
          </p>
        </motion.div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass rounded-2xl p-6 transition-all duration-300 hover:border-violet-500/30 hover:shadow-[0_0_40px_rgba(124,58,237,0.12)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20">
                <feature.icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
