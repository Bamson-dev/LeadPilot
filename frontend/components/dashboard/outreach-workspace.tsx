"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Lead } from "@/types/lead";
import type { OutreachMailbox, QueueSendResponse } from "@/types/outreach";
import { OutreachTopBar } from "@/components/dashboard/outreach-top-bar";
import { OutreachSearchBox } from "@/components/dashboard/outreach-search-box";
import { OutreachMailboxSection } from "@/components/dashboard/outreach-mailbox-section";
import { OutreachSendsReport } from "@/components/dashboard/outreach-sends-report";
import { OutreachSendPanel, OUTREACH_COMPOSE_PANEL_WIDTH } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendSuccessBanner } from "@/components/dashboard/outreach-send-success-banner";
import type { useOutreach } from "@/hooks/useOutreach";

export const GMAIL_MAILBOXES_SECTION_ID = "gmail-mailboxes";

export type OutreachTabId = "results" | "sends" | "mailboxes";

type OutreachData = ReturnType<typeof useOutreach>;

const TABS: Array<{ id: OutreachTabId; label: string }> = [
  { id: "results", label: "Results" },
  { id: "sends", label: "Sends report" },
  { id: "mailboxes", label: "Mailboxes" },
];

interface OutreachWorkspaceProps {
  outreach: OutreachData;
  businessType: string;
  location: string;
  onBusinessTypeChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSearch: () => void;
  searchDisabled?: boolean;
  resultsContent: ReactNode;
  resultsHeader?: ReactNode;
  resultsFooter?: ReactNode;
  selectedLeads: Lead[];
  sendPanelOpen: boolean;
  onCloseSendPanel: () => void;
  onSendComplete?: (result: QueueSendResponse) => void;
  targetBusinessType?: string;
  initialTab?: OutreachTabId;
  mailboxSectionId?: string;
}

export function OutreachWorkspace({
  outreach,
  businessType,
  location,
  onBusinessTypeChange,
  onLocationChange,
  onSearch,
  searchDisabled = false,
  resultsContent,
  resultsHeader,
  resultsFooter,
  selectedLeads,
  sendPanelOpen,
  onCloseSendPanel,
  onSendComplete,
  targetBusinessType,
  initialTab = "results",
  mailboxSectionId = GMAIL_MAILBOXES_SECTION_ID,
}: OutreachWorkspaceProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<OutreachTabId>(initialTab);
  const [sendsRefreshKey, setSendsRefreshKey] = useState(0);
  const [sendNotice, setSendNotice] = useState<{
    result: QueueSendResponse;
    recipientCount: number;
  } | null>(null);

  const switchToMailboxes = useCallback(() => {
    setActiveTab("mailboxes");
    requestAnimationFrame(() => {
      document.getElementById(mailboxSectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [mailboxSectionId]);

  useEffect(() => {
    const handler = () => switchToMailboxes();
    window.addEventListener("leadthur:switch-mailboxes-tab", handler);
    return () => window.removeEventListener("leadthur:switch-mailboxes-tab", handler);
  }, [switchToMailboxes]);

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

  const shiftContent = sendPanelOpen && !isMobile;

  return (
    <section className="relative space-y-3 sm:space-y-4" aria-label="Email outreach workspace">
      <OutreachTopBar
        balance={outreach.balance}
        mailboxes={outreach.mailboxes}
        loading={outreach.loading}
      />

      <OutreachSearchBox
        businessType={businessType}
        location={location}
        onBusinessTypeChange={onBusinessTypeChange}
        onLocationChange={onLocationChange}
        onSearch={onSearch}
        disabled={searchDisabled}
        isMobile={isMobile}
      />

      <div
        className="flex gap-1 overflow-x-auto border-b border-white/[0.08] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Outreach sections"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                selected
                  ? "border-b-2 border-[#A855F7] bg-[#16161E] text-[#F4F4FF]"
                  : "text-[#6B6B80] hover:text-[#A1A1B5]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="transition-[margin] duration-300 ease-out"
        style={shiftContent ? { marginRight: OUTREACH_COMPOSE_PANEL_WIDTH } : undefined}
      >
        {sendNotice && activeTab === "results" && (
          <OutreachSendSuccessBanner
            result={sendNotice.result}
            recipientCount={sendNotice.recipientCount}
            onDismiss={() => setSendNotice(null)}
          />
        )}

        <div role="tabpanel" hidden={activeTab !== "results"} className={activeTab === "results" ? "space-y-4" : "hidden"}>
          {resultsHeader}
          <div data-outreach-results-table>{resultsContent}</div>
          {resultsFooter}
        </div>

        <div role="tabpanel" hidden={activeTab !== "sends"} className={activeTab === "sends" ? undefined : "hidden"}>
          <OutreachSendsReport refreshKey={sendsRefreshKey} />
        </div>

        <div
          id={mailboxSectionId}
          role="tabpanel"
          hidden={activeTab !== "mailboxes"}
          className={activeTab === "mailboxes" ? undefined : "hidden"}
        >
          <OutreachMailboxSection
            mailboxes={outreach.mailboxes}
            maxMailboxes={outreach.balance?.max_mailboxes ?? 1}
            onChanged={() => {
              void outreach.refresh();
            }}
          />
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
    </section>
  );
}

/** Switch to Mailboxes tab from child components (e.g. ResultsTable no-mailbox guard). */
export function requestMailboxesTab() {
  window.dispatchEvent(new Event("leadthur:switch-mailboxes-tab"));
}
