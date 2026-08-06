import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";
import { cn } from "@/utils/utils";

export function PublicSuccessCard({
  title,
  description,
  descriptionClassName,
  detail,
  reference,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  descriptionClassName?: string;
  detail?: React.ReactNode;
  reference?: string | null;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <PublicFunnelShell
      showFooter={false}
      mainClassName="flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center py-10 md:py-12"
    >
      <Panel className="w-full border-[var(--lt-success)]/30 shadow-[0_0_80px_rgba(16,185,129,0.08)]">
        <PanelContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lt-success)]/10">
            <CheckCircle2 className="h-8 w-8 text-[var(--lt-success)]" aria-hidden />
          </div>

          <div className="space-y-3">
            <h1 className="m-0 text-2xl font-black tracking-tight text-[var(--lt-text)]">{title}</h1>
            <p className={cn("m-0 text-sm leading-relaxed text-[var(--lt-text-muted)]", descriptionClassName)}>
              {description}
            </p>
            {detail ? <div className="text-xs leading-relaxed text-[var(--lt-text-subtle)]">{detail}</div> : null}
          </div>

          {reference ? (
            <p className="m-0 text-sm text-[var(--lt-text-subtle)]">Reference: {reference}</p>
          ) : null}

          <div className="space-y-3">
            <Button size="lg" className="h-12 w-full font-extrabold" asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            <Link
              href={secondaryHref}
              className="inline-flex min-h-12 items-center justify-center text-sm text-[var(--lt-text-muted)] no-underline hover:text-[var(--lt-text)]"
            >
              {secondaryLabel}
            </Link>
          </div>
        </PanelContent>
      </Panel>
    </PublicFunnelShell>
  );
}
