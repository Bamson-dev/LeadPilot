import Link from "next/link";
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
    description: "Launch your own branded lead generation platform powered by LeadThur.",
    detail:
      "Perfect for agencies, entrepreneurs and businesses looking to offer lead generation under their own brand.",
  },
  {
    title: "Custom Software Development",
    description: "Need software built specifically for your business?",
    detail:
      "We design and build secure, scalable software tailored to your operations, customers and workflows.",
  },
] as const;

export function EnterpriseSolutionsSection() {
  return (
    <section
      aria-labelledby="enterprise-solutions-heading"
      className="border-t border-[var(--lt-border)] bg-[var(--lt-bg)] px-4 py-12 md:px-8 md:py-16"
    >
      <div className="mx-auto w-full max-w-5xl">
        <Chip className="mb-4 border-[var(--lt-border)] bg-[var(--lt-surface)] text-[var(--lt-text-muted)]">
          Enterprise &amp; Custom Solutions
        </Chip>

        <h2
          id="enterprise-solutions-heading"
          className="mb-4 text-3xl font-black tracking-tight text-[var(--lt-text)] md:text-4xl"
        >
          Need Software Built for Your Business?
        </h2>

        <div className="mb-10 max-w-3xl space-y-4 text-base leading-relaxed text-[var(--lt-text-muted)] md:text-lg">
          <p>Love what LeadThur can do?</p>
          <p>
            We also help businesses launch software products and build custom platforms that automate
            operations, generate leads and improve growth.
          </p>
          <p>
            Whether you want your own branded version of LeadThur or software built specifically for
            your company, our team can help.
          </p>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2 md:gap-6">
          {SERVICES.map((service) => (
            <Panel key={service.title}>
              <PanelContent className="space-y-3 p-6 md:p-8">
                <h3 className="text-xl font-extrabold text-[var(--lt-text)]">{service.title}</h3>
                <p className="leading-relaxed text-[var(--lt-text-muted)]">{service.description}</p>
                <p className="text-sm leading-relaxed text-[var(--lt-text-subtle)]">{service.detail}</p>
              </PanelContent>
            </Panel>
          ))}
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          {WHATSAPP_URL ? (
            <Button
              size="lg"
              className="h-12 min-h-11 px-8 text-base font-extrabold"
              asChild
            >
              <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Chat on WhatsApp
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-[var(--lt-text-subtle)]">
            Let&apos;s discuss the right solution for your business.
          </p>
        </div>
      </div>
    </section>
  );
}
