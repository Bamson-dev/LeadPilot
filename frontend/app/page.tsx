import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#07070A] px-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-3xl font-bold text-[#F4F4FF] shadow-[0_0_40px_rgba(124,58,237,0.35)]">
        LP
      </div>
      <p className="mt-8 text-center text-xl text-[#F4F4FF]">Your account is ready.</p>
      <Link href="/dashboard" className="mt-8">
        <Button variant="glow" size="lg" className="cursor-pointer">
          Go to Dashboard
        </Button>
      </Link>
    </main>
  );
}
