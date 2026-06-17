/**
 * Resolve DeepSeek API key from runtime environment.
 * Supports common Coolify copy/paste mistakes (quotes, alternate names).
 */
export function getDeepseekApiKey(): string | null {
  const candidates = [
    process.env.DEEPSEEK_API_KEY,
    process.env.DEEPSEEK_KEY,
    process.env.DEEPSEEK_API_TOKEN,
  ];

  for (const value of candidates) {
    const normalized = normalizeEnvSecret(value);
    if (normalized) return normalized;
  }

  return null;
}

export function isDeepseekConfigured(): boolean {
  return Boolean(getDeepseekApiKey());
}

function normalizeEnvSecret(value: string | undefined): string | null {
  if (!value) return null;

  let trimmed = value.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed || null;
}

export function getDeepseekKeyFingerprint(): string | null {
  const key = getDeepseekApiKey();
  if (!key) return null;
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
