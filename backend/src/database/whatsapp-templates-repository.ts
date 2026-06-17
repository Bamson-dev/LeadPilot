import { supabase } from "./client";

export type WhatsappTemplateRow = {
  id: string;
  niche: string;
  title: string;
  message: string;
  created_at: string;
};

export async function getAllWhatsappTemplates(): Promise<
  Record<string, WhatsappTemplateRow[]>
> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .order("niche", { ascending: true });

  if (error) throw error;

  const grouped: Record<string, WhatsappTemplateRow[]> = {};
  for (const row of (data ?? []) as WhatsappTemplateRow[]) {
    if (!grouped[row.niche]) grouped[row.niche] = [];
    grouped[row.niche].push(row);
  }
  return grouped;
}
