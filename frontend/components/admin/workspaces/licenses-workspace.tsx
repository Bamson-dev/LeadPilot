"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { formatAdminDate } from "@/components/admin/admin-utils";
import {
  AdminSection,
  AdminSectionHeader,
  adminSectionBodyClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import { getLicenses, type AdminLicense } from "@/services/admin-api";

export function LicensesWorkspace() {
  const { handleSessionError } = useAdminSession();
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);

  const refresh = useCallback(async () => {
    try {
      const licenseData = await getLicenses();
      setLicenses(licenseData.licenses);
    } catch (err) {
      handleSessionError(err);
    }
  }, [handleSessionError]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <>
      <AdminWorkspaceHeader
        title="Licenses"
        description="Recent license records and activation status."
      />

      <AdminSection className="mb-0">
        <AdminSectionHeader title="Recent Licenses" description="Refreshes every 30 seconds" />
        <div className={adminSectionBodyClass}>
          <div className="overflow-x-auto">
            <table className={`${adminTableClass} min-w-[900px]`}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  <th className="px-3 py-2 pr-4">Email</th>
                  <th className="px-3 py-2 pr-4">License Key</th>
                  <th className="px-3 py-2 pr-4">Status</th>
                  <th className="px-3 py-2 pr-4">Activated Date</th>
                  <th className="px-3 py-2 pr-4">Payment</th>
                  <th className="px-3 py-2 pr-4">Searches</th>
                  <th className="px-3 py-2 pr-4">Exports</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((row) => (
                  <tr key={row.id} className={adminTableRowClass}>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text)]">{row.email}</td>
                    <td className="px-3 py-3 pr-4 font-mono text-xs text-[var(--lt-text-muted)]">
                      {row.key}
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <StatusBadge
                        status={
                          (row.is_suspended
                            ? "error"
                            : row.activated
                              ? "active"
                              : "paused") as StatusBadgeStatus
                        }
                        label={
                          row.is_suspended
                            ? "Suspended"
                            : row.activated
                              ? "Activated"
                              : "Pending"
                        }
                      />
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">
                      {formatAdminDate(row.activated_at)}
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <StatusBadge
                        status="replied"
                        label={row.payment_channel === "paystack" ? "Paystack" : "Bank Transfer"}
                      />
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">
                      {row.search_count ?? row.searches_used} / {row.monthly_search_limit ?? 100}
                    </td>
                    <td className="px-3 py-3 pr-4 text-[var(--lt-text-muted)]">{row.exports_used}</td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                      {formatAdminDate(row.created_at)}
                    </td>
                  </tr>
                ))}
                {licenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--lt-text-subtle)]">
                      No licenses yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminSection>
    </>
  );
}
