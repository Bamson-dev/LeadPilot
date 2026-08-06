import Link from "next/link";

export function PublicPageFooter() {
  return (
    <footer className="border-t border-[var(--lt-border)] bg-[var(--lt-bg)] px-4 py-8 text-center text-xs text-[var(--lt-text-subtle)]">
      <p className="mb-2">
        <strong className="text-[var(--lt-text)]">LeadThur</strong> — Business Discovery Intelligence
      </p>
      <p>Built by Pdigital Marketstore Ltd (RC 8015428) · Lagos, Nigeria</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
        <Link href="/privacy" className="text-[var(--lt-accent-soft)] no-underline hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-[var(--lt-accent-soft)] no-underline hover:underline">
          Terms of Service
        </Link>
        <Link href="/about" className="text-[var(--lt-accent-soft)] no-underline hover:underline">
          About
        </Link>
        <Link href="/blog" className="text-[var(--lt-accent-soft)] no-underline hover:underline">
          Blog
        </Link>
      </div>
    </footer>
  );
}
