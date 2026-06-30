import { parseSearchLocation } from "@/lib/search-location";

export function personalizeWhatsappMessage(
  template: string,
  businessName: string,
  location: string
): string {
  const { city } = parseSearchLocation(location);
  const cityLabel = city || location;

  return template
    .replace(/\[Business Name\]/gi, businessName)
    .replace(/\[City\]/gi, cityLabel);
}

export function phoneDigitsForWhatsapp(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function buildWhatsappUrl(phone: string | null, message: string): string | null {
  const digits = phoneDigitsForWhatsapp(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp chat without a pre-filled message. */
export function buildWhatsappChatUrl(phone: string | null): string | null {
  const digits = phoneDigitsForWhatsapp(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export const WHATSAPP_NICHE_LABELS: Record<string, string> = {
  web_design: "Web Design",
  social_media: "Social Media",
  seo: "SEO",
  copywriting: "Copywriting",
  general: "General",
};
