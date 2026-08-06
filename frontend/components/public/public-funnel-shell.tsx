"use client";

import Link from "next/link";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";

const SITE_HOME = "https://www.leadthur.com";

export interface PublicFunnelShellProps {
  children: React.ReactNode;
  /** Extra bottom padding when a fixed paywall is visible */
  bottomPad?: number;
  ctaHref?: string;
  ctaLabel?: string;
  showFooter?: boolean;
  className?: string;
  mainClassName?: string;
}

export function PublicFunnelShell({
  children,
  bottomPad = 0,
  ctaHref = "/checkout",
  ctaLabel = "Get Full Access",
  showFooter = true,
  className,
  mainClassName,
}: PublicFunnelShellProps) {
  return (
    <div
      className={cn("min-h-screen bg-[var(--lt-bg)] text-[var(--lt-text)]", className)}
      style={bottomPad > 0 ? { paddingBottom: bottomPad } : undefined}
    >
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--lt-border)] bg-[var(--lt-bg)]/95 px-4 py-3 backdrop-blur-md md:px-8">
        <Link
          href={SITE_HOME}
          className="inline-flex min-h-12 items-center text-lg font-bold tracking-tight text-[var(--lt-text)]"
        >
          LeadThur
        </Link>
        <Button variant="soft" size="sm" className="min-h-12" asChild>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12",
          mainClassName
        )}
      >
        {children}
      </main>

      {showFooter ? (
        <footer className="border-t border-[var(--lt-border)] px-4 py-8 text-center text-xs text-[var(--lt-text-subtle)]">
          <Link
            href={SITE_HOME}
            className="inline-flex min-h-12 items-center hover:text-[var(--lt-text-muted)]"
          >
            LeadThur · Business Discovery Intelligence
          </Link>
        </footer>
      ) : null}
    </div>
  );
}

export function PublicFunnelNav({
  active,
}: {
  active?: "blog" | "trial" | "login";
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--lt-border)] bg-[var(--lt-bg)]/95 px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--lt-accent)] text-xs font-extrabold text-white">
          LT
        </span>
        <span className="text-lg font-extrabold text-[var(--lt-text)]">
          Lead<span className="text-[var(--lt-accent-soft)]">Thur</span>
        </span>
      </Link>
      <nav className="flex items-center gap-3 sm:gap-5">
        <Link
          href="/blog"
          className={cn(
            "text-sm font-medium no-underline",
            active === "blog"
              ? "text-[var(--lt-accent-soft)]"
              : "text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]"
          )}
        >
          Blog
        </Link>
        <Link
          href="/freetrial"
          className={cn(
            "hidden text-sm no-underline sm:inline",
            active === "trial"
              ? "font-semibold text-[var(--lt-accent-soft)]"
              : "text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]"
          )}
        >
          Try Free
        </Link>
        <Button size="sm" className="min-h-10" asChild>
          <Link href="/activate">{active === "login" ? "Login" : "Log in"}</Link>
        </Button>
      </nav>
    </header>
  );
}
