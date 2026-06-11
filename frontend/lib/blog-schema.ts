type BlogPostSchemaInput = {
  title: string;
  slug: string;
  excerpt?: string;
  meta_description?: string;
  author?: string;
  cover_image?: string;
  published_at?: string;
  updated_at?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFaqSection(html: string): string | null {
  const headingMatch = html.match(
    /<h[23][^>]*>\s*Frequently Asked Questions\s*<\/h[23]>/i
  );
  if (!headingMatch || headingMatch.index === undefined) {
    return null;
  }

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);
  const nextSection = afterHeading.search(/<h2[^>]*>/i);
  return nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection);
}

export function parseFaqPairsFromContent(html: string): Array<{ name: string; text: string }> {
  const faqSection = extractFaqSection(html);
  if (!faqSection) return [];

  const pairs: Array<{ name: string; text: string }> = [];
  const seen = new Set<string>();

  const addPair = (question: string, answer: string) => {
    const name = stripHtml(question);
    const text = stripHtml(answer);
    if (!name || !text) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ name, text });
  };

  const headingAnswerPattern =
    /<h[34][^>]*>([\s\S]*?)<\/h[34]>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|<div[^>]*>([\s\S]*?)<\/div>)/gi;
  let match: RegExpExecArray | null;
  while ((match = headingAnswerPattern.exec(faqSection)) !== null) {
    addPair(match[1], match[2] || match[3] || "");
  }

  const strongAnswerPattern =
    /<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = strongAnswerPattern.exec(faqSection)) !== null) {
    addPair(match[1], match[2]);
  }

  const boldAnswerPattern =
    /<p[^>]*>\s*<b[^>]*>([\s\S]*?)<\/b>\s*<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = boldAnswerPattern.exec(faqSection)) !== null) {
    addPair(match[1], match[2]);
  }

  return pairs;
}

export function buildFaqPageSchema(html: string): Record<string, unknown> | null {
  const pairs = parseFaqPairsFromContent(html);
  if (pairs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.name,
      acceptedAnswer: {
        "@type": "Answer",
        text: pair.text,
      },
    })),
  };
}

export function buildArticleSchema(post: BlogPostSchemaInput): Record<string, unknown> {
  const image = post.cover_image || "https://www.leadthur.com/og-image.png";

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description || post.excerpt || post.title,
    author: {
      "@type": "Person",
      name: post.author || "Bamidele Matthew",
    },
    publisher: {
      "@type": "Organization",
      name: "LeadThur",
      url: "https://www.leadthur.com",
    },
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    image,
    url: `https://www.leadthur.com/blog/${post.slug}`,
  };
}
