import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";

interface AdminLoginFormProps {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  titleClassName?: string;
}

export function AdminLoginForm({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  titleClassName,
}: AdminLoginFormProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--lt-bg)] px-4">
      <Panel className="w-full max-w-md">
        <PanelContent className="p-8">
          <form onSubmit={onSubmit}>
            <h1
              className={
                titleClassName ??
                "text-2xl font-bold tracking-tight text-[var(--lt-text)]"
              }
            >
              LeadThur Admin
            </h1>
            <p className="mt-2 text-sm text-[var(--lt-text-muted)]">
              Sign in to manage licenses, trials, blog, and payouts. Separate JWT
              auth — not the product license key.
            </p>

            <label className="mt-6 block text-xs font-medium text-[var(--lt-text-muted)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-4 py-2.5 text-[var(--lt-text)] outline-none focus:border-[var(--lt-cyan)]"
              required
            />

            <label className="mt-4 block text-xs font-medium text-[var(--lt-text-muted)]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-4 py-2.5 text-[var(--lt-text)] outline-none focus:border-[var(--lt-cyan)]"
              required
            />

            {error ? (
              <p className="mt-4 text-sm text-[var(--lt-danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="mt-6 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </PanelContent>
      </Panel>
    </main>
  );
}
