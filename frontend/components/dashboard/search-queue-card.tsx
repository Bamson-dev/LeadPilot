"use client";

interface SearchQueueCardProps {
  queuePosition: number;
}

export function SearchQueueCard({ queuePosition }: SearchQueueCardProps) {
  if (queuePosition <= 0) return null;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-violet-500/20 bg-[#111118] px-6 py-8 text-center shadow-lg">
      <p className="text-lg font-semibold text-[#F0EEFF]">Your search is queued</p>
      <p className="mt-3 text-3xl font-bold text-violet-300">
        #{queuePosition}
        <span className="ml-2 text-base font-medium text-[#A1A1B5]">in line</span>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[#A1A1B5]">
        This usually takes less than 2 minutes. We are limiting concurrent searches so
        everyone gets reliable results.
      </p>
      <p className="mt-4 text-sm text-[#7878A0]">
        You will also receive an email when your results are ready — feel free to close
        this tab.
      </p>
    </div>
  );
}
