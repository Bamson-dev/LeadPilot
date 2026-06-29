/** Mirrors backend dynamic keyword variation patterns (no hardcoded business types). */
export function getQueryVariations(query: string): string[] {
  const base = query.trim();
  if (!base) return [];

  const lower = base.toLowerCase();
  const stem =
    lower.endsWith("s") && lower.length > 3 ? lower.slice(0, -1) : lower;

  const variants = new Set<string>([base, stem]);
  variants.add(`${stem} shop`);
  variants.add(`${stem} studio`);
  variants.add(`${stem} center`);
  variants.add(`${stem} services`);
  variants.add(`${base} near me`);
  variants.add(`best ${base}`);
  variants.add(`top ${base}`);
  variants.add(`local ${base}`);

  return [...variants].slice(0, 10);
}
