"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ResultsTable } from "@/features/results/results-table";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { DiscoveryBulkBar } from "@/components/discovery/discovery-bulk-bar";
import { DiscoveryResultsLayout } from "@/components/discovery/discovery-results-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip } from "@/components/ui/chip";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { cn } from "@/utils/utils";
import { useSavedLeads } from "@/hooks/useSavedLeads";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useOutreach } from "@/hooks/useOutreach";
import { getLeadSelectionId } from "@/lib/lead-selection";
import { exportToCSV } from "@/features/export/csv-export";
import { hasAnyEmail } from "@/utils/get-display-email";
import { OutreachSendPanel } from "@/components/dashboard/outreach-send-panel";
import { requestMailboxesTab } from "@/components/dashboard/outreach-workspace";
import type { Lead } from "@/types/lead";
import type { QueueSendResponse } from "@/types/outreach";

export function SavedLeadsWorkspace() {
  const searchParams = useSearchParams();
  const listFromUrl = searchParams.get("list");
  const isMobile = useIsMobile();
  const {
    leads,
    lists,
    listFilterId,
    setListFilterId,
    activeList,
    loading,
    error,
    reload,
  } = useSavedLeads(listFromUrl);

  const { leadStatuses, setLeadStatus, statusFilter, setStatusFilter } =
    useLeadStatuses(leads);

  const outreach = useOutreach();
  const [tableFilter, setTableFilter] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [sendPanelOpen, setSendPanelOpen] = useState(false);

  const visibleLeads = useMemo(() => {
    let next = leads;
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
  }, [leads, tableFilter, statusFilter, leadStatuses]);

  const activeLead = useMemo(
    () => visibleLeads.find((l) => l.id === activeLeadId) ?? null,
    [visibleLeads, activeLeadId]
  );

  const selectedLeads = useMemo(
    () =>
      visibleLeads.filter((lead) =>
        selectedLeadIds.has(getLeadSelectionId(lead))
      ),
    [visibleLeads, selectedLeadIds]
  );

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const source = selectedLeads.length > 0 ? selectedLeads : visibleLeads;
    if (source.length === 0) {
      toast.error("No businesses to export");
      return;
    }
    exportToCSV(
      source,
      `leadthur-saved-${activeList?.query || "leads"}-${Date.now()}.csv`
    );
    toast.success(`Exported ${source.length} businesses`);
  }, [selectedLeads, visibleLeads, activeList]);

  const openOutreach = useCallback(() => {
    const emailable = selectedLeads.filter((l) => hasAnyEmail(l));
    if (emailable.length === 0) {
      toast.error("Select businesses that have an email");
      return;
    }
    if (!outreach.hasMailbox) {
      toast.message("Connect a mailbox to send outreach");
      requestMailboxesTab();
      return;
    }
    setSendPanelOpen(true);
  }, [selectedLeads, outreach.hasMailbox]);

  const handleSaveLead = useCallback(
    (lead: Lead) => {
      setLeadStatus(lead.id, "interested");
      toast.success("Lead saved");
    },
    [setLeadStatus]
  );

  const handleAddToOutreach = useCallback(
    (lead: Lead) => {
      if (!hasAnyEmail(lead)) {
        toast.error("This business has no email yet");
        return;
      }
      const id = getLeadSelectionId(lead);
      setSelectedLeadIds((prev) => new Set(prev).add(id));
      if (!outreach.hasMailbox) {
        toast.message("Connect a mailbox to send outreach");
        requestMailboxesTab();
        return;
      }
      setSendPanelOpen(true);
    },
    [outreach.hasMailbox]
  );

  const handleSent = useCallback((_result: QueueSendResponse) => {
    void _result;
    setSelectedLeadIds(new Set());
    setSendPanelOpen(false);
    toast.success("Outreach sent");
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
        <DiscoveryWorkspaceHeader
          title={activeList ? activeList.name : "Saved Leads"}
          subtitle={
            loading
              ? "Loading your organized businesses…"
              : `${visibleLeads.length.toLocaleString()} businesses${
                  activeList ? " in this list" : " organized"
                }`
          }
          filterQuery={tableFilter}
          onFilterQueryChange={setTableFilter}
          onExportClick={visibleLeads.length > 0 ? handleExport : undefined}
          exportDisabled={visibleLeads.length === 0}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard">Go to Discovery</Link>
          </Button>
        </div>

        <DiscoveryBulkBar
          className="mt-4"
          selectedCount={selectedLeadIds.size}
          onClear={() => setSelectedLeadIds(new Set())}
          onExport={handleExport}
          onOutreach={openOutreach}
        />
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Could not load saved leads</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside
          className={cn(
            "rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-3",
            isMobile && "order-2"
          )}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <FolderOpen className="h-4 w-4 text-[var(--lt-text-subtle)]" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
              Saved lists
            </p>
          </div>
          <button
            type="button"
            onClick={() => setListFilterId("all")}
            className={cn(
              "mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm",
              listFilterId === "all"
                ? "bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]"
                : "text-[var(--lt-text-muted)] hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
            )}
          >
            <span>All saved</span>
          </button>
          <Separator className="my-2" />
          {lists.length === 0 && !loading ? (
            <p className="px-2 py-3 text-xs text-[var(--lt-text-subtle)]">
              Search history will appear here as lists after you run Discovery
              searches.
            </p>
          ) : (
            <div
              className={cn(
                "space-y-0.5 overflow-y-auto",
                isMobile ? "max-h-40" : "max-h-[420px]"
              )}
            >
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setListFilterId(list.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm",
                    listFilterId === list.id
                      ? "bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]"
                      : "text-[var(--lt-text-muted)] hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
                  )}
                >
                  <span className="truncate">{list.name}</span>
                  <span className="shrink-0 rounded-full bg-[var(--lt-surface-3)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--lt-text-subtle)]">
                    {list.count > 999
                      ? `${(list.count / 1000).toFixed(1)}k`
                      : list.count}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 px-1 text-[11px] text-[var(--lt-text-subtle)]">
            Lists come from your search history. Lead tags are not supported by
            the current backend.
          </p>
        </aside>

        <div className={cn("min-w-0 space-y-4", isMobile && "order-1")}>
          {loading ? (
            <div className="space-y-3 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : visibleLeads.length === 0 ? (
            <EmptyState
              title={
                activeList
                  ? "No saved businesses in this list"
                  : "No saved businesses yet"
              }
              description={
                activeList
                  ? "Open Discovery, save businesses from results, or pick another list."
                  : "Save businesses from Discovery results to organize them here. Status updates sync to your account."
              }
              action={
                <Button type="button" variant="soft" asChild>
                  <Link href="/dashboard">Open Discovery</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip>Status filter in table</Chip>
                <Chip>Export & outreach via bulk bar</Chip>
              </div>
              <DiscoveryResultsLayout
                activeLead={activeLead}
                leadStatus={
                  activeLead ? leadStatuses[activeLead.id] || "new" : undefined
                }
                onCloseDetails={() => setActiveLeadId(null)}
                onSaveLead={handleSaveLead}
                onAddToOutreach={handleAddToOutreach}
                onGenerateOutreach={handleAddToOutreach}
              >
                <ResultsTable
                  leads={visibleLeads}
                  isLoading={false}
                  isMobile={isMobile}
                  leadStatuses={leadStatuses}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onLeadStatusChange={(id, status) => {
                    setLeadStatus(id, status);
                    toast.success("Status updated");
                  }}
                  totalLeadCount={leads.length}
                  selectedLeadIds={selectedLeadIds}
                  onToggleLeadSelect={toggleLeadSelect}
                  onSendSelected={openOutreach}
                  hasMailbox={outreach.hasMailbox}
                  onNoMailboxClick={() => {
                    toast.message("Connect a mailbox to send outreach");
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
            </>
          )}
        </div>
      </div>

      <OutreachSendPanel
        open={sendPanelOpen}
        selectedLeads={selectedLeads.filter((l) => hasAnyEmail(l))}
        mailboxes={outreach.mailboxes}
        sendBalance={outreach.balance?.send_balance ?? 0}
        hasMailbox={outreach.hasMailbox}
        onClose={() => setSendPanelOpen(false)}
        onSent={handleSent}
      />
    </div>
  );
}
