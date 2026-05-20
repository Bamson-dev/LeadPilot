import type { SearchRequest } from "../types/search";

export function validateSearchRequest(body: unknown): SearchRequest | null {
  if (!body || typeof body !== "object") return null;
  const { query, location } = body as Record<string, unknown>;
  if (typeof query !== "string" || typeof location !== "string") return null;
  const trimmedQuery = query.trim();
  const trimmedLocation = location.trim();
  if (trimmedQuery.length < 2 || trimmedLocation.length < 2) return null;
  if (trimmedQuery.length > 100 || trimmedLocation.length > 100) return null;
  return { query: trimmedQuery, location: trimmedLocation };
}
