import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/[0.08] bg-[#07070A]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[#F4F4FF]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-sm font-bold shadow-[0_0_20px_rgba(124,58,237,0.35)]">
            LP
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Lead<span className="text-violet-400">Pilot</span>
          </span>
        </Link>
        <nav>
          <Link href="/dashboard">
            <Button variant="glow" size="sm" className="cursor-pointer">
              Go to Dashboard
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
