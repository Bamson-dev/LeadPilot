"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Inbox,
  Mail,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { DiscoveryBulkBar } from "@/components/discovery/discovery-bulk-bar";
import { DiscoveryResultsLayout } from "@/components/discovery/discovery-results-layout";
import { ResultsTable } from "@/features/results/results-table";
import { OutreachTopBar } from "@/components/dashboard/outreach-top-bar";
import { OutreachMailboxSection } from "@/components/dashboard/outreach-mailbox-section";
import { OutreachSendsReport } from "@/components/dashboard/outreach-sends-report";
import { OutreachSendPanel } from "@/components/dashboard/outreach-send-panel";
import { OutreachSendSuccessBanner } from "@/components/dashboard/outreach-send-success-banner";
import { requestMailboxesTab } from "@/components/dashboard/outreach-workspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toast";
import { cn } from "@/utils/utils";
import { useOutreach } from "@/hooks/useOutreach";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getLeadSelectionId } from "@/lib/lead-selection";
import { hasAnyEmail } from "@/utils/get-display-email";
import { exportToCSV } from "@/features/export/csv-export";
import type { Lead } from "@/types/lead";
import type { QueueSendResponse } from "@/types/outreach";

type OutreachPageTab = "compose" | "sends" | "mailboxes";

function tabFromQuery(value: string | null): OutreachPageTab {
  if (value === "sends" || value === "mailboxes" || value === "compose") {
    return value;
  }
  if (value === "mailbox") return "mailboxes";
  return "compose";
}

