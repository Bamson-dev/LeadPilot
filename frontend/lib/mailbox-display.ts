import type { StatusBadgeStatus } from "@/components/ui/status-badge";
import type { OutreachMailbox } from "@/types/outreach";

export type MailboxHealth = "healthy" | "warning" | "paused" | "error";

export function mailboxStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused_bounce":
      return "Paused";
    case "error":
      return "Error";
    default:
      return status.replace(/_/g, " ");
  }
}

export function mailboxStatusBadge(status: string): StatusBadgeStatus {
  switch (status) {
    case "active":
      return "active";
    case "paused_bounce":
      return "paused";
    case "error":
      return "error";
    default:
      return "paused";
  }
}

export function mailboxHealth(mailbox: OutreachMailbox): MailboxHealth {
  if (mailbox.status === "paused_bounce") return "paused";
  if (mailbox.status === "error") return "error";
  if (mailbox.last_error) return "warning";
  const usage = dailyUsagePercent(mailbox);
  if (usage >= 90) return "warning";
  return "healthy";
}

export function mailboxHealthLabel(health: MailboxHealth): string {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Needs attention";
    case "paused":
      return "Sending paused";
    case "error":
      return "Connection error";
  }
}

export function mailboxHealthBadge(health: MailboxHealth): StatusBadgeStatus {
  switch (health) {
    case "healthy":
      return "active";
    case "warning":
      return "processing";
    case "paused":
      return "paused";
    case "error":
      return "error";
  }
}

export function dailyUsagePercent(mailbox: OutreachMailbox): number {
  if (!mailbox.daily_cap) return 0;
  return Math.min(100, Math.round((mailbox.daily_send_count / mailbox.daily_cap) * 100));
}

export function accountTypeLabel(accountType: OutreachMailbox["account_type"]): string {
  return accountType === "workspace" ? "Google Workspace" : "Personal Gmail";
}

export function formatMailboxDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
