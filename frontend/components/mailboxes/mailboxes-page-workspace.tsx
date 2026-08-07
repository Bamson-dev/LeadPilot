"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { OutreachGuidedMailboxConnect } from "@/components/dashboard/outreach-guided-mailbox-connect";
import { MailboxDetailsPanel } from "@/components/mailboxes/mailbox-details-panel";
import { MailboxListTable } from "@/components/mailboxes/mailbox-list-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/utils/utils";
import { useOutreach } from "@/hooks/useOutreach";
import { useIsMobile } from "@/hooks/useIsMobile";
import { disconnectMailbox } from "@/services/outreach-api";
import type { OutreachMailbox } from "@/types/outreach";

export function MailboxesPageWorkspace() {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const outreach = useOutreach();

  const [filterQuery, setFilterQuery] = useState("");
  const [activeMailboxId, setActiveMailboxId] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [reconnectTarget, setReconnectTarget] = useState<OutreachMailbox | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mailboxes = outreach.mailboxes;
  const maxMailboxes = outreach.balance?.max_mailboxes ?? 1;
  const activeCount = outreach.activeMailboxes.length;

  const filteredMailboxes = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return mailboxes;
    return mailboxes.filter((m) =>
      [m.email_address, m.account_type, m.status, m.last_error]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [mailboxes, filterQuery]);

  const activeMailbox = useMemo(
    () => mailboxes.find((m) => m.id === activeMailboxId) ?? null,
    [mailboxes, activeMailboxId]
  );

  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "1" || connect === "true") {
      setConnectOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (mailboxes.length === 0) {
      setActiveMailboxId(null);
      return;
    }
    if (activeMailboxId && mailboxes.some((m) => m.id === activeMailboxId)) {
      return;
    }
    if (!isMobile) {
      setActiveMailboxId(mailboxes[0]?.id ?? null);
    }
  }, [mailboxes, activeMailboxId, isMobile]);

  const handleRefresh = useCallback(async () => {
    setLoadError(null);
    try {
      await outreach.refresh();
    } catch {
      setLoadError("Could not refresh mailboxes. Try again.");
    }
  }, [outreach]);

  const handleConnected = useCallback(async () => {
    setConnectOpen(false);
    setReconnectTarget(null);
    await outreach.refresh();
    toast.success("Mailbox connected and verified");
  }, [outreach]);

  const handleDisconnect = useCallback(
    async (mailbox: OutreachMailbox) => {
      setDisconnectingId(mailbox.id);
      try {
        await disconnectMailbox(mailbox.id);
        if (activeMailboxId === mailbox.id) {
          setActiveMailboxId(null);
        }
        await outreach.refresh();
        toast.success("Mailbox disconnected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to disconnect");
      } finally {
        setDisconnectingId(null);
      }
    },
    [activeMailboxId, outreach]
  );

  const handleReconnect = useCallback((mailbox: OutreachMailbox) => {
    setReconnectTarget(mailbox);
    setConnectOpen(true);
  }, []);

  const openConnect = useCallback(() => {
    if (activeCount >= maxMailboxes) {
      toast.message(`Mailbox limit reached (${maxMailboxes}). Disconnect one to add another.`);
      return;
    }
    setReconnectTarget(null);
    setConnectOpen(true);
  }, [activeCount, maxMailboxes]);

  const showConnectForm = connectOpen;
  const connectPrefillEmail = reconnectTarget?.email_address;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
        <DiscoveryWorkspaceHeader
          title="Mailboxes"
          subtitle="Manage Gmail sending accounts — connection status, daily limits, and errors."
          filterQuery={filterQuery}
          onFilterQueryChange={setFilterQuery}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleRefresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={openConnect}
            disabled={activeCount >= maxMailboxes && !connectOpen}
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Gmail
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/outreach">Open Outreach</Link>
          </Button>
        </div>
      </div>

      <Panel>
        <PanelHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
          <PanelTitle>Account overview</PanelTitle>
          <div className="flex flex-wrap gap-2">
            <Chip>
              <Inbox className="h-3 w-3" />
              {activeCount}/{maxMailboxes} active
            </Chip>
            {outreach.balance ? (
              <Chip>
                {outreach.balance.send_balance.toLocaleString()} sends left
              </Chip>
            ) : null}
          </div>
        </PanelHeader>
        <PanelContent>
          {outreach.loading && !outreach.balance ? (
            <Skeleton className="h-4 w-56" />
          ) : (
            <p className="text-sm text-[var(--lt-text-muted)]">
              Gmail only. Credentials are verified over SMTP when you connect. Need more mailbox
              slots or sends?{" "}
              <Link href="/dashboard/plans" className="text-[var(--lt-accent-soft)] underline">
                Open outreach billing
              </Link>
              .
            </p>
          )}
        </PanelContent>
      </Panel>

      {loadError ? (
        <Alert variant="danger">
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void handleRefresh()}
          >
            Try again
          </Button>
        </Alert>
      ) : null}

      {showConnectForm ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>
              {reconnectTarget ? "Verify & reconnect" : "Connect Gmail"}
            </PanelTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConnectOpen(false);
                setReconnectTarget(null);
              }}
            >
              Cancel
            </Button>
          </PanelHeader>
          <PanelContent>
            {reconnectTarget ? (
              <p className="mb-4 text-sm text-[var(--lt-text-muted)]">
                Reconnecting <strong className="text-[var(--lt-text)]">{reconnectTarget.email_address}</strong>.
                Gmail credentials are verified when you submit — this replaces the stored app password.
              </p>
            ) : null}
            <OutreachGuidedMailboxConnect
              initialEmail={connectPrefillEmail}
              initialAccountType={reconnectTarget?.account_type}
              submitLabel={reconnectTarget ? "Verify & connect" : "Connect mailbox"}
              onConnected={() => void handleConnected()}
              onCancel={() => {
                setConnectOpen(false);
                setReconnectTarget(null);
              }}
            />
          </PanelContent>
        </Panel>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          !isMobile && activeMailbox ? "lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]" : ""
        )}
      >
        <div className="min-w-0 space-y-3">
          <MailboxListTable
            mailboxes={filteredMailboxes}
            loading={outreach.loading}
            activeMailboxId={activeMailboxId}
            onSelect={(mailbox) => setActiveMailboxId(mailbox.id)}
            onConnect={openConnect}
            isMobile={isMobile}
          />
          {filterQuery && mailboxes.length > 0 && filteredMailboxes.length === 0 ? (
            <p className="text-sm text-[var(--lt-text-muted)]">No mailboxes match your search.</p>
          ) : null}
        </div>

        {!isMobile && activeMailbox ? (
          <MailboxDetailsPanel
            mailbox={activeMailbox}
            disconnecting={disconnectingId === activeMailbox.id}
            onDisconnect={() => void handleDisconnect(activeMailbox)}
            onReconnect={() => handleReconnect(activeMailbox)}
            className="sticky top-4 self-start"
          />
        ) : null}
      </div>

      {isMobile && activeMailbox ? (
        <Dialog
          open={Boolean(activeMailbox)}
          onOpenChange={(open) => {
            if (!open) setActiveMailboxId(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
            <DialogHeader className="sr-only">
              <DialogTitle>{activeMailbox.email_address}</DialogTitle>
            </DialogHeader>
            <MailboxDetailsPanel
              mailbox={activeMailbox}
              disconnecting={disconnectingId === activeMailbox.id}
              onClose={() => setActiveMailboxId(null)}
              onDisconnect={() => void handleDisconnect(activeMailbox)}
              onReconnect={() => {
                setActiveMailboxId(null);
                handleReconnect(activeMailbox);
              }}
              className="rounded-none border-0"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
