import Link from "next/link";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/[0.08] bg-[#09090B]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_0_20px_rgba(124,58,237,0.35)]">
            <Navigation className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Lead<span className="text-violet-400">Pilot</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="glow" size="sm">
              Start Finding Leads
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
