import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicFunnelShell } from "@/components/public/public-funnel-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";

export default function PaymentSuccessPage() {
  return (
    <PublicFunnelShell
      showFooter={false}
      mainClassName="flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center py-10 md:py-12"
    >
      <Panel className="w-full border-[var(--lt-success)]/30">
        <PanelContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lt-success)]/10">
            <CheckCircle2 className="h-8 w-8 text-[var(--lt-success)]" aria-hidden />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-[var(--lt-text)] sm:text-4xl">Payment Received</h1>
            <p className="m-0 text-base text-[var(--lt-text-muted)]">
              Check your email for your activation link. It will arrive within 60 seconds.
            </p>
            <p className="m-0 text-sm text-[var(--lt-text-subtle)]">
              If you paid by bank transfer, send your proof to WhatsApp{" "}
              <span className="text-[var(--lt-accent-soft)]">09067285890</span> and you will receive
              access within minutes.
            </p>
          </div>

          <Button size="lg" className="h-12 w-full font-extrabold" asChild>
            <Link href="/activate">Activate My Account →</Link>
          </Button>
        </PanelContent>
      </Panel>
    </PublicFunnelShell>
  );
}
