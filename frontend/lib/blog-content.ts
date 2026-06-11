export type TocHeading = {
  id: string;
  text: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function nextHeadingId(text: string, seen: Map<string, number>): string {
  const base = slugifyHeading(text);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export function extractH2Headings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const seen = new Map<string, number>();
  const regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (!text) continue;
    headings.push({ id: nextHeadingId(text, seen), text });
  }

  return headings;
}

export function injectHeadingIds(html: string): string {
  const seen = new Map<string, number>();

  return html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (full, attrs, inner) => {
    if (/\bid\s*=/.test(attrs)) {
      return full;
    }

    const text = stripHtml(inner);
    if (!text) return full;

    const id = nextHeadingId(text, seen);
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
}

export function prepareArticleContent(html: string): {
  content: string;
  headings: TocHeading[];
} {
  const headings: TocHeading[] = [];
  const seen = new Map<string, number>();

  const content = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (full, attrs, inner) => {
    if (/\bid\s*=/.test(attrs)) {
      const existing = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      const text = stripHtml(inner);
      if (existing && text) {
        headings.push({ id: existing, text });
      }
      return full;
    }

    const text = stripHtml(inner);
    if (!text) return full;

    const id = nextHeadingId(text, seen);
    headings.push({ id, text });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });

  return { content, headings };
}

export function keyTakeawaysFromExcerpt(excerpt?: string, content?: string): string[] {
  const fallback = stripHtml(content || "").split(/\n+/)[0] || "";
  const source = (excerpt?.trim() || fallback).trim();
  if (!source) return [];

  const sentences =
    source.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map((s) => s.trim()) ??
    source.split(/(?<=[.!?])\s+/).filter(Boolean);

  return sentences.slice(0, 4).filter((s) => s.length > 0);
}

export type BlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cover_image?: string;
  author?: string;
  category?: string;
  read_time?: number;
  published_at?: string;
};

export function formatPostDate(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
