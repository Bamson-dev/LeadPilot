import Link from "next/link";

export default function PlansPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-[#F4F4FF]">Outreach plans</h1>
      <p className="mt-3 text-sm text-[#6B6B80] leading-relaxed">
        Subscription plans and credit packs for email outreach will be available here soon.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block text-sm text-[#A855F7] underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
