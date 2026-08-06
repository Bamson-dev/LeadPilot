"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import {
  AdminSection,
  adminSectionBodyClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import {
  getPayouts,
  markPayoutProcessing,
  payPayout,
  type PayoutRequest,
} from "@/services/admin-api";

export function PaymentsWorkspace() {
  const { handleSessionError } = useAdminSession();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [payingOut, setPayingOut] = useState<string | null>(null);
  const [payoutMsg, setPayoutMsg] = useState("");

  const loadPayouts = useCallback(async () => {
    try {
      const data = await getPayouts();
      setPayouts(data.payouts || []);
    } catch (err) {
      handleSessionError(err);
    }
  }, [handleSessionError]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const handleMarkProcessing = async (payoutId: string) => {
    setPayoutMsg("");
    try {
      const data = await markPayoutProcessing(payoutId);
      setPayoutMsg(data.message);
      await loadPayouts();
    } catch (err) {
      setPayoutMsg(err instanceof Error ? err.message : "Failed to update payout status.");
    }
  };

  const handlePayout = async (payout: PayoutRequest) => {
    const confirmed = window.confirm(
      `Mark ₦${payout.amount_ngn.toLocaleString()} as paid to ${payout.referrer_email}?\n\nAccount: ${payout.account_name}\nBank: ${payout.bank_name}\nAccount Number: ${payout.account_number}\n\nOnly click confirm AFTER you have completed the manual bank transfer. This will notify the affiliate that their payment has been sent.`
    );
    if (!confirmed) return;

    setPayingOut(payout.id);
    setPayoutMsg("");

    try {
      const data = await payPayout(payout.id);
      setPayoutMsg(data.message);
      await loadPayouts();
    } catch (err) {
      setPayoutMsg(err instanceof Error ? err.message : "Failed to mark payout as paid.");
    } finally {
      setPayingOut(null);
    }
  };

  const pendingCount = payouts.filter((p) => p.status === "pending").length;

  return (
    <>
      <AdminWorkspaceHeader
        title="Payments"
        description="Affiliate payout requests and manual payment status."
        badges={
          <Chip
            className={
              pendingCount > 0
                ? "border-[var(--lt-warning)]/30 bg-[var(--lt-warning-soft)] text-[var(--lt-warning)]"
                : undefined
            }
          >
            {pendingCount} pending
          </Chip>
        }
      />

      <AdminSection className="mb-0">
        {payoutMsg ? (
          <Alert variant="success" className="rounded-none border-x-0 border-t-0 text-sm font-semibold">
            {payoutMsg}
          </Alert>
        ) : null}

        {payouts.length === 0 ? (
          <div className={adminSectionBodyClass}>
            <EmptyState title="No payout requests yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={adminTableClass}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  {["Email", "Amount", "Bank", "Account", "Status", "Date", "Action"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className={adminTableRowClass}>
                    <td className="px-3.5 py-3 font-medium text-[var(--lt-text)]">
                      {payout.referrer_email}
                    </td>
                    <td className="px-3.5 py-3 font-bold text-[var(--lt-success)]">
                      ₦{payout.amount_ngn.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">{payout.bank_name}</td>
                    <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {payout.account_number} — {payout.account_name}
                    </td>
                    <td className="px-3.5 py-3">
                      <StatusBadge
                        status={
                          (payout.status === "paid"
                            ? "active"
                            : payout.status === "failed"
                              ? "error"
                              : payout.status === "processing"
                                ? "enriched"
                                : "processing") as StatusBadgeStatus
                        }
                        label={payout.status}
                        className="capitalize"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-[var(--lt-text-muted)]">
                      {new Date(payout.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {payout.status === "pending" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] text-[var(--lt-cyan)]"
                            onClick={() => void handleMarkProcessing(payout.id)}
                          >
                            Processing
                          </Button>
                        )}
                        {(payout.status === "pending" ||
                          payout.status === "processing" ||
                          payout.status === "failed") && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => void handlePayout(payout)}
                            disabled={payingOut === payout.id}
                          >
                            {payingOut === payout.id ? "Saving..." : "Mark Paid"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </>
  );
}
