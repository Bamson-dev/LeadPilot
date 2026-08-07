import { PublicFunnelNav } from "@/components/public/public-funnel-shell";
import { PublicPageFooter } from "@/components/public/public-page-footer";
import { cn } from "@/utils/utils";

export function PublicContentShell({
  children,
  navActive,
  className,
  mainClassName,
  footer = true,
}: {
  children: React.ReactNode;
  navActive?: "blog" | "trial" | "login";
  className?: string;
  mainClassName?: string;
  footer?: boolean;
}) {
  return (
    <div className={cn("min-h-screen bg-[var(--lt-bg)] text-[var(--lt-text)]", className)}>
      <PublicFunnelNav active={navActive} />
      <main className={cn("mx-auto w-full max-w-3xl px-4 py-12 md:px-8 md:py-16", mainClassName)}>
        {children}
      </main>
      {footer ? <PublicPageFooter /> : null}
    </div>
  );
}
