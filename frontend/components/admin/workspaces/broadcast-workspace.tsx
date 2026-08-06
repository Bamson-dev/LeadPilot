"use client";

import { TrialBroadcastPanel } from "@/components/admin/trial-broadcast-panel";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";

export function BroadcastWorkspace() {
  const { handleSessionExpired } = useAdminSession();

  return (
    <>
      <AdminWorkspaceHeader
        title="Broadcast"
        description="Send one-off emails to your free trial list."
      />
      <TrialBroadcastPanel onSessionExpired={handleSessionExpired} />
    </>
  );
}
