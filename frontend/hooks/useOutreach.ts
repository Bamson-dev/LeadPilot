"use client";

import { useCallback, useEffect, useState } from "react";
import type { OutreachBalance, OutreachMailbox } from "@/types/outreach";
import { fetchMailboxes, fetchOutreachBalance } from "@/services/outreach-api";

export function useOutreach() {
  const [balance, setBalance] = useState<OutreachBalance | null>(null);
  const [mailboxes, setMailboxes] = useState<OutreachMailbox[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const hasMailbox = activeMailboxes.length > 0;

  return {
    balance,
    mailboxes,
    activeMailboxes,
    hasMailbox,
    loading,
    refresh,
  };
}
