/** True when Supabase REST/platform blocked the project (egress quota, billing, etc.). */
export function isSupabaseServiceRestricted(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  const message = error?.message ?? "";
  return /exceed_egress_quota|egress|quota|402|restricted|service unavailable/i.test(
    message
  );
}
