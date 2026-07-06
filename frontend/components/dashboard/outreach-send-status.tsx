"use client";

import Link from "next/link";
import type { OutreachSentEmail } from "@/types/outreach";

interface OutreachSendStatusProps {
  sends: OutreachSentEmail[];
  loading?: boolean;
}

function statusColor(status: string): string {
  switch (status) {
    case "sent":
      return "#10B981";
    case "failed":
      return "#F87171";
    case "queued":
    case "sending":
      return "#FBBF24";
    default:
      return "#6B6B80";
  }
}

export function OutreachSendStatus({ sends, loading = false }: OutreachSendStatusProps) {
  if (loading && sends.length === 0) {
    return (
      <div className="glass rounded-2xl p-4 sm:p-6">
        <p className="text-sm text-[#6B6B80]">Loading recent sends…</p>
      </div>
    );
  }

  if (sends.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <h2 className="text-lg font-bold text-[#F4F4FF]">Recent email sends</h2>
      <p className="mt-1 text-sm text-[#6B6B80]">
        Status updates as the send queue processes each message.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-xs text-[#6B6B80]">
              <th className="pb-2 pr-3 font-medium">Recipient</th>
              <th className="pb-2 pr-3 font-medium">Business</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium">Opened</th>
              <th className="pb-2 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            {sends.map((row) => (
              <tr key={row.id} className="border-b border-white/[0.04]">
                <td className="py-2.5 pr-3 text-[#F4F4FF]">{row.recipient_email}</td>
                <td className="py-2.5 pr-3 text-[#A1A1B5]">{row.business_name || "—"}</td>
                <td className="py-2.5 pr-3">
                  <span style={{ color: statusColor(row.status), fontWeight: 600 }}>
                    {row.status}
                  </span>
                  {row.error_message && (
                    <p className="mt-0.5 text-xs text-red-400 max-w-[200px] truncate">
                      {row.error_message}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-[#A1A1B5]">
                  {row.open_count > 0 ? (
                    <span>
                      Yes ({row.open_count}
                      {row.opened_at ? ` · ${new Date(row.opened_at).toLocaleDateString()}` : ""})
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 text-[#6B6B80]">
                  {row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[#6B6B80]">
        Need more sends?{" "}
        <Link href="/dashboard/plans" className="text-[#A855F7] underline">
          View plans
        </Link>
      </p>
    </div>
  );
}
