import { Suspense } from "react";
import { AccountsWorkspace } from "@/components/admin/workspaces/accounts-workspace";
import { AdminLoading } from "@/components/admin/admin-ui";

export default function AdminAccountsPage() {
  return (
    <Suspense fallback={<AdminLoading label="Loading accounts..." />}>
      <AccountsWorkspace />
    </Suspense>
  );
}
