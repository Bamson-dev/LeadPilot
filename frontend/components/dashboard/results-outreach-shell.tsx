"use client";

import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Lead } from "@/types/lead";
import type { OutreachMailbox } from "@/types/outreach";
import { OutreachSendPanel, OUTREACH_COMPOSE_PANEL_WIDTH } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendStatus } from "@/components/dashboard/outreach-send-status";
import type { useOutreach } from "@/hooks/useOutreach";

type OutreachData = ReturnType<typeof useOutreach>;

interface ResultsOutreachShellProps {
  children: ReactNode;
  outreach: OutreachData;
  selectedLeads: Lead[];
  sendPanelOpen: boolean;
  onCloseSendPanel: () => void;
}

export function ResultsOutreachShell({
  children,
  outreach,
  selectedLeads,
  sendPanelOpen,
  onCloseSendPanel,
}: ResultsOutreachShellProps) {
  const isMobile = useIsMobile();

  function handleSent() {
    void outreach.refresh();
    void outreach.refreshSends();
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
          <OutreachSendStatus
            sends={outreach.sends}
            loading={outreach.sendsLoading}
          />
        </div>
      </div>

      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads}
        mailboxes={outreach.mailboxes as OutreachMailbox[]}
        sendBalance={outreach.balance?.send_balance ?? 0}
        hasMailbox={outreach.hasMailbox}
        onClose={onCloseSendPanel}
        onSent={handleSent}
      />
    </div>
  );
}