export function OutreachPageWorkspace({
  onTabChange,
}: {
  onTabChange?: (tab: OutreachPageTab) => void;
} = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const outreach = useOutreach();
  const { leads, loading: leadsLoading, error: leadsError, reload } =
    useSavedLeads();
  const { leadStatuses, setLeadStatus, statusFilter, setStatusFilter } =
    useLeadStatuses(leads);

  const [tab, setTab] = useState<OutreachPageTab>(() =>
    tabFromQuery(searchParams.get("tab") || searchParams.get("view"))
  );

  const selectTab = useCallback(
    (next: OutreachPageTab) => {
      setTab(next);
      onTabChange?.(next);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      if (next === "compose") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [onTabChange, pathname, router, searchParams]
  );
  const [tableFilter, setTableFilter] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [sendPanelOpen, setSendPanelOpen] = useState(false);
  const [sendsRefreshKey, setSendsRefreshKey] = useState(0);
  const [sendNotice, setSendNotice] = useState<{
    result: QueueSendResponse;
    recipientCount: number;
  } | null>(null);

  useEffect(() => {
    const next = tabFromQuery(searchParams.get("tab") || searchParams.get("view"));
    setTab(next);
    onTabChange?.(next);
  }, [searchParams, onTabChange]);

  useEffect(() => {
    const handler = () => selectTab("mailboxes");
    window.addEventListener("leadthur:switch-mailboxes-tab", handler);
    return () => window.removeEventListener("leadthur:switch-mailboxes-tab", handler);
  }, [selectTab]);

  useEffect(() => {
    if (!sendNotice) return;
    const timer = window.setTimeout(() => setSendNotice(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [sendNotice]);

  const emailableLeads = useMemo(
    () => leads.filter((lead) => hasAnyEmail(lead)),
    [leads]
  );

  const visibleLeads = useMemo(() => {
    let next = emailableLeads;
    if (statusFilter !== "all") {
      next = next.filter(
        (lead) => (leadStatuses[lead.id] || "new") === statusFilter
      );
    }
    const q = tableFilter.trim().toLowerCase();
    if (!q) return next;
    return next.filter((lead) => {
      const haystack = [
        lead.business_name,
        lead.category,
        lead.address,
        lead.phone,
        lead.email,
        ...(lead.verified_emails || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [emailableLeads, tableFilter, statusFilter, leadStatuses]);

  const selectedLeads = useMemo(
    () =>
      visibleLeads.filter((lead) =>
        selectedLeadIds.has(getLeadSelectionId(lead))
      ),
    [visibleLeads, selectedLeadIds]
  );

  const activeLead = useMemo(
    () => visibleLeads.find((l) => l.id === activeLeadId) ?? null,
    [visibleLeads, activeLeadId]
  );

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const openCompose = useCallback(() => {
    if (selectedLeads.length === 0) {
      toast.error("Select at least one business with an email");
      return;
    }
    if (!outreach.hasMailbox) {
      toast.message("Connect a mailbox to send");
      selectTab("mailboxes");
      requestMailboxesTab();
      return;
    }
    setSendPanelOpen(true);
  }, [selectedLeads.length, outreach.hasMailbox, selectTab]);

  const handleExport = useCallback(() => {
    const source = selectedLeads.length > 0 ? selectedLeads : visibleLeads;
    if (source.length === 0) {
      toast.error("No recipients to export");
      return;
    }
    exportToCSV(source, `leadthur-outreach-recipients-${Date.now()}.csv`);
    toast.success(`Exported ${source.length} recipients`);
  }, [selectedLeads, visibleLeads]);

  const handleSent = useCallback(
    (result: QueueSendResponse) => {
      void outreach.refresh();
      setSendsRefreshKey((k) => k + 1);
      if (result.queued > 0) {
        setSendPanelOpen(false);
        setSendNotice({ result, recipientCount: selectedLeads.length });
        setSelectedLeadIds(new Set());
        selectTab("sends");
        toast.success(`${result.queued} email${result.queued === 1 ? "" : "s"} queued`);
      } else {
        toast.message("No emails were queued — check credits and addresses");
      }
    },
    [outreach, selectedLeads.length, selectTab]
  );

  const handleAddToOutreach = useCallback(
    (lead: Lead) => {
      if (!hasAnyEmail(lead)) {
        toast.error("This business has no email");
        return;
      }
      setSelectedLeadIds((prev) => new Set(prev).add(getLeadSelectionId(lead)));
      if (!outreach.hasMailbox) {
        toast.message("Connect a mailbox to send");
        selectTab("mailboxes");
        return;
      }
      setSendPanelOpen(true);
    },
    [outreach.hasMailbox, selectTab]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
        <DiscoveryWorkspaceHeader
          title="Outreach"
          subtitle="Compose, send, and track emails to businesses you’ve saved — using your connected mailboxes."
          filterQuery={tab === "compose" ? tableFilter : ""}
          onFilterQueryChange={
            tab === "compose" ? setTableFilter : undefined
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void outreach.refresh();
              void reload();
              setSendsRefreshKey((k) => k + 1);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/saved">From Saved Leads</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard">From Discovery</Link>
          </Button>
        </div>
      </div>

      <OutreachTopBar
        balance={outreach.balance}
        mailboxes={outreach.mailboxes}
        loading={outreach.loading}
      />

      {sendNotice && (
        <OutreachSendSuccessBanner
          result={sendNotice.result}
          recipientCount={sendNotice.recipientCount}
          onDismiss={() => setSendNotice(null)}
        />
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => selectTab(value as OutreachPageTab)}
        className="space-y-4"
      >
        <TabsList className={cn("w-full justify-start overflow-x-auto", isMobile && "h-auto flex-wrap")}>
          <TabsTrigger value="compose" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="sends" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Send history
          </TabsTrigger>
          <TabsTrigger value="mailboxes" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Mailboxes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Recipients</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3">
              <p className="text-sm text-[var(--lt-text-muted)]">
                Recipients come from businesses you’ve saved (with email). Select
                rows, then compose — templates, follow-up schedule, mailbox, and
                send live in the compose panel.
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <Mail className="h-3 w-3" />
                  {emailableLeads.length} with email
                </Chip>
                <Chip>
                  {outreach.hasMailbox
                    ? `${outreach.activeMailboxes.length} mailbox${
                        outreach.activeMailboxes.length === 1 ? "" : "es"
                      }`
                    : "No mailbox"}
                </Chip>
              </div>

              <DiscoveryBulkBar
                selectedCount={selectedLeadIds.size}
                onClear={() => setSelectedLeadIds(new Set())}
                onExport={handleExport}
                onOutreach={openCompose}
              />

              {leadsError && (
                <Alert variant="danger">
                  <AlertTitle>Could not load recipients</AlertTitle>
                  <AlertDescription>{leadsError}</AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void reload()}
                  >
                    Try again
                  </Button>
                </Alert>
              )}

              {!leadsLoading && emailableLeads.length === 0 ? (
                <EmptyState
                  title="No recipients yet"
                  description="Save businesses with emails from Discovery, then return here to compose and send."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" variant="soft" asChild>
                        <Link href="/dashboard">Open Discovery</Link>
                      </Button>
                      <Button type="button" variant="outline" asChild>
                        <Link href="/dashboard/saved">Open Saved Leads</Link>
                      </Button>
                    </div>
                  }
                />
              ) : (
                <DiscoveryResultsLayout
                  activeLead={activeLead}
                  leadStatus={
                    activeLead ? leadStatuses[activeLead.id] || "new" : undefined
                  }
                  onCloseDetails={() => setActiveLeadId(null)}
                  onSaveLead={(lead) => {
                    setLeadStatus(lead.id, "interested");
                    toast.success("Lead saved");
                  }}
                  onAddToOutreach={handleAddToOutreach}
                  onGenerateOutreach={handleAddToOutreach}
                >
                  <ResultsTable
                    leads={visibleLeads}
                    isLoading={leadsLoading}
                    isMobile={isMobile}
                    leadStatuses={leadStatuses}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    onLeadStatusChange={(id, status) => {
                      setLeadStatus(id, status);
                      toast.success("Status updated");
                    }}
                    totalLeadCount={emailableLeads.length}
                    selectedLeadIds={selectedLeadIds}
                    onToggleLeadSelect={toggleLeadSelect}
                    onSendSelected={openCompose}
                    hasMailbox={outreach.hasMailbox}
                    onNoMailboxClick={() => {
                      selectTab("mailboxes");
                      requestMailboxesTab();
                    }}
                    activeLeadId={activeLeadId}
                    onLeadClick={(lead) =>
                      setActiveLeadId((prev) =>
                        prev === lead.id ? null : lead.id
                      )
                    }
                  />
                </DiscoveryResultsLayout>
              )}
            </PanelContent>
          </Panel>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={openCompose}
              disabled={selectedLeads.length === 0}
            >
              <Send className="h-4 w-4" />
              Open compose
            </Button>
            <p className="self-center text-xs text-[var(--lt-text-subtle)]">
              Compose includes mailbox selector, templates, AI draft, preview,
              follow-up schedule (gap days), and send.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="sends" className="space-y-4">
          <p className="text-sm text-[var(--lt-text-muted)]">
            Send history and open tracking for queued outreach. There is no
            separate campaign entity — each batch send and its follow-ups appear
            here.
          </p>
          <OutreachSendsReport
            refreshKey={sendsRefreshKey}
            isActive={tab === "sends"}
          />
        </TabsContent>

        <TabsContent value="mailboxes" className="space-y-4">
          <OutreachMailboxSection
            mailboxes={outreach.mailboxes}
            maxMailboxes={outreach.balance?.max_mailboxes ?? 1}
            onChanged={() => void outreach.refresh()}
          />
        </TabsContent>
      </Tabs>

      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads}
        mailboxes={outreach.mailboxes}
        sendBalance={outreach.balance?.send_balance ?? 0}
        hasMailbox={outreach.hasMailbox}
        onClose={() => setSendPanelOpen(false)}
        onSent={handleSent}
      />
    </div>
  );
}
