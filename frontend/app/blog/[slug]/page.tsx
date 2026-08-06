import type { Metadata } from "next";
import Link from "next/link";
import { BlogArticleView } from "@/components/blog/blog-article-view";
import { PublicFunnelNav } from "@/components/public/public-funnel-shell";
import { PublicPageFooter } from "@/components/public/public-page-footer";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { buildArticleSchema, buildFaqPageSchema } from "@/lib/blog-schema";
import {
  keyTakeawaysFromExcerpt,
  prepareArticleContent,
  type BlogPostListItem,
} from "@/lib/blog-content";

type BlogPost = {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  cover_image?: string;
  author?: string;
  author_title?: string;
  category?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  read_time?: number;
  published_at?: string;
  updated_at?: string;
};

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/public/blog/posts/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getRelatedPosts(category: string | undefined, slug: string): Promise<BlogPostListItem[]> {
  if (!category) return [];

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(
      `${apiUrl}/public/blog/posts?category=${encodeURIComponent(category)}&limit=4`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.posts || []) as BlogPostListItem[])
      .filter((p) => p.slug !== slug)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: "Article Not Found | LeadThur" };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    metadataBase: new URL("https://www.leadthur.com"),
    alternates: {
      canonical: `https://www.leadthur.com/blog/${post.slug}`,
    },
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      url: `https://www.leadthur.com/blog/${post.slug}`,
      siteName: "LeadThur",
      images: post.cover_image
        ? [{ url: post.cover_image, width: 1200, height: 630, alt: post.title }]
        : [{ url: "https://www.leadthur.com/og-image.png", width: 1200, height: 630 }],
      type: "article",
      publishedTime: post.published_at,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      creator: "@BamsonOfficial",
      images: post.cover_image ? [post.cover_image] : ["https://www.leadthur.com/og-image.png"],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: "#6B7280",
          fontSize: 16,
        }}
      >
        Article not found.{" "}
        <Link href="/blog" style={{ color: "#7C3AED", marginLeft: 8 }}>
          Back to blog
        </Link>
      </div>
    );
  }

  const articleUrl = `https://www.leadthur.com/blog/${post.slug}`;
  const { content: processedContent, headings } = prepareArticleContent(post.content);
  const takeaways = keyTakeawaysFromExcerpt(post.excerpt, post.content);
  const relatedPosts = await getRelatedPosts(post.category, post.slug);
  const articleSchema = buildArticleSchema(post);
  const faqSchema = buildFaqPageSchema(post.content);

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
      )}

      <PublicFunnelNav active="blog" />

      <BlogArticleView
        post={post}
        processedContent={processedContent}
        headings={headings}
        takeaways={takeaways}
        relatedPosts={relatedPosts}
        articleUrl={articleUrl}
      />

      <section className="border-y border-[var(--lt-accent)]/20 bg-[var(--lt-accent)]/5 px-4 py-14 text-center md:py-16">
        <Chip className="mb-5 border-[var(--lt-success)]/25 bg-[var(--lt-success)]/10 text-[var(--lt-success)]">
          Try it free
        </Chip>
        <h2 className="mb-3 text-3xl font-black tracking-tight text-[var(--lt-text)] md:text-4xl">
          Ready to stop searching manually?
        </h2>
        <p className="mx-auto mb-7 max-w-md text-base leading-relaxed text-[var(--lt-text-muted)]">
          Find 1,000+ businesses with their phone numbers, emails, and websites in any city in 60
          seconds. No signup needed to try.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="h-12 px-8 font-extrabold" asChild>
            <Link href="/freetrial">Try LeadThur Free →</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8" asChild>
            <Link href="/blog">More Articles</Link>
          </Button>
        </div>
      </section>

      <PublicPageFooter />
    </div>
  );
}
