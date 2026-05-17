export interface SearchSession {
  id: string;
  search_term: string;
  location: string;
  total_results: number;
  created_at: string;
}

// Persist across Next.js dev hot reloads
const globalStore = globalThis as typeof globalThis & {
  __leadpilotSearches?: Map<string, SearchSession>;
};

const searches =
  globalStore.__leadpilotSearches ?? new Map<string, SearchSession>();
globalStore.__leadpilotSearches = searches;

export function createSearch(
  searchTerm: string,
  location: string
): SearchSession {
  const session: SearchSession = {
    id: crypto.randomUUID(),
    search_term: searchTerm,
    location,
    total_results: 0,
    created_at: new Date().toISOString(),
  };
  searches.set(session.id, session);
  return session;
}

export function getSearch(id: string): SearchSession | undefined {
  return searches.get(id);
}

export function resolveSearch(
  id: string,
  searchTerm?: string | null,
  location?: string | null
): SearchSession | null {
  const existing = searches.get(id);
  if (existing) return existing;

  if (searchTerm?.trim() && location?.trim()) {
    const session: SearchSession = {
      id,
      search_term: searchTerm.trim(),
      location: location.trim(),
      total_results: 0,
      created_at: new Date().toISOString(),
    };
    searches.set(id, session);
    return session;
  }

  return null;
}

export function updateSearchTotal(id: string, total: number): void {
  const session = searches.get(id);
  if (session) session.total_results = total;
}
