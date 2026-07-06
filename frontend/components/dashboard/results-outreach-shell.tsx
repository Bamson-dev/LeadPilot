"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Lead } from "@/types/lead";
import type { OutreachMailbox, QueueSendResponse } from "@/types/outreach";
import { OutreachSendPanel, OUTREACH_COMPOSE_PANEL_WIDTH } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendSuccessBanner } from "@/components/dashboard/outreach-send-success-banner";
import { OutreachSendsReport } from "@/components/dashboard/outreach-sends-report";
import type { useOutreach } from "@/hooks/useOutreach";

type OutreachData = ReturnType<typeof useOutreach>;

interface ResultsOutreachShellProps {
  children: ReactNode;
  outreach: OutreachData;
  selectedLeads: Lead[];
  sendPanelOpen: boolean;
  onCloseSendPanel: () => void;
  onSendComplete?: (result: QueueSendResponse) => void;
  targetBusinessType?: string;
}

export function ResultsOutreachShell({
  children,
  outreach,
  selectedLeads,
  sendPanelOpen,
  onCloseSendPanel,
  onSendComplete,
  targetBusinessType,
}: ResultsOutreachShellProps) {
  const isMobile = useIsMobile();
  const [sendsRefreshKey, setSendsRefreshKey] = useState(0);
  const [sendNotice, setSendNotice] = useState<{
    result: QueueSendResponse;
    recipientCount: number;
  } | null>(null);

  useEffect(() => {
    if (!sendNotice) return;
    const timer = window.setTimeout(() => setSendNotice(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [sendNotice]);

  function handleSent(result: QueueSendResponse) {
    void outreach.refresh();
    setSendsRefreshKey((key) => key + 1);

    if (result.queued > 0) {
      onCloseSendPanel();
      setSendNotice({ result, recipientCount: selectedLeads.length });
      onSendComplete?.(result);
    }
  }

  const shiftTable = sendPanelOpen && !isMobile;

  return (
    <div className="relative">
      <div
        className="transition-[margin] duration-300 ease-out"
        style={shiftTable ? { marginRight: OUTREACH_COMPOSE_PANEL_WIDTH } : undefined}
      >
        {sendNotice && (
          <OutreachSendSuccessBanner
            result={sendNotice.result}
            recipientCount={sendNotice.recipientCount}
            onDismiss={() => setSendNotice(null)}
          />
        )}
        {children}
        <div className="mt-4">
          <OutreachSendsReport refreshKey={sendsRefreshKey} />
        </div>
      </div>

      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads}
        mailboxes={outreach.mailboxes as OutreachMailbox[]}
        sendBalance={outreach.balance?.send_balance ?? 0}
        hasMailbox={outreach.hasMailbox}
        targetBusinessType={targetBusinessType}
        onClose={onCloseSendPanel}
        onSent={handleSent}
      />
    </div>
  );
}
