"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead } from "@/types/lead";
import type { OutreachBalance, OutreachMailbox, OutreachSentEmail } from "@/types/outreach";
import {
  fetchMailboxes,
  fetchOutreachBalance,
  fetchRecentSends,
} from "@/services/outreach-api";
import { OutreachBalanceBanner } from "@/components/dashboard/outreach-balance-banner";
import { OutreachMailboxSection } from "@/components/dashboard/outreach-mailbox-section";
import { OutreachSendPanel } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendStatus } from "@/components/dashboard/outreach-send-status";

interface OutreachSectionProps {
  selectedLeads: Lead[];
  sendPanelOpen: boolean;
  onCloseSendPanel: () => void;
  onRequestSendPanel: () => void;
}

export function OutreachSection({
  selectedLeads,
  sendPanelOpen,
  onCloseSendPanel,
}: OutreachSectionProps) {
  const [balance, setBalance] = useState<OutreachBalance | null>(null);
  const [mailboxes, setMailboxes] = useState<OutreachMailbox[]>([]);
  const [sends, setSends] = useState<OutreachSentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendsLoading, setSendsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [bal, boxes] = await Promise.all([
        fetchOutreachBalance(),
        fetchMailboxes().catch(() => [] as OutreachMailbox[]),
      ]);
      setBalance(bal);
      setMailboxes(boxes);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSends = useCallback(async () => {
    setSendsLoading(true);
    try {
      const rows = await fetchRecentSends(30);
      setSends(rows);
    } catch {
      setSends([]);
    } finally {
      setSendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshSends();
  }, [refresh, refreshSends]);

  useEffect(() => {
    if (!sendPanelOpen) return;
    const timer = window.setInterval(() => {
      void refreshSends();
      void fetchOutreachBalance().then((b) => b && setBalance(b));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [sendPanelOpen, refreshSends]);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const hasMailbox = activeMailboxes.length > 0;

  function handleSent() {
    void refresh();
    void refreshSends();
  }

  return (
    <section className="space-y-4 sm:space-y-6" aria-label="Email outreach">
      <div>
        <h2 className="text-lg font-bold text-[#F4F4FF]">Email outreach</h2>
        <p className="mt-1 text-sm text-[#6B6B80]">
          Connect Gmail, check your send balance, and email leads from your search results.
        </p>
      </div>
      <OutreachBalanceBanner
        balance={balance}
        hasMailbox={hasMailbox}
        loading={loading}
      />
      <OutreachMailboxSection
        mailboxes={mailboxes}
        maxMailboxes={balance?.max_mailboxes ?? 1}
        onChanged={() => {
          void refresh();
        }}
      />
      <OutreachSendStatus sends={sends} loading={sendsLoading} />
      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads}
        mailboxes={mailboxes}
        sendBalance={balance?.send_balance ?? 0}
        hasMailbox={hasMailbox}
        onClose={onCloseSendPanel}
        onSent={handleSent}
      />
    </section>
  );
}
