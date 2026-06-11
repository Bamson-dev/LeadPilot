import type { Metadata } from "next";
import Link from "next/link";
import { categoryToSlug } from "@/lib/blog";
import { BlogPostCard, blogCardStyles } from "@/components/blog/blog-post-card";
import type { BlogPostListItem } from "@/lib/blog-content";

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

function BlogNav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        background: "rgba(5,5,8,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div
          style={{
            width: 34,
            height: 34,
            background: "#7C3AED",
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "white",
          }}
        >
          LT
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#F2F1FF" }}>
          Lead<span style={{ color: "#A78BFA" }}>Thur</span>
        </span>
      </Link>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <Link href="/blog" style={{ color: "#A78BFA", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          Blog
        </Link>
        <Link href="/freetrial" style={{ color: "#8888A8", fontSize: 14, textDecoration: "none" }}>
          Try Free
        </Link>
        <Link
          href="/activate"
          style={{
            background: "#7C3AED",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Login
        </Link>
      </div>
    </nav>
  );
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
    <div style={{ minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <BlogNav />

      <main style={{ background: "#FFFFFF", color: "#374151" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "60px 24px 40px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#F5F3FF",
              border: "1px solid #E9D5FF",
              padding: "6px 16px",
              borderRadius: 100,
              fontSize: 12,
              color: "#7C3AED",
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            Practical guides for serious operators
          </div>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: -2,
              color: "#0A0A0A",
              marginBottom: 16,
              lineHeight: 1.05,
            }}
          >
            {tagParam ? `Tag: ${tagParam}` : "The LeadThur Blog"}
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "#374151",
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "0 auto 40px",
            }}
          >
            Lead generation, cold outreach, client acquisition, and business growth for freelancers,
            agency owners, and consultants.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat && !tagParam;
              return (
                <Link
                  key={cat}
                  href={cat === "All" ? "/blog" : `/blog/category/${categoryToSlug(cat)}`}
                  style={{
                    background: isActive ? "#7C3AED" : "#FFFFFF",
                    border: `1px solid ${isActive ? "#7C3AED" : "#E5E7EB"}`,
                    borderRadius: 100,
                    padding: "7px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? "#FFFFFF" : "#374151",
                    textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                >
                  {cat}
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
          {posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6B7280" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✍️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", marginBottom: 8 }}>
                Articles coming soon
              </div>
              <div style={{ fontSize: 14 }}>Check back shortly. We publish daily.</div>
            </div>
          ) : (
            <>
              {featuredPost && (
                <div style={{ marginBottom: 32 }}>
                  <BlogPostCard post={featuredPost} variant="featured" />
                </div>
              )}
              {gridPosts.length > 0 && (
                <div className="blog-post-grid">
                  {gridPosts.map((post) => (
                    <BlogPostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <style>{blogCardStyles}</style>

      <div
        style={{
          background: "rgba(124,58,237,0.08)",
          borderTop: "1px solid rgba(124,58,237,0.2)",
          borderBottom: "1px solid rgba(124,58,237,0.2)",
          padding: "48px 24px",
          textAlign: "center",
          marginBottom: 0,
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#F2F1FF",
            marginBottom: 12,
            letterSpacing: -1,
          }}
        >
          Stop reading about finding clients.
          <br />
          <span style={{ color: "#A78BFA" }}>Start actually finding them.</span>
        </h2>
        <p style={{ fontSize: 15, color: "#8888A8", marginBottom: 24 }}>
          Try LeadThur free. No signup. No credit card. Results in 60 seconds.
        </p>
        <Link
          href="/freetrial"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#7C3AED",
            color: "white",
            fontWeight: 800,
            fontSize: 15,
            padding: "14px 32px",
            borderRadius: 12,
            textDecoration: "none",
            boxShadow: "0 0 40px rgba(124,58,237,0.4)",
          }}
        >
          Try LeadThur Free →
        </Link>
      </div>

      <div
        style={{
          background: "#050508",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "#555570",
        }}
      >
        <p style={{ marginBottom: 8 }}>
          <strong style={{ color: "#F2F1FF" }}>LeadThur</strong> — Business Discovery Intelligence
        </p>
        <p>Built by Pdigital Marketstore Ltd (RC 8015428) · Lagos, Nigeria</p>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/privacy" style={{ color: "#A78BFA", textDecoration: "none" }}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{ color: "#A78BFA", textDecoration: "none" }}>
            Terms of Service
          </Link>
          <Link href="/about" style={{ color: "#A78BFA", textDecoration: "none" }}>
            About
          </Link>
          <Link href="/blog" style={{ color: "#A78BFA", textDecoration: "none" }}>
            Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
