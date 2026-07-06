"use client";

import { useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Lead } from "@/types/lead";
import type { OutreachMailbox } from "@/types/outreach";
import { OutreachSendPanel, OUTREACH_COMPOSE_PANEL_WIDTH } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendsReport } from "@/components/dashboard/outreach-sends-report";
import type { useOutreach } from "@/hooks/useOutreach";

type OutreachData = ReturnType<typeof useOutreach>;

interface ResultsOutreachShellProps {
  children: ReactNode;
  outreach: OutreachData;
  selectedLeads: Lead[];
  sendPanelOpen: boolean;
  onCloseSendPanel: () => void;
  targetBusinessType?: string;
}

export function ResultsOutreachShell({
  children,
  outreach,
  selectedLeads,
  sendPanelOpen,
  onCloseSendPanel,
  targetBusinessType,
}: ResultsOutreachShellProps) {
  const isMobile = useIsMobile();
  const [sendsRefreshKey, setSendsRefreshKey] = useState(0);

  function handleSent() {
    void outreach.refresh();
    setSendsRefreshKey((key) => key + 1);
  }

  const shiftTable = sendPanelOpen && !isMobile;

  return (
    <div className="relative">
      <div
        className="transition-[margin] duration-300 ease-out"
        style={shiftTable ? { marginRight: OUTREACH_COMPOSE_PANEL_WIDTH } : undefined}
      >
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
