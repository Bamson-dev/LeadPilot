import type { WhatsappTemplate } from "@/services/api";

function template(
  niche: string,
  title: string,
  message: string
): WhatsappTemplate {
  return {
    id: `default-${niche}`,
    niche,
    title,
    message,
    created_at: "",
  };
}

/** Used when the API is unreachable or returns empty (e.g. production backend without this route). */
export const DEFAULT_WHATSAPP_TEMPLATES: Record<string, WhatsappTemplate[]> = {
  web_design: [
    template(
      "web_design",
      "No website found",
      "Hi [Business Name], I came across your business while researching [City] and noticed you don't have a website yet. I help businesses like yours get a clean, mobile friendly site that brings in more customers. Would you be open to a quick chat about it?"
    ),
  ],
  social_media: [
    template(
      "social_media",
      "Low Instagram activity",
      "Hi [Business Name], I noticed your Instagram isn't very active. I help businesses like yours stay consistent on social media and bring in more foot traffic. Want me to show you what that could look like for you?"
    ),
  ],
  seo: [
    template(
      "seo",
      "Low Google rating",
      "Hi [Business Name], I came across your business and noticed your Google rating could use some attention. I help businesses improve how they show up online and attract more customers. Open to a quick conversation?"
    ),
  ],
  copywriting: [
    template(
      "copywriting",
      "Weak website copy",
      "Hi [Business Name], I checked out your website and think the messaging could do a lot more to convert visitors into customers. I help businesses with copy that actually gets people to take action. Want to see some examples?"
    ),
  ],
  general: [
    template(
      "general",
      "General introduction",
      "Hi [Business Name], I came across your business while researching [City] and wanted to reach out. I work with businesses like yours and think I could help. Do you have a few minutes to chat?"
    ),
  ],
};

export const WHATSAPP_NICHE_ORDER = [
  "web_design",
  "social_media",
  "seo",
  "copywriting",
  "general",
] as const;

export function normalizeTemplatesByNiche(
  grouped: Record<string, WhatsappTemplate[]>
): Record<string, WhatsappTemplate[]> {
  const normalized: Record<string, WhatsappTemplate[]> = {};
  for (const [niche, items] of Object.entries(grouped)) {
    if (items.length > 0) normalized[niche] = [items[0]];
  }
  return normalized;
}

export function resolveWhatsappTemplates(
  grouped: Record<string, WhatsappTemplate[]>
): Record<string, WhatsappTemplate[]> {
  const normalized = normalizeTemplatesByNiche(grouped);
  return Object.keys(normalized).length > 0 ? normalized : DEFAULT_WHATSAPP_TEMPLATES;
}
