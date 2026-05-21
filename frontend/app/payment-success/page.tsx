export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#09090B] px-6 text-center">
      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7C3AED]/20">
        <span className="text-2xl font-bold text-[#A855F7]">LP</span>
      </div>

      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
        <svg
          className="h-10 w-10 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-[#F4F4FF] sm:text-4xl">Payment Received</h1>
      <p className="mt-4 max-w-md text-base text-[#A1A1B5]">
        Check your email for your activation link. It will arrive within 60 seconds.
      </p>
      <p className="mt-6 max-w-md text-sm text-[#6B6B80]">
        If you paid by bank transfer, send your proof to WhatsApp{" "}
        <span className="text-[#C4B5FD]">09067285890</span> and you will receive access
        within minutes.
      </p>
    </main>
  );
}
