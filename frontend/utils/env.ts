/** API base URL from build-time env (NEXT_PUBLIC_*). Never throws — callers validate. */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) return "";
  return url.replace(/\/$/, "");
}

export function getSupabaseConfig(): {
  url: string | undefined;
  anonKey: string | undefined;
} {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  };
}
