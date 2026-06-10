export const BLOG_CATEGORIES = [
  "Lead Generation",
  "Freelancing",
  "Cold Outreach",
  "Nigeria Business",
  "SMMA",
  "Tools and Software",
] as const;

export function categoryToSlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function slugToCategory(slug: string): string | null {
  return (
    BLOG_CATEGORIES.find((category) => categoryToSlug(category) === slug) ?? null
  );
}

export function tagToSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
