import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { adminLabelClass } from "@/components/admin/admin-ui";

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
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
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
            </div>

            <div className="space-y-2">
              <label className={adminLabelClass}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className={adminLabelClass}>Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-[var(--lt-danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </PanelContent>
      </Panel>
    </main>
  );
}
