"use client";

import { OutreachBalanceBanner } from "@/components/dashboard/outreach-balance-banner";
import { OutreachMailboxSection } from "@/components/dashboard/outreach-mailbox-section";
import type { useOutreach } from "@/hooks/useOutreach";

export const GMAIL_MAILBOXES_SECTION_ID = "gmail-mailboxes";

type OutreachData = ReturnType<typeof useOutreach>;

interface OutreachSectionProps {
  outreach: OutreachData;
}

export function OutreachSection({ outreach }: OutreachSectionProps) {
  const { balance, mailboxes, hasMailbox, loading } = outreach;

  return (
    <section className="space-y-4 sm:space-y-6" aria-label="Email outreach">
      <div>
        <h2 className="text-lg font-bold text-[#F4F4FF]">Email outreach</h2>
        <p className="mt-1 text-sm text-[#6B6B80]">
          Connect Gmail, check your send balance, and email leads from your search results.
        </p>
      </div>
      <OutreachBalanceBanner
        balance={balance}
        hasMailbox={hasMailbox}
        loading={loading}
      />
      <div id={GMAIL_MAILBOXES_SECTION_ID}>
        <OutreachMailboxSection
          mailboxes={mailboxes}
          maxMailboxes={balance?.max_mailboxes ?? 1}
          onChanged={() => {
            void outreach.refresh();
          }}
        />
      </div>
    </section>
  );
}
