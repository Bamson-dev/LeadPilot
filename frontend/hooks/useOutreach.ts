"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutreachBalance, OutreachMailbox, OutreachSentEmail } from "@/types/outreach";
import {
  fetchMailboxes,
  fetchOutreachBalance,
  fetchRecentSends,
} from "@/services/outreach-api";

export function useOutreach() {
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

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const hasMailbox = activeMailboxes.length > 0;

  return {
    balance,
    mailboxes,
    activeMailboxes,
    hasMailbox,
    sends,
    loading,
    sendsLoading,
    refresh,
    refreshSends,
  };
}
