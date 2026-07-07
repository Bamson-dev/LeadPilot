"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectMailbox } from "@/services/outreach-api";
import { isValidAppPassword, normalizeAppPassword } from "@/lib/outreach-utils";

const TWO_STEP_URL = "https://myaccount.google.com/signinoptions/twosv";
const APP_PASSWORDS_URL = "https://myaccount.google.com/apppasswords";

type ConnectStep = 1 | 2 | 3;

type ConnectErrorKind =
  | "login_rejected"
  | "short_password"
  | "app_passwords_blocked"
  | "generic";

function classifyConnectError(err: unknown): { kind: ConnectErrorKind; message: string } {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  const message = err instanceof Error ? err.message : "Failed to connect mailbox";

  if (code === "INVALID_APP_PASSWORD_LENGTH") {
    return {
      kind: "short_password",
      message:
        "Copy the full 16-character app password from Google’s App Passwords page — not your normal Gmail password.",
    };
  }
  if (code === "APP_PASSWORDS_DISABLED") {
    return {
      kind: "app_passwords_blocked",
      message:
        "This account may be a work or school Google account where an admin turned off app passwords. A personal @gmail.com address usually works instead.",
    };
  }
  if (code === "SMTP_VERIFY_FAILED") {
    return {
      kind: "login_rejected",
      message:
        "Gmail rejected the login. Turn on 2-Step Verification, create a fresh app password, and paste all 16 characters.",
    };
  }

  return { kind: "generic", message };
}

interface OutreachGuidedMailboxConnectProps {
  onConnected: () => void;
  onCancel: () => void;
}

export function OutreachGuidedMailboxConnect({
  onConnected,
  onCancel,
}: OutreachGuidedMailboxConnectProps) {
  const [step, setStep] = useState<ConnectStep>(1);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "workspace">("personal");
  const [connecting, setConnecting] = useState(false);
  const [errorKind, setErrorKind] = useState<ConnectErrorKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clearErrors() {
    setErrorKind(null);
    setErrorMessage(null);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    const normalized = normalizeAppPassword(appPassword);
    if (!isValidAppPassword(normalized)) {
      setErrorKind("short_password");
      setErrorMessage(
        "Copy the full 16-character app password from Google’s App Passwords page — not your normal Gmail password."
      );
      return;
    }

    setConnecting(true);
    try {
      await connectMailbox({
        email_address: email.trim(),
        app_password: normalized,
        account_type: accountType,
      });
      onConnected();
    } catch (err) {
      const classified = classifyConnectError(err);
      setErrorKind(classified.kind);
      setErrorMessage(classified.message);
      if (classified.kind === "login_rejected") {
        setStep(1);
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0F0F14] p-4 sm:p-5 space-y-4">
      <p className="text-sm text-[#A1A1B5] leading-relaxed">
        LeadThur needs a Gmail app password so outreach sends from your own address — replies land in
        your inbox. You can remove access anytime in your Google Account security settings.
      </p>

      <div className="flex flex-wrap gap-2 text-xs font-medium">
        {([1, 2, 3] as const).map((n) => (
          <span
            key={n}
            className={[
              "rounded-full px-3 py-1",
              step === n
                ? "bg-[#A855F7]/20 text-[#E9D5FF]"
                : step > n
                  ? "bg-[#10B981]/15 text-[#6EE7B7]"
                  : "bg-[#16161E] text-[#6B6B80]",
            ].join(" ")}
          >
            Step {n}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#F4F4FF]">Turn on 2-Step Verification</h3>
            <p className="mt-2 text-sm text-[#8888A8] leading-relaxed">
              Google only issues app passwords after 2-Step Verification is on. This takes about a
              minute in your Google Account.
            </p>
          </div>
          <a
            href={TWO_STEP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/10 px-4 py-2.5 text-sm font-medium text-[#E9D5FF] hover:bg-[#A855F7]/20"
          >
            Open Google 2-Step Verification
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </a>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="glow" onClick={() => setStep(2)}>
              I&apos;ve turned on 2-Step Verification
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#F4F4FF]">Create an app password</h3>
            <p className="mt-2 text-sm text-[#8888A8] leading-relaxed">
              On the App Passwords page, type any name like <strong className="text-[#C0C0D8]">LeadThur</strong>, click{" "}
              <strong className="text-[#C0C0D8]">Create</strong>, then copy the 16-character password
              Google shows once.
            </p>
          </div>
          <a
            href={APP_PASSWORDS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/10 px-4 py-2.5 text-sm font-medium text-[#E9D5FF] hover:bg-[#A855F7]/20"
          >
            Open Google App Passwords
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </a>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" variant="glow" onClick={() => setStep(3)}>
              I have my app password
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={(e) => void handleConnect(e)} className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#F4F4FF]">Paste and connect</h3>
            <p className="mt-2 text-sm text-[#8888A8]">
              Spaces are removed automatically. Use the 16-character app password, not your normal
              Gmail password.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Gmail address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              required
              disabled={connecting}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">App password</label>
            <Input
              type="password"
              value={appPassword}
              onChange={(e) => {
                setAppPassword(e.target.value);
                clearErrors();
              }}
              placeholder="16-character app password"
              required
              disabled={connecting}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Account type</label>
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value === "workspace" ? "workspace" : "personal")
              }
              disabled={connecting}
              className="w-full rounded-md border border-white/10 bg-[#16161E] px-3 py-2 text-sm text-[#F4F4FF]"
            >
              <option value="personal">Personal Gmail</option>
              <option value="workspace">Google Workspace</option>
            </select>
          </div>

          {errorMessage && (
            <div
              className="rounded-lg border px-3 py-3 text-sm leading-relaxed"
              style={{
                borderColor:
                  errorKind === "app_passwords_blocked"
                    ? "rgba(251, 191, 36, 0.35)"
                    : "rgba(248, 113, 113, 0.35)",
                background:
                  errorKind === "app_passwords_blocked"
                    ? "rgba(251, 191, 36, 0.08)"
                    : "rgba(248, 113, 113, 0.08)",
                color: errorKind === "app_passwords_blocked" ? "#FDE68A" : "#FCA5A5",
              }}
              role="alert"
            >
              <p>{errorMessage}</p>
              {errorKind === "login_rejected" && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-[#E9D5FF] underline"
                  onClick={() => setStep(1)}
                >
                  Go back to Step 1 — check 2-Step Verification
                </button>
              )}
              {errorKind === "short_password" && (
                <a
                  href={APP_PASSWORDS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#E9D5FF] underline"
                >
                  Open App Passwords page
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
              {errorKind === "app_passwords_blocked" && (
                <p className="mt-2 text-xs text-[#FDE68A]/90">
                  Need help?{" "}
                  <Link href="/dashboard/plans" className="underline">
                    Contact support via billing
                  </Link>{" "}
                  or try a personal Gmail account.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={connecting}>
              Back
            </Button>
            <Button type="submit" variant="glow" disabled={connecting} className="sm:min-w-[10rem]">
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
                </>
              ) : (
                "Connect mailbox"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export const OUTREACH_GMAIL_TWO_STEP_URL = TWO_STEP_URL;
export const OUTREACH_GMAIL_APP_PASSWORDS_URL = APP_PASSWORDS_URL;
