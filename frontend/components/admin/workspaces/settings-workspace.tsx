"use client";

import Link from "next/link";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";

export function SettingsWorkspace() {
  const { logout } = useAdminSession();

  return (
    <>
      <AdminWorkspaceHeader
        title="Settings"
        description="Admin console configuration and session controls."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelContent className="space-y-3 p-5">
            <h2 className="m-0 text-sm font-bold text-[var(--lt-text)]">Authentication</h2>
            <p className="m-0 text-sm text-[var(--lt-text-muted)]">
              Admin uses a separate JWT session stored locally. Product license keys do not grant
              admin access.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              Log out of admin
            </Button>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelContent className="space-y-3 p-5">
            <h2 className="m-0 text-sm font-bold text-[var(--lt-text)]">Site configuration</h2>
            <p className="m-0 text-sm text-[var(--lt-text-muted)]">
              Global head and body scripts are managed in the Global Scripts workspace.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/scripts">Open Global Scripts</Link>
            </Button>
          </PanelContent>
        </Panel>
      </div>
    </>
  );
}
