import type { Metadata } from "next";
import Link from "next/link";
import { PublicContentShell } from "@/components/public/public-content-shell";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel, PanelContent } from "@/components/ui/panel";

export const metadata: Metadata = {
  title: "About LeadThur — Built in Lagos. Used Worldwide.",
  description:
    "LeadThur is built by Pdigital Marketstore Ltd (RC 8015428) in Lagos, Nigeria. We help freelancers, agency owners, and consultants find business contacts in any city worldwide in under 60 seconds.",
  keywords:
    "about LeadThur, Pdigital Marketstore, Bamidele Matthew, Nigerian SaaS, African lead generation startup, Lagos tech company",
  alternates: {
    canonical: "https://www.leadthur.com/about",
  },
  openGraph: {
    title: "About LeadThur — Built in Lagos. Used Worldwide.",
    description:
      "LeadThur is built by Pdigital Marketstore Ltd in Lagos, Nigeria. We help freelancers find business contacts in any city in 60 seconds.",
    url: "https://www.leadthur.com/about",
    siteName: "LeadThur",
    images: [
      {
        url: "https://www.leadthur.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "About LeadThur",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About LeadThur — Built in Lagos. Used Worldwide.",
    description:
      "Built by Pdigital Marketstore Ltd in Lagos, Nigeria. Find business contacts in any city in 60 seconds.",
    creator: "@BamsonOfficial",
    images: ["https://www.leadthur.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const STATS = [
  { number: "195+", label: "Countries covered" },
  { number: "1,000+", label: "Leads per search" },
  { number: "60s", label: "To first result" },
];

const PROMISES = [
  "We will always be honest about what LeadThur can and cannot do.",
  "We will always respond to support messages personally.",
  "We will always build features that make your work easier not more complicated.",
  "We will never sell your data to anyone.",
];

const CONTACTS = [
  { label: "Email", value: "support@leadthur.com", href: "mailto:support@leadthur.com" },
  { label: "WhatsApp", value: "+2349067285890", href: "https://wa.link/87ruc1" },
  { label: "Website", value: "leadthur.com", href: "https://www.leadthur.com" },
];

export default function AboutPage() {
  return (
    <PublicContentShell mainClassName="max-w-2xl">
      <Chip className="mb-6 border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/10 text-[var(--lt-accent-soft)]">
        Built in Lagos. Used worldwide.
      </Chip>

      <h1 className="mb-5 text-4xl font-black leading-tight tracking-tight text-[var(--lt-text)] md:text-5xl">
        About LeadThur
      </h1>

      <p className="mb-12 text-lg leading-relaxed text-[var(--lt-text-muted)]">
        LeadThur is a business contact discovery platform built for freelancers, agency owners,
        consultants, digital marketers, and anyone who sells services to other businesses.
      </p>

      <Panel className="mb-8">
        <PanelContent className="space-y-4 p-6 md:p-8">
          <h2 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--lt-text)]">
            Why We Built This
          </h2>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            LeadThur was created by Bamidele, founder of Pdigital Marketstore Ltd, after experiencing
            firsthand how much time service providers waste searching for clients manually.
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            The average freelancer spends 3 to 5 hours every week just finding businesses to pitch.
            That is time that should be spent doing the work, not hunting for it.
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            We built LeadThur to give that time back. Type any business type and any city. Get a full
            list of contacts instantly. No manual searching. No tab switching. No copying numbers into
            spreadsheets. Just results.
          </p>
        </PanelContent>
      </Panel>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map((stat) => (
          <Panel key={stat.label}>
            <PanelContent className="p-5 text-center">
              <div className="text-3xl font-black tracking-tight text-[var(--lt-accent-soft)]">
                {stat.number}
              </div>
              <div className="mt-1 text-xs text-[var(--lt-text-subtle)]">{stat.label}</div>
            </PanelContent>
          </Panel>
        ))}
      </div>

      <Panel className="mb-8">
        <PanelContent className="space-y-4 p-6 md:p-8">
          <h2 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--lt-text)]">
            Who We Are
          </h2>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            LeadThur is owned and operated by Pdigital Marketstore Ltd (RC 8015428), a digital
            technology company based in Lagos, Nigeria.
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            We serve freelancers, agencies, and digital marketers across Nigeria, Ghana, Kenya, South
            Africa, the United Arab Emirates, the United Kingdom, Canada, and beyond.
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            We are a small team that cares deeply about the product we are building and the people
            using it. Every feature on LeadThur came from a real user request. Every update we ship
            solves a real problem.
          </p>
        </PanelContent>
      </Panel>

      <Panel className="mb-12 border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/5">
        <PanelContent className="space-y-4 p-6 md:p-8">
          <h2 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--lt-text)]">
            Our Promise
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-3 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
                <span className="mt-0.5 shrink-0 font-extrabold text-[var(--lt-success)]">✓</span>
                <span>{promise}</span>
              </li>
            ))}
          </ul>
        </PanelContent>
      </Panel>

      <Panel className="mb-12">
        <PanelContent className="space-y-5 p-6 md:p-8">
          <h2 className="m-0 text-2xl font-extrabold tracking-tight text-[var(--lt-text)]">
            Get In Touch
          </h2>
          <p className="m-0 text-sm leading-relaxed text-[var(--lt-text-muted)] md:text-base">
            If you have a question, a suggestion, or a problem reach us at any time. A real person
            will reply.
          </p>
          <div className="flex flex-col gap-3">
            {CONTACTS.map((contact) => (
              <div key={contact.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-[var(--lt-text-subtle)]">
                  {contact.label}
                </span>
                <a
                  href={contact.href}
                  className="text-sm font-semibold text-[var(--lt-accent-soft)] no-underline hover:underline"
                >
                  {contact.value}
                </a>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <div className="text-center">
        <Button size="lg" className="h-12 px-10 text-base font-extrabold" asChild>
          <Link href="/freetrial">Try LeadThur Free →</Link>
        </Button>
      </div>
    </PublicContentShell>
  );
}
