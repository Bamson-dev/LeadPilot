import Link from "next/link";
import { Code2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel, PanelContent } from "@/components/ui/panel";
import { buildWhatsappUrl } from "@/lib/whatsapp";

const WHATSAPP_PHONE = "09023986992";
const WHATSAPP_MESSAGE =
  "Hello, I'm interested in learning more about your White-label LeadThur solution and custom software development services.";

const WHATSAPP_URL = buildWhatsappUrl(WHATSAPP_PHONE, WHATSAPP_MESSAGE);

const SERVICES = [
  {
    title: "White-label LeadThur",
    icon: Layers,
    description:
      "Launch your own branded lead generation platform without building everything from scratch.",
    detail:
      "Perfect for agencies, entrepreneurs and businesses that want to offer lead generation under their own brand.",
  },
  {
    title: "Custom Software Development",
    icon: Code2,
    description: "Need software built specifically for your business?",
    detail:
      "We design and build secure, scalable software tailored to your operations, customers and workflow. From internal business systems to customer-facing platforms, we build software that solves real business problems.",
  },
] as const;

export function EnterpriseSolutionsSection() {
  return (
    <section
      aria-labelledby="built-for-your-business-heading"
      className="border-t border-[var(--lt-border)] bg-[var(--lt-bg)] px-4 py-14 md:px-8 md:py-20"
    >
      <div className="mx-auto w-full max-w-5xl">
        <Chip className="mb-5 border-[var(--lt-border)] bg-[var(--lt-surface)] text-[var(--lt-text-muted)]">
          Built for Your Business
        </Chip>

        <h2
          id="built-for-your-business-heading"
          className="mb-5 text-3xl font-black tracking-tight text-[var(--lt-text)] md:text-4xl"
        >
          Need Software Built for Your Business?
        </h2>

        <div className="mb-12 max-w-3xl space-y-4 text-base leading-relaxed text-[var(--lt-text-muted)] md:text-lg">
          <p>
            If LeadThur has shown you what&apos;s possible, imagine what software built specifically
            for your business could do.
          </p>
          <p>
            We help businesses build custom software that automates operations, generates leads,
            improves customer experience and supports growth.
          </p>
          <p>
            We also offer white-label licensing for businesses that want to launch their own branded
            lead generation platform powered by LeadThur.
          </p>
        </div>

        <div className="mb-12 grid gap-4 sm:grid-cols-2 md:gap-6">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Panel key={service.title}>
                <PanelContent className="space-y-3 p-6 md:p-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-3)] text-[var(--lt-text-muted)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-xl font-extrabold text-[var(--lt-text)]">{service.title}</h3>
                  <p className="leading-relaxed text-[var(--lt-text-muted)]">{service.description}</p>
                  <p className="text-sm leading-relaxed text-[var(--lt-text-subtle)]">{service.detail}</p>
                </PanelContent>
              </Panel>
            );
          })}
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          {WHATSAPP_URL ? (
            <Button size="lg" className="h-12 min-h-11 px-8 text-base font-extrabold" asChild>
              <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Chat With Us on WhatsApp
              </Link>
            </Button>
          ) : null}
          <p className="max-w-sm text-sm leading-relaxed text-[var(--lt-text-subtle)]">
            Every business is different.
            <br />
            Let&apos;s discuss the right solution for yours.
          </p>
        </div>
      </div>
    </section>
  );
}
