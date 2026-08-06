import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { categoryToSlug } from "@/lib/blog";
import { BlogPostCard, blogCardStyles } from "@/components/blog/blog-post-card";
import type { BlogPostListItem } from "@/lib/blog-content";
import { PublicFunnelNav } from "@/components/public/public-funnel-shell";
import { PublicPageFooter } from "@/components/public/public-page-footer";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/utils/utils";

export const metadata: Metadata = {
  title: "Blog — LeadThur",
  description:
    "Practical guides on lead generation, client acquisition, cold outreach, and business growth for freelancers, agency owners, and consultants across Africa and beyond.",
  metadataBase: new URL("https://www.leadthur.com"),
  alternates: { canonical: "https://www.leadthur.com/blog" },
  openGraph: {
    title: "Blog — LeadThur",
    description:
      "Practical guides on lead generation, client acquisition, and business growth for freelancers and agency owners.",
    url: "https://www.leadthur.com/blog",
    siteName: "LeadThur",
    images: [{ url: "https://www.leadthur.com/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog — LeadThur",
    description:
      "Practical guides on lead generation and client acquisition for freelancers and agencies.",
    creator: "@BamsonOfficial",
    images: ["https://www.leadthur.com/og-image.png"],
  },
};

const CATEGORIES = [
  "All",
  "Lead Generation",
  "Freelancing",
  "Cold Outreach",
  "Nigeria Business",
  "SMMA",
  "Tools and Software",
];

async function getPosts(category?: string, tag?: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const params = new URLSearchParams({ limit: "20" });
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);

    const res = await fetch(`${apiUrl}/public/blog/posts?${params.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []) as BlogPostListItem[];
  } catch {
    return [];
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { category: categoryParam, tag: tagParam } = await searchParams;
  const activeCategory = categoryParam || "All";
  const posts = await getPosts(
    activeCategory === "All" ? undefined : activeCategory,
    tagParam
  );

  const featuredPost = posts[0];
  const gridPosts = posts.slice(1);

  return (
    <div className="min-h-screen bg-white text-[var(--lt-text)]">
      <PublicFunnelNav active="blog" />

      <main>
        <div className="mx-auto max-w-5xl px-4 py-12 text-center md:px-6 md:py-16">
          <Chip className="mb-5 border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/10 text-[var(--lt-accent)]">
            Practical guides for serious operators
          </Chip>
          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-[#0A0A0A] md:text-5xl">
            {tagParam ? `Tag: ${tagParam}` : "The LeadThur Blog"}
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#374151]">
            Lead generation, cold outreach, client acquisition, and business growth for freelancers,
            agency owners, and consultants.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat && !tagParam;
              return (
                <Link
                  key={cat}
                  href={cat === "All" ? "/blog" : `/blog/category/${categoryToSlug(cat)}`}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold no-underline transition-colors",
                    isActive
                      ? "border-[var(--lt-accent)] bg-[var(--lt-accent)] text-white"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[var(--lt-accent)]/40"
                  )}
                >
                  {cat}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6 md:pb-20">
          {posts.length === 0 ? (
            <EmptyState
              icon={<PenLine className="h-6 w-6" aria-hidden />}
              title="Articles coming soon"
              description="Check back shortly. We publish daily."
            />
          ) : (
            <>
              {featuredPost ? (
                <div className="mb-8">
                  <BlogPostCard post={featuredPost} variant="featured" />
                </div>
              ) : null}
              {gridPosts.length > 0 ? (
                <div className="blog-post-grid">
                  {gridPosts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <style>{blogCardStyles}</style>

      <section className="border-y border-[var(--lt-accent)]/20 bg-[var(--lt-accent)]/5 px-4 py-12 text-center md:py-14">
        <h2 className="mb-3 text-2xl font-black tracking-tight text-[var(--lt-text)] md:text-3xl">
          Stop reading about finding clients.
          <br />
          <span className="text-[var(--lt-accent-soft)]">Start actually finding them.</span>
        </h2>
        <p className="mb-6 text-sm text-[var(--lt-text-muted)] md:text-base">
          Try LeadThur free. No signup. No credit card. Results in 60 seconds.
        </p>
        <Button size="lg" className="h-12 px-8 font-extrabold" asChild>
          <Link href="/freetrial">Try LeadThur Free →</Link>
        </Button>
      </section>

      <PublicPageFooter />
    </div>
  );
}
