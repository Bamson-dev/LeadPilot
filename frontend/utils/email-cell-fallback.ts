import {
  isPlatformOnlyBusinessWebsite,
  isWhatsAppLinkWebsite,
} from "@leadthur/shared";
import { buildWhatsappChatUrl } from "@/lib/whatsapp";
import type { Lead } from "@/types/lead";
import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";

export type EmailCellFallback =
  | { kind: "none" }
  | { kind: "dash" }
  | {
      kind: "whatsapp";
      label: string;
      href: string;
    }
  | {
      kind: "platform";
      primary: string;
      secondary: string;
    };

export function resolveEmailCellFallback(lead: Lead): EmailCellFallback {
  const verified = getVerifiedEmails(lead);
  const predicted = getPredictedEmails(lead);
  if (verified.length > 0 || predicted.length > 0) {
    return { kind: "none" };
  }

  const website = lead.website?.trim();
  if (!website) {
    return { kind: "dash" };
  }

  if (!isPlatformOnlyBusinessWebsite(website)) {
    return { kind: "dash" };
  }

  if (isWhatsAppLinkWebsite(website) && lead.phone?.trim()) {
    const href = buildWhatsappChatUrl(lead.phone);
    if (href) {
      return {
        kind: "whatsapp",
        label: "No email — message via WhatsApp",
        href,
      };
    }
  }

  return {
    kind: "platform",
    primary: "No email available",
    secondary: "Reach out by phone",
  };
}
