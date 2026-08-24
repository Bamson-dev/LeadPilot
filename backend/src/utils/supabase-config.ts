export function supabaseProjectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Decode `ref` claim from a Supabase JWT service/anon key (never log the key). */
export function supabaseProjectRefFromKey(key: string | undefined): string | null {
  if (!key || key.startsWith("sb_")) return null;
  try {
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { ref?: string };
    return payload.ref?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export type SupabaseConfigDiagnostics = {
  urlConfigured: boolean;
  keyConfigured: boolean;
  urlRef: string | null;
  keyRef: string | null;
  refsMatch: boolean | null;
};

export function getSupabaseConfigDiagnostics(): SupabaseConfigDiagnostics {
  const urlRef = supabaseProjectRefFromUrl(process.env.SUPABASE_URL);
  const keyRef = supabaseProjectRefFromKey(process.env.SUPABASE_SERVICE_KEY);
  return {
    urlConfigured: Boolean(process.env.SUPABASE_URL),
    keyConfigured: Boolean(process.env.SUPABASE_SERVICE_KEY),
    urlRef,
    keyRef,
    refsMatch: urlRef && keyRef ? urlRef === keyRef : null,
  };
}
