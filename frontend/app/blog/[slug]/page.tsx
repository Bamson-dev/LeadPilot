import type { Metadata } from "next";
import Link from "next/link";
import { categoryToSlug, tagToSlug } from "@/lib/blog";

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
          background: "#050508",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: "#555570",
          fontSize: 16,
        }}
      >
        Article not found.{" "}
        <Link href="/blog" style={{ color: "#A78BFA", marginLeft: 8 }}>
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#050508",
        minHeight: "100vh",
        color: "#F2F1FF",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            image: post.cover_image || "https://www.leadthur.com/og-image.png",
            author: {
              "@type": "Person",
              name: post.author,
              url: "https://www.leadthur.com/about",
            },
            publisher: {
              "@type": "Organization",
              name: "LeadThur",
              logo: {
                "@type": "ImageObject",
                url: "https://www.leadthur.com/og-image.png",
              },
            },
            datePublished: post.published_at,
            dateModified: post.updated_at,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://www.leadthur.com/blog/${post.slug}`,
            },
          }),
        }}
      />

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
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/blog" style={{ color: "#8888A8", fontSize: 14, textDecoration: "none" }}>
            ← All Articles
          </Link>
          <Link
            href="/freetrial"
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
            Try Free
          </Link>
        </div>
      </nav>

      <article style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/blog" style={{ color: "#555570", fontSize: 13, textDecoration: "none" }}>
            Blog
          </Link>
          {post.category && (
            <>
              <span style={{ color: "#555570", margin: "0 8px" }}>›</span>
              <Link
                href={`/blog/category/${categoryToSlug(post.category)}`}
                style={{ color: "#A78BFA", fontSize: 13, textDecoration: "none" }}
              >
                {post.category}
              </Link>
            </>
          )}
        </div>

        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: -1.5,
            color: "#F2F1FF",
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {post.title}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "white",
              }}
            >
              {post.author?.charAt(0) || "B"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F2F1FF" }}>{post.author}</div>
              <div style={{ fontSize: 11, color: "#555570" }}>{post.author_title}</div>
            </div>
          </div>
          <div style={{ color: "#555570", fontSize: 13 }}>
            {post.published_at &&
              new Date(post.published_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
          </div>
          <div
            style={{
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 100,
              padding: "3px 10px",
              fontSize: 11,
              color: "#A78BFA",
              fontWeight: 600,
            }}
          >
            {post.read_time} min read
          </div>
        </div>

        {post.cover_image && (
          <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
            <img
              src={post.cover_image}
              alt={post.title}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        )}

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
          style={{ fontSize: 16, lineHeight: 1.8, color: "#C0C0D8" }}
        />

        {post.tags && post.tags.length > 0 && (
          <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#555570",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              Tags
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tag/${tagToSlug(tag)}`}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 100,
                    padding: "5px 12px",
                    fontSize: 12,
                    color: "#8888A8",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <div
        style={{
          background: "rgba(124,58,237,0.08)",
          borderTop: "1px solid rgba(124,58,237,0.2)",
          borderBottom: "1px solid rgba(124,58,237,0.2)",
          padding: "60px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            padding: "6px 14px",
            borderRadius: 100,
            fontSize: 11,
            color: "#10B981",
            fontWeight: 700,
            marginBottom: 20,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Try it free
        </div>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: -1,
            color: "#F2F1FF",
            marginBottom: 12,
            lineHeight: 1.1,
          }}
        >
          Ready to stop searching manually?
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "#8888A8",
            lineHeight: 1.7,
            maxWidth: 480,
            margin: "0 auto 28px",
          }}
        >
          Find 1,000+ businesses with their phone numbers, emails, and websites in any city in 60
          seconds. No signup needed to try.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/freetrial"
            style={{
              display: "inline-flex",
              alignItems: "center",
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
          <Link
            href="/blog"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "transparent",
              color: "#A78BFA",
              fontWeight: 700,
              fontSize: 15,
              padding: "14px 32px",
              borderRadius: 12,
              textDecoration: "none",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            More Articles
          </Link>
        </div>
      </div>

      <style>{`
        .blog-content h1 { font-size: 32px; font-weight: 900; color: #F2F1FF; margin: 40px 0 16px; letter-spacing: -1px; line-height: 1.2; }
        .blog-content h2 { font-size: 26px; font-weight: 800; color: #F2F1FF; margin: 36px 0 14px; letter-spacing: -0.5px; line-height: 1.2; }
        .blog-content h3 { font-size: 20px; font-weight: 700; color: #F2F1FF; margin: 28px 0 12px; }
        .blog-content p { margin: 0 0 20px; }
        .blog-content a { color: #A78BFA; font-weight: 600; text-decoration: underline; }
        .blog-content a:hover { color: #C4B5FD; }
        .blog-content ul { padding-left: 24px; margin: 0 0 20px; }
        .blog-content ol { padding-left: 24px; margin: 0 0 20px; }
        .blog-content li { margin-bottom: 8px; color: #C0C0D8; line-height: 1.7; }
        .blog-content blockquote { border-left: 3px solid #7C3AED; padding-left: 20px; margin: 28px 0; color: #8888A8; font-style: italic; font-size: 17px; line-height: 1.7; }
        .blog-content strong { color: #F2F1FF; font-weight: 700; }
        .blog-content em { color: #C0C0D8; font-style: italic; }
        .blog-content code { background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.2); border-radius: 4px; padding: 2px 6px; font-size: 14px; color: #A78BFA; font-family: monospace; }
        .blog-content pre { background: #0A0A10; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; overflow-x: auto; margin: 24px 0; }
        .blog-content pre code { background: none; border: none; padding: 0; color: #A78BFA; font-size: 14px; }
        .blog-content img { max-width: 100%; border-radius: 10px; margin: 24px 0; display: block; }
        .blog-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 36px 0; }
        .blog-content table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        .blog-content th { background: #111118; color: #F2F1FF; font-weight: 700; padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 13px; }
        .blog-content td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #C0C0D8; font-size: 14px; }
        .blog-content tr:last-child td { border-bottom: none; }
      `}</style>

      <div
        style={{
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
