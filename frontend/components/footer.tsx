export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07070A]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-medium text-[#F4F4FF]">
              Lead<span className="text-violet-400">Thur</span>
            </p>
            <p className="mt-2 text-xs text-[#6B6B80]">Business Discovery Intelligence</p>
            <p className="mt-1 text-xs text-[#555570]">
              Pdigital Marketstore Ltd (RC 8015428) · Lagos, Nigeria
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <a href="/privacy" className="text-[#A78BFA] hover:text-violet-300">
              Privacy Policy
            </a>
            <a href="/terms" className="text-[#A78BFA] hover:text-violet-300">
              Terms of Service
            </a>
            <a href="/about" className="text-[#A78BFA] hover:text-violet-300">
              About
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-[#555570]">
          © {new Date().getFullYear()} LeadThur. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
